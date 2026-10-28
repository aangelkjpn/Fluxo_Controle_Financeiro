const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const animar = !matchMedia("(prefers-reduced-motion: reduce)").matches;

let mesAtual = new Date().getMonth();
let anoAtual = new Date().getFullYear();
let idNovo = null; // lançamento recém-adicionado, para destacar na lista

/* ============ Armazenamento ============ */

function keyMes(mes, ano) {
  return `fluxo_${ano}_${String(mes).padStart(2, "0")}`;
}

function getMes(mes, ano) {
  const salvo = localStorage.getItem(keyMes(mes, ano));
  return salvo ? JSON.parse(salvo) : mesVazio();
}

function mesVazio() {
  return { entradas: [], gastos: [], reserva: 0 };
}

function setMes(mes, ano, dados) {
  localStorage.setItem(keyMes(mes, ano), JSON.stringify(dados));
  marcarModificado(keyMes(mes, ano));
}

function getMeta() {
  return parseFloat(localStorage.getItem("fluxo_meta") || "0");
}

function setMeta(valor) {
  localStorage.setItem("fluxo_meta", String(valor));
  marcarModificado("fluxo_meta");
}

// Guarda quando cada mês foi alterado (decide quem vence se dois aparelhos mexerem no mesmo mês)
function marcarModificado(chave) {
  try {
    const mod = JSON.parse(localStorage.getItem("meufluxo_mod") || "{}");
    mod[chave] = Date.now();
    localStorage.setItem("meufluxo_mod", JSON.stringify(mod));
  } catch (e) {}
  if (typeof aoSalvarLocal === "function") aoSalvarLocal();
}

// Gastos pagos com dinheiro (inclui as parcelas); o que foi no cartão de benefício fica de fora
function gastoDoMes(mes, ano, d = getMes(mes, ano)) {
  return gastosDoMes(mes, ano, d)
    .filter((g) => !g.pago)
    .reduce((s, g) => s + g.valor, 0);
}

function mesesSalvos() {
  const lista = [];
  for (const k in localStorage) {
    const m = k.match(/^fluxo_(\d{4})_(\d{2})$/);
    if (!m) continue;
    try {
      lista.push({ ano: parseInt(m[1]), mes: parseInt(m[2]), d: JSON.parse(localStorage.getItem(k)) });
    } catch (e) {}
  }
  return lista.sort((a, b) => a.ano - b.ano || a.mes - b.mes);
}

function getReservaTotal() {
  return mesesSalvos().reduce((s, { d }) => s + (d.reserva || 0), 0);
}

/* ============ Formatação ============ */

function fmtNum(v) {
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmt(v) {
  return "R$ " + fmtNum(v);
}

function pct(v, total) {
  return total ? Math.min(100, Math.round((v / total) * 100)) : 0;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function nomeMes(mes, ano) {
  return `${MESES[mes]} ${ano}`;
}

function $(id) {
  return document.getElementById(id);
}

function toast(msg) {
  $("toast-msg").textContent = msg;
  bootstrap.Toast.getOrCreateInstance($("toast"), { delay: 2500 }).show();
}

function vazio(msg, acao) {
  return `<div class="empty-state">${msg}${acao ? `<br><button class="link-btn" onclick='trocarAba("${acao[1]}")'>${acao[0]}</button>` : ""}</div>`;
}

/* ============ Peças visuais ============ */

// Barra do fluxo: gastou / guardou / sobrou como partes do que entrou
function barraFluxo(entrada, gasto, reserva, extraClasse = "") {
  const sobra = entrada - gasto - reserva;
  const total = Math.max(entrada, gasto + reserva);
  if (!total) return `<div class="fluxo vazio ${extraClasse}"></div>`;

  const partes = [
    ["gasto", gasto, "Gastou"],
    ["guardou", reserva, "Guardou"],
    ["sobrou", Math.max(0, sobra), "Sobrou"],
  ].filter(([, v]) => v > 0);

  const segs = partes
    .map(([tipo, v, rotulo]) => {
      const fr = v / total;
      return `<div class="seg seg-${tipo}" data-fr="${fr}" style="flex-grow:${animar ? 0 : fr}"
        data-tip="${rotulo}: ${fmt(v)}" data-tip-sub="${pct(v, entrada) || "—"}% do que entrou"></div>`;
    })
    .join("");

  const marca = sobra < 0
    ? `<div class="fluxo-marca" style="left:${(entrada / total) * 100}%" data-tip="Até aqui é o que entrou" data-tip-sub="${fmt(entrada)}"></div>`
    : "";

  return `<div class="fluxo ${extraClasse}">${segs}${marca}</div>`;
}

// Faz as barras crescerem a partir do zero (uma vez, depois de desenhar)
function crescerBarras(raiz) {
  if (!animar) return;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      raiz.querySelectorAll(".seg[data-fr]").forEach((s) => (s.style.flexGrow = s.dataset.fr));
      raiz.querySelectorAll("[data-w]").forEach((b) => (b.style.width = b.dataset.w + "%"));
    }),
  );
}

function anel(p, extra = "") {
  const r = 46;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(p, 100) / 100);
  return `
    <div class="anel ${p >= 100 ? "completo" : ""} ${extra}" role="img" aria-label="${p}% da meta">
      <svg viewBox="0 0 112 112">
        <circle class="anel-fundo" cx="56" cy="56" r="${r}"/>
        <circle class="anel-valor" cx="56" cy="56" r="${r}" stroke-dasharray="${c}"
          stroke-dashoffset="${animar ? c : offset}" data-offset="${offset}"/>
      </svg>
      <span class="anel-pct">${p}%</span>
    </div>`;
}

function encherAneis(raiz) {
  if (!animar) return;
  requestAnimationFrame(() =>
    requestAnimationFrame(() =>
      raiz.querySelectorAll(".anel-valor").forEach((c) => (c.style.strokeDashoffset = c.dataset.offset)),
    ),
  );
}

// Número do topo do painel subindo até o valor
let contagem = null;
function contarAte(el, valor) {
  const html = (v) => `<span class="cifrao">R$</span>${fmtNum(v)}`;
  cancelAnimationFrame(contagem);
  if (!animar) return (el.innerHTML = html(valor));
  const dur = 700;
  const t0 = performance.now();
  const passo = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    el.innerHTML = html(valor * (1 - Math.pow(1 - k, 3)));
    if (k < 1) contagem = requestAnimationFrame(passo);
  };
  contagem = requestAnimationFrame(passo);
}

function itemLancamento(l, comExcluir) {
  const entrada = l.tipo === "entrada";
  const icone = entrada
    ? `<div class="lanc-icone entrada" aria-hidden="true">+</div>`
    : iconeCat(l.cat);
  const excluir = comExcluir && !l.parcela
    ? `<button class="lanc-del" onclick="${entrada ? "delEntrada" : "delGasto"}(${l.id})" aria-label="Excluir ${esc(l.desc)}"><svg class="ic"><use href="#i-x"/></svg></button>`
    : "";
  return `
    <div class="lanc-item ${l.id === idNovo ? "novo" : ""}">
      ${icone}
      <div class="lanc-info">
        <span class="lanc-desc">${esc(l.desc)}${l.pago ? ` <span class="pill">${esc(l.pago)}</span>` : ""}</span>
        <span class="lanc-cat">${entrada ? "Entrada" : esc(l.cat)}${l.parcela ? `, parcela ${l.parcela.num} de ${l.parcela.de}` : ""}</span>
      </div>
      <span class="lanc-val ${entrada ? "entrada" : "saida"}">${entrada ? "+" : "−"} ${fmt(l.valor)}</span>
      ${excluir}
    </div>`;
}

function preencherPagoCom(select, campo) {
  const cartoes = carteirasConhecidas();
  campo.hidden = !cartoes.length;
  const atual = select.value;
  select.innerHTML =
    `<option value="">Dinheiro / conta</option>` +
    cartoes.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
  if (cartoes.includes(atual)) select.value = atual;
}

/* ============ Navegação ============ */

function trocarAba(aba) {
  document.querySelectorAll(".aba").forEach((a) => a.classList.toggle("active", a.id === "aba-" + aba));
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.aba === aba));
  bootstrap.Offcanvas.getInstance($("sidebar"))?.hide();
  window.scrollTo({ top: 0 });
  renderAba(aba);
}

function mudarMes(delta) {
  mesAtual += delta;
  if (mesAtual > 11) { mesAtual = 0; anoAtual++; }
  if (mesAtual < 0) { mesAtual = 11; anoAtual--; }
  atualizarLabel();
  renderTudo();
}

function irParaHoje() {
  mesAtual = new Date().getMonth();
  anoAtual = new Date().getFullYear();
  atualizarLabel();
  renderTudo();
}

function atualizarLabel() {
  $("mes-label").textContent = nomeMes(mesAtual, anoAtual);
  const hoje = new Date();
  $("btn-hoje").disabled = mesAtual === hoje.getMonth() && anoAtual === hoje.getFullYear();
}

function renderAba(aba) {
  ({
    painel: renderPainel,
    renda: renderRenda,
    gastos: renderGastos,
    reserva: renderReserva,
    historico: renderHistorico,
  })[aba]?.();
}

function renderTudo() {
  const aba = document.querySelector(".aba.active")?.id?.replace("aba-", "");
  if (aba) renderAba(aba);
}

/* ============ Tema ============ */

function aplicarTema(tema) {
  document.documentElement.dataset.theme = tema;
  document.documentElement.dataset.bsTheme = tema;
  document.querySelector('meta[name="theme-color"]').content = tema === "light" ? "#eef0f5" : "#121420";
  const btn = $("btn-tema");
  btn.querySelector("use").setAttribute("href", tema === "light" ? "#i-lua" : "#i-sol");
  btn.setAttribute("aria-label", tema === "light" ? "Usar tema escuro" : "Usar tema claro");
}

function alternarTema() {
  const novo = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  try { localStorage.setItem("meufluxo_tema", novo); } catch (e) {}
  aplicarTema(novo);
}

/* ============ Painel ============ */

function renderPainel() {
  const d = getMes(mesAtual, anoAtual);
  const renda = rendaDoMes(d);
  const gastos = gastosDoMes(mesAtual, anoAtual, d);
  const entrada = entradaDoMes(d);
  const gasto = gastoDoMes(mesAtual, anoAtual, d);
  const nGastos = gastos.filter((g) => !g.pago).length;
  const reserva = d.reserva || 0;
  const sobra = entrada - gasto - reserva;
  const meta = getMeta();
  const mesNome = MESES[mesAtual].toLowerCase();
  const semRenda = !renda.itens.length && !d.entradas.length;

  // Topo
  const hero = $("p-hero");
  hero.classList.toggle("negativo", sobra < 0);
  $("p-hero-label").textContent = sobra < 0 ? `Faltou em ${mesNome}` : `Sobrou em ${mesNome}`;
  contarAte($("p-sobrou"), Math.abs(sobra));
  $("p-sobrou-sub").innerHTML = semRenda
    ? `Você ainda não contou como recebe. <button class="link-btn" onclick="abrirConfigRenda()">Configurar renda</button>`
    : sobra < 0
      ? `Gastos e reserva passaram <strong>${fmt(-sobra)}</strong> do que entrou.`
      : renda.salva || !renda.itens.length
        ? `de <strong>${fmt(entrada)}</strong> que entrou no mês`
        : `Estimativa da renda do mês. <button class="link-btn" onclick='trocarAba("renda")'>Salvar valor real</button>`;

  const fluxo = $("p-fluxo");
  fluxo.outerHTML = barraFluxo(entrada, gasto, reserva).replace('class="fluxo', 'id="p-fluxo" class="fluxo');
  crescerBarras(hero);

  $("p-entrada").textContent = fmt(entrada);
  $("p-entrada-sub").textContent = !renda.itens.length
    ? "sem renda configurada"
    : !renda.salva
      ? "estimativa"
      : renda.diasTrabalhados
        ? `${renda.diasTrabalhados} dias trabalhados`
        : "renda salva";
  $("p-saida").textContent = fmt(gasto);
  $("p-saida-sub").textContent = `${nGastos} lançamento${nGastos !== 1 ? "s" : ""}`;
  $("p-guardou").textContent = fmt(reserva);
  $("p-guardou-sub").textContent = meta ? `${pct(reserva, meta)}% da meta` : "sem meta definida";
  $("p-sobrou-leg").textContent = fmt(Math.max(0, sobra));
  $("p-sobrou-pct").textContent = entrada ? `${Math.max(0, Math.round((sobra / entrada) * 100))}% do que entrou` : "—";

  // Cartões de benefício (saldo acumulado)
  const cartoes = saldosCarteiras(mesAtual, anoAtual);
  $("p-carteiras").hidden = !cartoes.length;
  $("p-carteiras").innerHTML = cartoes
    .map(
      (c) => `
      <div class="carteira">
        <span class="carteira-nome">Saldo no ${esc(c.nome)}</span>
        <span class="carteira-saldo ${c.saldo < 0 ? "neg" : ""}">${fmt(c.saldo)}</span>
        <span class="carteira-mov">Entrou ${fmt(c.entrouMes)}, gastou ${fmt(c.gastouMes)} neste mês</span>
      </div>`,
    )
    .join("");

  // Categorias (tudo que foi gasto, em dinheiro ou cartão)
  const porCat = {};
  gastos.forEach((g) => (porCat[g.cat] = (porCat[g.cat] || 0) + g.valor));
  const totalCat = gastos.reduce((s, g) => s + g.valor, 0);
  const cats = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
  const maior = cats[0]?.[1] || 0;
  const elCat = $("p-categorias");
  elCat.innerHTML = cats.length
    ? cats
        .map(([cat, v]) => {
          const w = maior ? (v / maior) * 100 : 0;
          return `
            <div class="cat-item" style="--cor:${corCat(cat)}">
              ${iconeCat(cat, "cat-icone")}
              <span class="cat-nome">${esc(cat)}</span>
              <span class="cat-valor">${fmt(v)}<span class="cat-pct">${pct(v, totalCat)}%</span></span>
              <div class="cat-barra-wrap">
                <div class="cat-barra" data-w="${w}" style="width:${animar ? 0 : w}%"
                  data-tip="${esc(cat)}: ${fmt(v)}" data-tip-sub="${pct(v, totalCat)}% dos gastos do mês"></div>
              </div>
            </div>`;
        })
        .join("")
    : vazio("Nenhum gasto registrado neste mês.", ["Adicionar um gasto", "gastos"]);
  crescerBarras(elCat);

  // Meta
  const elMeta = $("p-meta-area");
  if (meta) {
    const p = pct(reserva, meta);
    elMeta.innerHTML = `
      <div class="meta-anel">
        ${anel(p)}
        <div class="meta-texto">
          <span class="grande">${fmt(reserva)} <span>de ${fmt(meta)}</span></span>
          <span class="pequeno">${p >= 100 ? "Meta do mês batida." : `Faltam ${fmt(meta - reserva)} para bater a meta.`}</span>
        </div>
      </div>
      <div class="meta-acumulado"><span>Reserva acumulada</span><strong>${fmt(getReservaTotal())}</strong></div>`;
    encherAneis(elMeta);
  } else {
    elMeta.innerHTML =
      vazio("Defina quanto quer guardar por mês para acompanhar aqui.", ["Definir meta", "reserva"]) +
      `<div class="meta-acumulado"><span>Reserva acumulada</span><strong>${fmt(getReservaTotal())}</strong></div>`;
  }

  // Últimos lançamentos (mais recentes primeiro)
  const ultimos = [
    ...d.entradas.map((e) => ({ ...e, tipo: "entrada" })),
    ...d.gastos.map((g) => ({ ...g, tipo: "saida" })),
  ]
    .sort((a, b) => b.id - a.id)
    .slice(0, 6);
  $("p-ultimos").innerHTML = ultimos.length
    ? `<div class="lancamentos-lista">${ultimos.map((l) => itemLancamento(l, false)).join("")}</div>`
    : vazio("Nenhum lançamento neste mês ainda.");

  renderParcelasPainel();
}

/* ============ Outras entradas ============ */

function addEntrada() {
  const desc = $("r-desc").value.trim();
  const valor = parseFloat($("r-valor").value) || 0;
  if (!desc || !valor) return toast("Preencha a descrição e o valor");
  const d = getMes(mesAtual, anoAtual);
  idNovo = Date.now();
  d.entradas.push({ id: idNovo, desc, valor });
  setMes(mesAtual, anoAtual, d);
  $("r-desc").value = "";
  $("r-valor").value = "";
  $("r-desc").focus();
  toast("Entrada adicionada");
  renderRenda();
  idNovo = null;
}

function delEntrada(id) {
  const d = getMes(mesAtual, anoAtual);
  d.entradas = d.entradas.filter((e) => e.id !== id);
  setMes(mesAtual, anoAtual, d);
  toast("Entrada excluída");
  renderRenda();
}

/* ============ Gastos ============ */

function addGasto() {
  const desc = $("g-desc").value.trim();
  const valor = parseFloat($("g-valor").value) || 0;
  const cat = $("g-cat").value;
  const pago = $("g-pago").value || "";
  if (!desc || !valor) return toast("Preencha a descrição e o valor");
  const d = getMes(mesAtual, anoAtual);
  idNovo = Date.now();
  d.gastos.push(pago ? { id: idNovo, desc, valor, cat, pago } : { id: idNovo, desc, valor, cat });
  setMes(mesAtual, anoAtual, d);
  $("g-desc").value = "";
  $("g-valor").value = "";
  $("g-desc").focus();
  toast("Gasto adicionado");
  renderGastos();
  idNovo = null;
}

function delGasto(id) {
  const d = getMes(mesAtual, anoAtual);
  d.gastos = d.gastos.filter((g) => g.id !== id);
  setMes(mesAtual, anoAtual, d);
  toast("Gasto excluído");
  renderGastos();
}

function renderGastos() {
  const d = getMes(mesAtual, anoAtual);
  $("gastos-mes-sub").textContent = nomeMes(mesAtual, anoAtual);
  const lista = [...[...d.gastos].reverse(), ...parcelasDoMes(mesAtual, anoAtual)];
  const n = lista.length;
  const total = lista.reduce((s, g) => s + g.valor, 0);
  $("g-total").innerHTML = n ? `${n} lançamento${n !== 1 ? "s" : ""}, total <strong>${fmt(total)}</strong>` : "";
  $("g-lista").innerHTML = n
    ? lista.map((g) => itemLancamento({ ...g, tipo: "saida" }, true)).join("")
    : vazio("Nenhum gasto registrado neste mês.");
  preencherPagoCom($("g-pago"), $("g-pago-campo"));
  desenharEscolhaCat("g");
  renderParcelas();
}

/* ============ Reserva ============ */

function salvarMeta() {
  const v = parseFloat($("res-meta").value) || 0;
  if (!v) return toast("Informe um valor para a meta");
  setMeta(v);
  toast("Meta salva");
  renderReserva();
}

function salvarReserva() {
  const v = parseFloat($("res-valor").value) || 0;
  if (!v) return toast("Informe quanto você guardou");
  const d = getMes(mesAtual, anoAtual);
  d.reserva = v;
  setMes(mesAtual, anoAtual, d);
  $("res-valor").value = "";
  toast("Reserva registrada");
  renderReserva();
}

function renderReserva() {
  const meta = getMeta();
  const d = getMes(mesAtual, anoAtual);
  const reserva = d.reserva || 0;
  $("reserva-mes-sub").textContent = nomeMes(mesAtual, anoAtual);

  if (meta) $("res-meta").value = meta;
  $("res-meta-atual").innerHTML = meta
    ? `Meta atual: <strong>${fmt(meta)} por mês</strong>`
    : "Nenhuma meta definida ainda.";

  const p = pct(reserva, meta);
  const elRes = $("res-progresso");
  elRes.innerHTML = `
    <div class="meta-anel">
      ${anel(meta ? p : 0)}
      <div class="meta-texto">
        <span class="pequeno">Guardado em ${MESES[mesAtual].toLowerCase()}</span>
        <span class="grande">${fmt(reserva)}${meta ? ` <span>de ${fmt(meta)}</span>` : ""}</span>
        <span class="pequeno">${
          !meta ? "Defina uma meta para ver o progresso." : p >= 100 ? "Meta do mês batida." : `Faltam ${fmt(meta - reserva)}.`
        }</span>
      </div>
    </div>
    <div class="meta-acumulado"><span>Reserva acumulada</span><strong>${fmt(getReservaTotal())}</strong></div>`;
  encherAneis(elRes);

  const meses = mesesSalvos().filter(({ d }) => d.reserva).reverse();
  const escala = Math.max(meta, ...meses.map(({ d }) => d.reserva)) || 1;
  const elHist = $("res-historico");
  elHist.innerHTML = meses.length
    ? meses
        .map(({ mes, ano, d }) => {
          const w = (d.reserva / escala) * 100;
          return `
            <div class="res-linha">
              <span class="nome">${MESES[mes].slice(0, 3)} ${ano}</span>
              <div class="res-trilho">
                <div class="res-barra" data-w="${w}" style="width:${animar ? 0 : w}%"
                  data-tip="${nomeMes(mes, ano)}: ${fmt(d.reserva)}" data-tip-sub="${meta ? pct(d.reserva, meta) + "% da meta" : "sem meta"}"></div>
                ${meta ? `<div class="res-meta-marca" style="left:calc(${(meta / escala) * 100}% - 1px)" data-tip="Meta: ${fmt(meta)}"></div>` : ""}
              </div>
              <span class="valor">${fmt(d.reserva)}</span>
            </div>`;
        })
        .join("")
    : vazio("Nenhuma reserva registrada ainda.");
  crescerBarras(elHist);
}

/* ============ Histórico ============ */

function renderHistorico() {
  const salvos = new Map(mesesSalvos().map((m) => [idxMes(m.mes, m.ano), m]));
  const hoje = idxMes(new Date().getMonth(), new Date().getFullYear());
  getParcelas().forEach((p) => {
    for (let i = p.inicio; i < p.inicio + p.n && i <= hoje; i++) {
      if (!salvos.has(i)) salvos.set(i, { mes: i % 12, ano: Math.floor(i / 12), d: mesVazio() });
    }
  });
  const meses = [...salvos.values()]
    .sort((a, b) => a.ano - b.ano || a.mes - b.mes)
    .map((m) => ({ ...m, entrada: entradaDoMes(m.d), saida: gastoDoMes(m.mes, m.ano, m.d) }))
    .filter((m) => m.entrada || m.saida || m.d.reserva)
    .reverse();

  const el = $("hist-lista");
  $("hist-legenda").hidden = !meses.length;
  if (!meses.length) {
    el.innerHTML = `<div class="bloco">${vazio("Nada por aqui ainda. Registre a renda do mês para começar.", ["Ir para Renda", "renda"])}</div>`;
    return;
  }

  // Todas as barras na mesma escala, para dar para comparar os meses
  const escala = Math.max(...meses.map((m) => Math.max(m.entrada, m.saida + (m.d.reserva || 0))));

  el.innerHTML = meses
    .map(({ mes, ano, d, entrada, saida }) => {
      const reserva = d.reserva || 0;
      const saldo = entrada - saida - reserva;
      const largura = (Math.max(entrada, saida + reserva) / escala) * 100;
      return `
        <div class="bloco hist-mes">
          <div class="hist-mes-nome">${MESES[mes]} <span class="hist-mes-ano">${ano}</span></div>
          <div>
            <div style="width:${largura}%">${barraFluxo(entrada, saida, reserva, "hist-fluxo")}</div>
            <div class="hist-mes-stats">
              <span class="hist-stat">Entrou<strong>${fmt(entrada)}</strong></span>
              <span class="hist-stat">Gastou<strong>${fmt(saida)}</strong></span>
              <span class="hist-stat">Guardou<strong>${fmt(reserva)}</strong></span>
              <span class="hist-stat">${saldo < 0 ? "Faltou" : "Sobrou"}<strong class="${saldo < 0 ? "neg" : ""}">${fmt(Math.abs(saldo))}</strong></span>
            </div>
          </div>
        </div>`;
    })
    .join("");
  crescerBarras(el);
}

/* ============ Importar ============ */

function importarDados() {
  $("import-file").click();
}

function processarImport(ev) {
  const arquivo = ev.target.files[0];
  if (!arquivo) return;
  if (arquivo.name.toLowerCase().endsWith(".xlsx")) {
    importarExcel(arquivo);
    ev.target.value = "";
    return;
  }
  const leitor = new FileReader();
  leitor.onload = (e) => {
    try {
      const dados = JSON.parse(e.target.result);
      Object.entries(dados).forEach(([k, v]) => {
        if (k.startsWith("fluxo_")) {
          localStorage.setItem(k, v);
          marcarModificado(k);
        }
      });
      toast("Dados importados");
      renderTudo();
    } catch (err) {
      toast("Arquivo inválido: use uma planilha exportada pelo Meu Fluxo");
    }
  };
  leitor.readAsText(arquivo);
  ev.target.value = "";
}

/* ============ Lembrete de backup ============ */

const DIAS_LEMBRETE = 30;

function marcarBackup() {
  localStorage.setItem("meufluxo_ultimo_backup", String(Date.now()));
  verificarBackup();
}

function adiarBackup() {
  // Volta a lembrar em 7 dias
  localStorage.setItem("meufluxo_ultimo_backup", String(Date.now() - (DIAS_LEMBRETE - 7) * 864e5));
  verificarBackup();
}

function verificarBackup() {
  let ultimo = parseInt(localStorage.getItem("meufluxo_ultimo_backup"));
  if (!ultimo) {
    ultimo = Date.now();
    localStorage.setItem("meufluxo_ultimo_backup", String(ultimo));
  }
  const dias = Math.floor((Date.now() - ultimo) / 864e5);
  const aviso = $("aviso-backup");
  aviso.hidden = dias < DIAS_LEMBRETE || !mesesSalvos().length;
  $("aviso-backup-dias").textContent = dias;
}

/* ============ Dicas ao passar o mouse ============ */

(function () {
  const dica = $("dica");
  let alvo = null;
  document.addEventListener("pointerover", (e) => {
    const el = e.target.closest("[data-tip]");
    if (el === alvo) return;
    alvo = el;
    if (!el) return (dica.hidden = true);
    const sub = el.dataset.tipSub;
    dica.innerHTML = esc(el.dataset.tip) + (sub ? `<span>${esc(sub)}</span>` : "");
    const r = el.getBoundingClientRect();
    const x = Math.min(Math.max(r.left + r.width / 2, 90), innerWidth - 90);
    dica.style.left = x + "px";
    dica.style.top = r.top + "px";
    dica.hidden = false;
  });
  addEventListener("scroll", () => { dica.hidden = true; alvo = null; }, { passive: true });
})();

/* ============ App instalável (PWA) ============ */

let pedidoInstalar = null;

addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  pedidoInstalar = e;
  $("btn-instalar").hidden = false;
});

addEventListener("appinstalled", () => {
  pedidoInstalar = null;
  $("btn-instalar").hidden = true;
  toast("App instalado");
});

async function instalarApp() {
  if (!pedidoInstalar) return;
  pedidoInstalar.prompt();
  await pedidoInstalar.userChoice;
  pedidoInstalar = null;
  $("btn-instalar").hidden = true;
}

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch((e) => console.warn("Service worker não registrado", e));
}

// iPadOS se identifica como Mac, então também olhamos a tela de toque
function ehIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

// No iPhone não existe botão de instalar: mostra como adicionar à tela de início
const instalado = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
if (ehIOS() && !instalado && !localStorage.getItem("meufluxo_dica_iphone")) $("aviso-iphone").hidden = false;

function fecharDicaIphone() {
  localStorage.setItem("meufluxo_dica_iphone", "1");
  $("aviso-iphone").hidden = true;
}

/* ============ Início ============ */

// Espera renda.js, parcelas.js e excel.js carregarem
addEventListener("DOMContentLoaded", () => {
  aplicarTema(document.documentElement.dataset.theme || "dark");
  atualizarLabel();
  renderPainel();
  verificarBackup();
});
