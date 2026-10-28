// Renda configurável: cada conta descreve "como eu recebo" (fontes) e cada mês
// guarda os valores que valiam na época, para mudanças futuras não alterarem o passado.

const TIPOS_FONTE = {
  fixo: "Fixo no mês",
  proporcional: "Proporcional aos dias",
  dia: "Por dia trabalhado",
};

const ROTULO_VALOR = {
  fixo: "Valor no mês (R$)",
  proporcional: "Valor do mês cheio (R$)",
  dia: "Valor por dia (R$)",
};

const DIAS_UTEIS_PADRAO = 22;

// Como o app calculava antes (bolsa + vales por dia); usado nos meses antigos
const RENDA_ANTIGA = [
  { nome: "Bolsa auxílio", onde: "", tipo: "proporcional", base: 937.59 },
  { nome: "Vale-refeição", onde: "", tipo: "dia", base: 12 },
  { nome: "Vale-transporte", onde: "", tipo: "dia", base: 19.85 },
];

/* ============ Configuração ============ */

function temMesAntigo() {
  return mesesSalvos().some(({ d }) => !d.renda && d.diasTrabalhados > 0);
}

function getConfigRenda() {
  const salvo = localStorage.getItem("fluxo_renda");
  if (salvo) {
    try {
      return JSON.parse(salvo);
    } catch (e) {}
  }
  // Quem já usava o app começa com a configuração de antes, para nada mudar
  if (temMesAntigo()) {
    const cfg = { fontes: RENDA_ANTIGA.map(({ base, ...f }) => ({ ...f, valor: base })) };
    setConfigRenda(cfg);
    return cfg;
  }
  return { fontes: [] };
}

function setConfigRenda(cfg) {
  localStorage.setItem("fluxo_renda", JSON.stringify(cfg));
  marcarModificado("fluxo_renda");
}

function precisaDias(itens) {
  return itens.some((i) => i.tipo !== "fixo");
}

function calcularItem(tipo, base, dias, diasUteis) {
  if (tipo === "proporcional") return diasUteis > 0 ? (base / diasUteis) * dias : base;
  if (tipo === "dia") return base * dias;
  return base;
}

function arred(v) {
  return Math.round(v * 100) / 100;
}

/* ============ Renda de um mês ============ */

// Devolve as partes da renda do mês: as salvas, as de um mês antigo ou uma estimativa
function rendaDoMes(d) {
  if (d.renda) return { ...d.renda, salva: true };

  if (d.diasTrabalhados > 0) {
    const dias = d.diasTrabalhados;
    const valores = [d.bolsa, 12 * dias, 19.85 * dias];
    return {
      salva: true,
      diasTrabalhados: dias,
      diasUteis: d.diasUteis || DIAS_UTEIS_PADRAO,
      itens: RENDA_ANTIGA.map((f, i) => ({ ...f, valor: valores[i] })),
    };
  }

  // Ainda não salva: estima considerando o mês inteiro trabalhado
  const { fontes } = getConfigRenda();
  return {
    salva: false,
    diasTrabalhados: DIAS_UTEIS_PADRAO,
    diasUteis: DIAS_UTEIS_PADRAO,
    itens: fontes.map((f) => ({
      nome: f.nome,
      onde: f.onde,
      tipo: f.tipo,
      base: f.valor,
      valor: arred(calcularItem(f.tipo, f.valor, DIAS_UTEIS_PADRAO, DIAS_UTEIS_PADRAO)),
    })),
  };
}

// Só o que cai na conta (dinheiro) mais as outras entradas
function entradaDoMes(d) {
  const renda = rendaDoMes(d).itens.filter((i) => !i.onde).reduce((s, i) => s + i.valor, 0);
  return renda + d.entradas.reduce((s, e) => s + e.valor, 0);
}

/* ============ Cartões de benefício ============ */

function carteirasConhecidas() {
  const nomes = new Set(getConfigRenda().fontes.map((f) => f.onde).filter(Boolean));
  mesesSalvos().forEach(({ d }) => {
    (d.renda?.itens || []).forEach((i) => i.onde && nomes.add(i.onde));
    d.gastos.forEach((g) => g.pago && nomes.add(g.pago));
  });
  getParcelas().forEach((p) => p.pago && nomes.add(p.pago));
  return [...nomes];
}

// Saldo de cada cartão até o mês escolhido (o que sobra passa para o mês seguinte)
function saldosCarteiras(mes, ano) {
  const limite = ano * 12 + mes;
  const saldos = {};
  carteirasConhecidas().forEach((n) => (saldos[n] = { nome: n, saldo: 0, entrouMes: 0, gastouMes: 0 }));

  const porMes = new Map(mesesSalvos().map((m) => [m.ano * 12 + m.mes, m.d]));
  const indices = new Set([...porMes.keys(), limite]);
  getParcelas().forEach((p) => indices.add(p.inicio));

  for (const idx of indices) {
    if (idx > limite) continue;
    const d = porMes.get(idx) || mesVazio();
    const r = d.renda || (d.diasTrabalhados > 0 ? rendaDoMes(d) : null);
    const doMes = idx === limite;
    (r?.itens || []).forEach((i) => {
      if (!i.onde || !saldos[i.onde]) return;
      saldos[i.onde].saldo += i.valor;
      if (doMes) saldos[i.onde].entrouMes += i.valor;
    });
    gastosDoMes(idx % 12, Math.floor(idx / 12), d).forEach((g) => {
      if (!g.pago || !saldos[g.pago]) return;
      saldos[g.pago].saldo -= g.valor;
      if (doMes) saldos[g.pago].gastouMes += g.valor;
    });
  }
  // Meses sem nada salvo entre parcelas no cartão também contam
  getParcelas().forEach((p) => {
    if (!p.pago || !saldos[p.pago]) return;
    for (let k = 0; k < p.n; k++) {
      const idx = p.inicio + k;
      if (idx > limite || indices.has(idx)) continue;
      saldos[p.pago].saldo -= p.valor;
    }
  });
  return Object.values(saldos);
}

/* ============ Aba Renda ============ */

let rendaEditada = new Set(); // linhas que a pessoa ajustou à mão (não recalcula)
let rendaItens = [];

function renderRenda() {
  const d = getMes(mesAtual, anoAtual);
  const r = rendaDoMes(d);
  const cfg = getConfigRenda();
  $("renda-mes-sub").textContent = nomeMes(mesAtual, anoAtual);

  const semConfig = !cfg.fontes.length && !r.salva;
  $("r-vazio").hidden = !semConfig;
  $("r-calc").hidden = semConfig;

  if (!semConfig) {
    rendaEditada = new Set();
    rendaItens = r.itens.map((i) => ({ ...i }));
    $("r-situacao").textContent = r.salva ? "Salva" : "Estimativa";
    $("r-situacao").dataset.salva = r.salva ? "sim" : "nao";
    $("r-dias-campos").hidden = !precisaDias(rendaItens);
    $("r-dias-uteis").value = r.salva ? r.diasUteis || DIAS_UTEIS_PADRAO : DIAS_UTEIS_PADRAO;
    $("r-dias").value = r.salva ? r.diasTrabalhados || "" : DIAS_UTEIS_PADRAO;
    $("r-recalcular").hidden = !r.salva || !cfg.fontes.length;
    desenharLinhasRenda(!r.salva);
  }

  $("r-lista-extras").innerHTML = d.entradas.length
    ? [...d.entradas].reverse().map((e) => itemLancamento({ ...e, tipo: "entrada" }, true)).join("")
    : vazio("Freela, presente, 13º ou venda: o que entrar além da renda do mês vai aqui.");
}

function desenharLinhasRenda(recalcular) {
  if (recalcular) recalcularRenda(false);
  $("r-linhas").innerHTML = rendaItens
    .map(
      (i, n) => `
      <div class="r-linha">
        <label for="r-item-${n}">
          <span class="r-nome">${esc(i.nome)}</span>
          <span class="r-tipo">${TIPOS_FONTE[i.tipo] || ""}${i.onde ? `, no ${esc(i.onde)}` : ", na conta"}</span>
        </label>
        <input type="number" class="form-control r-valor" id="r-item-${n}" step="0.01" min="0" inputmode="decimal"
          value="${arred(i.valor)}" oninput="editarLinhaRenda(${n}, this.value)">
      </div>`,
    )
    .join("");
  atualizarTotaisRenda();
}

function recalcularRenda(redesenhar = true) {
  const dias = parseInt($("r-dias").value) || 0;
  const diasUteis = parseInt($("r-dias-uteis").value) || DIAS_UTEIS_PADRAO;
  rendaItens.forEach((i, n) => {
    if (rendaEditada.has(n)) return;
    i.valor = arred(calcularItem(i.tipo, i.base, dias, diasUteis));
    if (redesenhar && $("r-item-" + n)) $("r-item-" + n).value = i.valor;
  });
  atualizarTotaisRenda();
}

function editarLinhaRenda(n, valor) {
  rendaEditada.add(n);
  rendaItens[n].valor = parseFloat(valor) || 0;
  atualizarTotaisRenda();
}

function atualizarTotaisRenda() {
  const totais = {};
  rendaItens.forEach((i) => (totais[i.onde] = (totais[i.onde] || 0) + i.valor));
  const conta = totais[""] || 0;
  delete totais[""];
  const extras = getMes(mesAtual, anoAtual).entradas.reduce((s, e) => s + e.valor, 0);
  const cartoes = Object.entries(totais);
  $("r-totais").innerHTML =
    `<div class="recibo-linha"><span>Renda do mês</span><span class="num">${fmt(conta)}</span></div>` +
    `<div class="recibo-linha"><span>Outras entradas</span><span class="num">${fmt(extras)}</span></div>` +
    `<div class="recibo-total"><span>Total na conta</span><span class="num">${fmt(conta + extras)}</span></div>` +
    (cartoes.length
      ? `<p class="recibo-sub">Nos cartões (não entra no "Sobrou")</p>` +
        cartoes.map(([n, v]) => `<div class="recibo-linha"><span>${esc(n)}</span><span class="num">${fmt(v)}</span></div>`).join("")
      : "");
}

// Refaz as linhas do mês a partir de "como eu recebo" de hoje
function usarConfigAtual() {
  const dias = parseInt($("r-dias").value) || 0;
  const diasUteis = parseInt($("r-dias-uteis").value) || DIAS_UTEIS_PADRAO;
  rendaEditada = new Set();
  rendaItens = getConfigRenda().fontes.map((f) => ({
    nome: f.nome,
    onde: f.onde,
    tipo: f.tipo,
    base: f.valor,
    valor: arred(calcularItem(f.tipo, f.valor, dias, diasUteis)),
  }));
  $("r-dias-campos").hidden = !precisaDias(rendaItens);
  desenharLinhasRenda(false);
}

function salvarRenda() {
  const dias = parseInt($("r-dias").value) || 0;
  const diasUteis = parseInt($("r-dias-uteis").value) || DIAS_UTEIS_PADRAO;
  if (precisaDias(rendaItens) && !dias) return toast("Informe os dias trabalhados");
  const d = getMes(mesAtual, anoAtual);
  d.renda = {
    diasUteis: precisaDias(rendaItens) ? diasUteis : null,
    diasTrabalhados: precisaDias(rendaItens) ? dias : null,
    itens: rendaItens.map((i) => ({ ...i, valor: arred(i.valor) })),
  };
  delete d.bolsa;
  delete d.diasTrabalhados;
  delete d.diasUteis;
  setMes(mesAtual, anoAtual, d);
  toast("Renda do mês salva");
  renderRenda();
}

/* ============ Janela "Como eu recebo" ============ */

let cfgRascunho = [];

function abrirConfigRenda() {
  cfgRascunho = getConfigRenda().fontes.map((f) => ({ ...f }));
  if (!cfgRascunho.length) cfgRascunho.push({ nome: "", onde: "", tipo: "fixo", valor: "" });
  desenharConfigRenda();
  bootstrap.Modal.getOrCreateInstance($("modal-renda")).show();
}

function desenharConfigRenda() {
  const cartoes = [...new Set([...carteirasConhecidas(), ...cfgRascunho.map((f) => f.onde).filter(Boolean)])];
  $("cfg-fontes").innerHTML = cfgRascunho
    .map((f, n) => {
      const opcoesOnde =
        `<option value="">Na conta (dinheiro)</option>` +
        cartoes.map((c) => `<option value="${esc(c)}" ${f.onde === c ? "selected" : ""}>No cartão ${esc(c)}</option>`).join("") +
        `<option value="__novo">Em outro cartão…</option>`;
      return `
        <fieldset class="cfg-fonte">
          <legend class="visually-hidden">Parte ${n + 1}</legend>
          <div class="cfg-linha cfg-topo">
            <div class="cfg-nome">
              <label class="form-label" for="cfg-nome-${n}">Nome</label>
              <input class="form-control" id="cfg-nome-${n}" value="${esc(f.nome)}" placeholder="Ex: Salário, Ticket, Bolsa"
                oninput="cfgRascunho[${n}].nome = this.value">
            </div>
            <button type="button" class="lanc-del" onclick="removerFonte(${n})" aria-label="Remover ${esc(f.nome || "parte")}"><svg class="ic"><use href="#i-x"/></svg></button>
          </div>
          <div class="cfg-linha">
            <div>
              <label class="form-label" for="cfg-tipo-${n}">Como calcula</label>
              <select class="form-select" id="cfg-tipo-${n}" onchange="cfgRascunho[${n}].tipo = this.value; desenharConfigRenda()">
                ${Object.entries(TIPOS_FONTE).map(([k, t]) => `<option value="${k}" ${f.tipo === k ? "selected" : ""}>${t}</option>`).join("")}
              </select>
            </div>
            <div>
              <label class="form-label" for="cfg-valor-${n}">${ROTULO_VALOR[f.tipo]}</label>
              <input type="number" class="form-control" id="cfg-valor-${n}" value="${f.valor}" min="0" step="0.01" inputmode="decimal"
                oninput="cfgRascunho[${n}].valor = parseFloat(this.value) || 0">
            </div>
          </div>
          <div>
            <label class="form-label" for="cfg-onde-${n}">Onde cai</label>
            <select class="form-select" id="cfg-onde-${n}" onchange="mudarOnde(${n}, this.value)">${opcoesOnde}</select>
          </div>
        </fieldset>`;
    })
    .join("");
}

function mudarOnde(n, valor) {
  if (valor === "__novo") {
    const nome = (prompt("Nome do cartão (ex: Ticket, VR, Passe)") || "").trim();
    if (nome) cfgRascunho[n].onde = nome;
  } else {
    cfgRascunho[n].onde = valor;
  }
  desenharConfigRenda();
}

function adicionarFonte() {
  cfgRascunho.push({ nome: "", onde: "", tipo: "fixo", valor: "" });
  desenharConfigRenda();
  $("cfg-nome-" + (cfgRascunho.length - 1)).focus();
}

function removerFonte(n) {
  cfgRascunho.splice(n, 1);
  desenharConfigRenda();
}

function salvarConfigRenda() {
  const fontes = cfgRascunho
    .map((f) => ({ nome: f.nome.trim(), onde: f.onde, tipo: f.tipo, valor: parseFloat(f.valor) || 0 }))
    .filter((f) => f.nome || f.valor);
  const semNome = fontes.find((f) => !f.nome);
  if (semNome) return toast("Dê um nome para cada parte da renda");
  setConfigRenda({ fontes });
  bootstrap.Modal.getInstance($("modal-renda"))?.hide();
  toast("Pronto. Vale do mês atual em diante");
  renderTudo();
}
