// Sincronização com o Supabase.
// O app continua lendo e gravando no localStorage; este arquivo só mantém
// uma cópia na nuvem e traz para cá o que foi alterado em outro aparelho.

const SUPABASE_URL = "https://qqxtpvusgbyqfyzlyzcy.supabase.co";
const SUPABASE_KEY = "sb_publishable_jAbRMyVHfr4HPDyxNcYsSQ_sXozOJ8l"; // chave pública: a proteção é o RLS da tabela

const CHAVE_DADOS = /^fluxo_(\d{4}_\d{2}|meta|renda|parcelas|categorias)$/;
const URL_APP = location.origin + location.pathname;

const sb = typeof supabase !== "undefined"
  ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

let sessao = null;
let rodando = false;
let deNovo = false;
let espera = null;
let situacao = { tipo: "local", texto: "Só neste aparelho" };

/* ============ Estado salvo ============ */

// base: como cada chave estava na última sincronização; serve para saber o que mudou de cada lado
function lerEstado() {
  try {
    return { base: {}, ...JSON.parse(localStorage.getItem("meufluxo_sync") || "{}") };
  } catch (e) {
    return { base: {} };
  }
}

function salvarEstado(st) {
  localStorage.setItem("meufluxo_sync", JSON.stringify(st));
}

function lerMod() {
  try {
    return JSON.parse(localStorage.getItem("meufluxo_mod") || "{}");
  } catch (e) {
    return {};
  }
}

// JSON com as chaves em ordem: o banco reordena os campos, então comparamos sempre assim
function canon(v) {
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  if (v && typeof v === "object") {
    return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
  }
  return JSON.stringify(v);
}

function lerLocal(chave) {
  const bruto = localStorage.getItem(chave);
  if (bruto == null) return undefined;
  try {
    return JSON.parse(bruto);
  } catch (e) {
    return undefined;
  }
}

function chavesLocais() {
  return Object.keys(localStorage).filter((k) => CHAVE_DADOS.test(k));
}

function temAlteracaoLocal() {
  const { base } = lerEstado();
  return chavesLocais().some((k) => {
    const v = lerLocal(k);
    return v !== undefined && canon(v) !== base[k];
  });
}

function limparDadosLocais() {
  chavesLocais().forEach((k) => localStorage.removeItem(k));
  localStorage.removeItem("meufluxo_mod");
  localStorage.removeItem("meufluxo_sync");
}

// Primeira sincronização com dados dos dois lados: junta em vez de escolher um
function mesclar(chave, local, remoto) {
  if (chave === "fluxo_meta") return local || remoto;
  // "Como eu recebo": vale a da conta (é a que já foi usada nos outros aparelhos)
  if (chave === "fluxo_renda") return remoto?.fontes?.length ? remoto : local;
  if (chave === "fluxo_categorias") return remoto || local;
  if (chave === "fluxo_parcelas") {
    const ids = new Set(local.map((p) => p.id));
    return [...local, ...remoto.filter((p) => !ids.has(p.id))];
  }
  const unir = (a = [], b = []) => {
    const ids = new Set(a.map((i) => i.id));
    return [...a, ...b.filter((i) => !ids.has(i.id))];
  };
  const m = { ...remoto, ...local };
  m.entradas = unir(local.entradas, remoto.entradas);
  m.gastos = unir(local.gastos, remoto.gastos);
  if (!local.diasTrabalhados && remoto.diasTrabalhados) {
    m.diasTrabalhados = remoto.diasTrabalhados;
    m.diasUteis = remoto.diasUteis;
    m.bolsa = remoto.bolsa;
  }
  if (!local.reserva && remoto.reserva) m.reserva = remoto.reserva;
  return m;
}

/* ============ Sincronizar ============ */

async function sincronizar() {
  if (!sb || !sessao) return false;
  if (rodando) {
    deNovo = true;
    return false;
  }
  if (!navigator.onLine) {
    mostrarSituacao("offline", "Sem internet. Sincroniza quando voltar.");
    return false;
  }

  rodando = true;
  mostrarSituacao("sincronizando", "Sincronizando…");
  try {
    const { data, error } = await sb.from("registros").select("chave, dados, atualizado_em");
    if (error) throw error;

    const st = lerEstado();
    const mod = lerMod();
    const remotos = new Map(data.map((r) => [r.chave, r]));
    const enviar = [];
    let mudouAqui = false;

    for (const k of new Set([...chavesLocais(), ...remotos.keys()])) {
      const local = lerLocal(k);
      const r = remotos.get(k);
      const cl = local === undefined ? null : canon(local);
      const cr = r ? canon(r.dados) : null;
      const base = st.base[k] ?? null;

      if (cl === cr) {
        if (cl !== null) st.base[k] = cl;
        continue;
      }

      let vence;
      if (cl === null) vence = "remoto";
      else if (cr === null || cr === base) vence = "local";
      else if (cl === base) vence = "remoto";
      else if (base === null) vence = "mesclar";
      else vence = (mod[k] || 0) >= Date.parse(r.atualizado_em) ? "local" : "remoto";

      if (vence === "remoto") {
        localStorage.setItem(k, JSON.stringify(r.dados));
        st.base[k] = cr;
        mudouAqui = true;
      } else {
        const valor = vence === "mesclar" ? mesclar(k, local, r.dados) : local;
        if (vence === "mesclar") {
          localStorage.setItem(k, JSON.stringify(valor));
          mudouAqui = true;
        }
        enviar.push({
          user_id: sessao.user.id,
          chave: k,
          dados: valor,
          atualizado_em: new Date(mod[k] || Date.now()).toISOString(),
        });
      }
    }

    if (enviar.length) {
      const { error: erroEnvio } = await sb.from("registros").upsert(enviar, { onConflict: "user_id,chave" });
      if (erroEnvio) throw erroEnvio;
      enviar.forEach((r) => (st.base[r.chave] = canon(r.dados)));
    }

    st.ultima = Date.now();
    salvarEstado(st);
    if (mudouAqui) renderTudo();
    mostrarSituacao("ok", "Sincronizado às " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    return true;
  } catch (e) {
    console.error("Erro ao sincronizar", e);
    if (!navigator.onLine || e instanceof TypeError) mostrarSituacao("offline", "Sem conexão. Sincroniza quando voltar.");
    else mostrarSituacao("erro", "Não foi possível sincronizar. Tente de novo.");
    return false;
  } finally {
    rodando = false;
    if (deNovo) {
      deNovo = false;
      agendarSync(300);
    }
  }
}

function agendarSync(ms = 1200) {
  if (!sessao) return;
  clearTimeout(espera);
  espera = setTimeout(sincronizar, ms);
}

// Chamado pelo app sempre que salva algo
function aoSalvarLocal() {
  agendarSync();
}

/* ============ Conta ============ */

const MSG_ERRO = {
  "Invalid login credentials": "E-mail ou senha incorretos.",
  "Email not confirmed": "Confirme seu e-mail pelo link que enviamos antes de entrar.",
  "User already registered": "Já existe uma conta com esse e-mail. Use Entrar.",
  "Password should be at least 6 characters.": "A senha precisa ter pelo menos 6 caracteres.",
  "Unable to validate email address: invalid format": "Esse e-mail não parece válido.",
};

function traduzirErro(e) {
  const msg = e?.message || "";
  if (MSG_ERRO[msg]) return MSG_ERRO[msg];
  if (/rate limit/i.test(msg)) return "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.";
  if (/password/i.test(msg) && /characters/i.test(msg)) return MSG_ERRO["Password should be at least 6 characters."];
  if (e instanceof TypeError || /fetch/i.test(msg)) return "Sem conexão com a internet.";
  return msg || "Algo deu errado. Tente de novo.";
}

// Ao entrar: se este aparelho tinha dados de outra conta, eles saem antes de sincronizar
function prepararUsuario(user) {
  const st = lerEstado();
  if (st.usuario && st.usuario !== user.id) {
    limparDadosLocais();
    salvarEstado({ base: {}, usuario: user.id });
    renderTudo();
  } else if (st.usuario !== user.id) {
    st.usuario = user.id;
    salvarEstado(st);
  }
}

async function entrar(email, senha) {
  const { error } = await sb.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
}

async function criarConta(email, senha) {
  const { data, error } = await sb.auth.signUp({ email, password: senha, options: { emailRedirectTo: URL_APP } });
  if (error) throw error;
  return !data.session; // true = precisa confirmar o e-mail
}

async function esqueciSenha(email) {
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: URL_APP });
  if (error) throw error;
}

async function definirNovaSenha(senha) {
  const { error } = await sb.auth.updateUser({ password: senha });
  if (error) throw error;
}

async function sair(forcar) {
  if (!forcar) {
    const ok = await sincronizar();
    if (!ok && temAlteracaoLocal()) return false;
  }
  await sb.auth.signOut({ scope: "local" });
  limparDadosLocais();
  renderTudo();
  return true;
}

/* ============ Interface ============ */

function mostrarSituacao(tipo, texto) {
  situacao = { tipo, texto };
  const btn = $("btn-nuvem");
  if (!btn) return;
  btn.dataset.situacao = tipo;
  btn.setAttribute("aria-label", "Conta e sincronização: " + texto);
  btn.querySelector("use").setAttribute("href", tipo === "local" ? "#i-nuvem-off" : "#i-nuvem");
  $("conta-situacao").textContent = texto;
  $("conta-situacao").dataset.situacao = tipo;
  const lateral = $("conta-lateral");
  lateral.innerHTML = sessao
    ? `<span class="conta-ponto" data-situacao="${tipo}"></span><span>${esc(texto)}<br><small>${esc(sessao.user.email)}</small></span>`
    : `Seus dados ficam só neste aparelho. <button class="link-btn" onclick="abrirConta()">Entrar para sincronizar</button>`;
}

let modo = "entrar"; // entrar | criar | senha

function telaConta() {
  const logado = !!sessao && modo !== "senha";
  $("conta-fora").hidden = logado;
  $("conta-dentro").hidden = !logado;
  $("conta-erro").hidden = true;
  $("conta-sair-forcar").hidden = true;

  if (logado) {
    $("conta-titulo").textContent = "Sua conta";
    $("conta-email").textContent = sessao.user.email;
    return;
  }
  const textos = {
    entrar: ["Sincronizar entre aparelhos", "Entrar", "Não tem conta? Criar conta", "current-password"],
    criar: ["Criar conta", "Criar conta", "Já tem conta? Entrar", "new-password"],
    senha: ["Nova senha", "Salvar nova senha", "", "new-password"],
  }[modo];
  $("conta-titulo").textContent = textos[0];
  $("conta-enviar").textContent = textos[1];
  $("conta-alternar").textContent = textos[2];
  $("conta-alternar").hidden = modo === "senha";
  $("conta-esqueci").hidden = modo !== "entrar";
  $("conta-campo-email").hidden = modo === "senha";
  $("conta-senha").autocomplete = textos[3];
  $("conta-intro").hidden = modo !== "entrar";
}

function abrirConta() {
  if (!sb) return toast("A sincronização não carregou. Recarregue a página.");
  bootstrap.Offcanvas.getInstance($("sidebar"))?.hide();
  if (modo !== "senha") modo = "entrar";
  telaConta();
  bootstrap.Modal.getOrCreateInstance($("modal-conta")).show();
}

function erroConta(msg) {
  $("conta-erro").textContent = msg;
  $("conta-erro").hidden = false;
}

function alternarModoConta() {
  modo = modo === "entrar" ? "criar" : "entrar";
  telaConta();
}

async function enviarConta(ev) {
  ev.preventDefault();
  const email = $("conta-email-input").value.trim();
  const senha = $("conta-senha").value;
  const botao = $("conta-enviar");
  botao.disabled = true;
  try {
    if (modo === "senha") {
      await definirNovaSenha(senha);
      modo = "entrar";
      toast("Senha alterada");
    } else if (modo === "criar") {
      const confirmar = await criarConta(email, senha);
      if (confirmar) {
        modo = "entrar";
        telaConta();
        erroConta("Conta criada. Abra o link que enviamos para " + email + " e depois entre aqui.");
        $("conta-erro").dataset.tipo = "info";
        return;
      }
      toast("Conta criada");
    } else {
      await entrar(email, senha);
      toast("Pronto, sincronizando");
    }
    $("conta-senha").value = "";
    bootstrap.Modal.getInstance($("modal-conta"))?.hide();
  } catch (e) {
    $("conta-erro").dataset.tipo = "erro";
    erroConta(traduzirErro(e));
  } finally {
    botao.disabled = false;
  }
}

async function contaEsqueci() {
  const email = $("conta-email-input").value.trim();
  if (!email) return erroConta("Digite seu e-mail acima e toque de novo em Esqueci a senha.");
  try {
    await esqueciSenha(email);
    $("conta-erro").dataset.tipo = "info";
    erroConta("Enviamos um link para " + email + ". Abra no mesmo aparelho para criar a nova senha.");
  } catch (e) {
    $("conta-erro").dataset.tipo = "erro";
    erroConta(traduzirErro(e));
  }
}

async function contaSair(forcar) {
  const ok = await sair(forcar);
  if (ok) {
    bootstrap.Modal.getInstance($("modal-conta"))?.hide();
    toast("Você saiu. Seus dados continuam salvos na conta.");
  } else {
    $("conta-erro").dataset.tipo = "erro";
    erroConta("Não deu para sincronizar agora. Se sair mesmo assim, as últimas alterações feitas neste aparelho se perdem.");
    $("conta-sair-forcar").hidden = false;
  }
}

async function contaSincronizarAgora() {
  const ok = await sincronizar();
  if (ok) toast("Tudo sincronizado");
}

/* ============ Início ============ */

if (sb) {
  sb.auth.onAuthStateChange((evento, s) => {
    sessao = s;
    // Fora do callback para não travar o cliente do Supabase
    setTimeout(() => {
      if (evento === "PASSWORD_RECOVERY") {
        modo = "senha";
        abrirConta();
      }
      if (s && (evento === "SIGNED_IN" || evento === "INITIAL_SESSION")) {
        prepararUsuario(s.user);
        sincronizar();
      }
      if (!s) mostrarSituacao("local", "Só neste aparelho");
      else if (situacao.tipo === "local") mostrarSituacao("ok", "Conectado");
      if ($("modal-conta").classList.contains("show")) telaConta();
    }, 0);
  });

  // Traz novidades quando o app volta para a tela, e envia antes de sair dela
  document.addEventListener("visibilitychange", () => sincronizar());
  addEventListener("online", () => sincronizar());

  // Pega alterações que não passam pelo marcarModificado (garantia extra)
  setInterval(() => {
    if (sessao && !rodando && document.visibilityState === "visible" && temAlteracaoLocal()) agendarSync(0);
  }, 5000);
} else {
  $("btn-nuvem").hidden = true;
}
