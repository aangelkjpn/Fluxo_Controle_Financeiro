// Compras parceladas: cada parcela entra sozinha nos gastos de cada mês do parcelamento.
// Uma parcela: { id, desc, valor (por parcela), n (quantidade), inicio (ano * 12 + mês), cat, pago }

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function idxMes(mes, ano) {
  return ano * 12 + mes;
}

function nomeIdx(idx) {
  return `${MESES_CURTOS[idx % 12]} ${Math.floor(idx / 12)}`;
}

function getParcelas() {
  try {
    return JSON.parse(localStorage.getItem("fluxo_parcelas") || "[]");
  } catch (e) {
    return [];
  }
}

function setParcelas(lista) {
  localStorage.setItem("fluxo_parcelas", JSON.stringify(lista));
  marcarModificado("fluxo_parcelas");
}

// As parcelas daquele mês, no mesmo formato de um gasto
function parcelasDoMes(mes, ano) {
  const idx = idxMes(mes, ano);
  return getParcelas()
    .filter((p) => idx >= p.inicio && idx < p.inicio + p.n)
    .map((p) => ({
      id: `p${p.id}_${idx - p.inicio}`,
      desc: p.desc,
      valor: p.valor,
      cat: p.cat,
      pago: p.pago || "",
      parcela: { num: idx - p.inicio + 1, de: p.n },
    }));
}

function gastosDoMes(mes, ano, d = getMes(mes, ano)) {
  return [...d.gastos, ...parcelasDoMes(mes, ano)];
}

function totalParcelas(mes, ano) {
  return parcelasDoMes(mes, ano).reduce((s, p) => s + p.valor, 0);
}

/* ============ Formulário ============ */

function abrirFormParcela() {
  const aberto = !$("p-form").hidden;
  $("p-form").hidden = aberto;
  $("p-abrir").setAttribute("aria-expanded", String(!aberto));
  if (!aberto) {
    $("p-inicio").value = `${anoAtual}-${String(mesAtual + 1).padStart(2, "0")}`;
    atualizarPreviaParcela();
    $("p-desc").focus();
  }
}

function lerFormParcela() {
  const [ano, mes] = ($("p-inicio").value || "").split("-").map(Number);
  return {
    desc: $("p-desc").value.trim(),
    valor: parseFloat($("p-valor").value) || 0,
    n: parseInt($("p-n").value) || 0,
    inicio: ano ? idxMes(mes - 1, ano) : idxMes(mesAtual, anoAtual),
    cat: $("p-cat").value,
    pago: $("p-pago").value || "",
  };
}

function atualizarPreviaParcela() {
  const p = lerFormParcela();
  $("p-previa").textContent =
    p.valor && p.n > 0
      ? `Total da compra: ${fmt(p.valor * p.n)}. Última parcela em ${nomeIdx(p.inicio + p.n - 1)}.`
      : "";
}

function addParcela() {
  const p = lerFormParcela();
  if (!p.desc || !p.valor || p.n < 1) return toast("Preencha a descrição, o valor e o número de parcelas");
  setParcelas([...getParcelas(), { id: Date.now(), ...p }]);
  ["p-desc", "p-valor", "p-n"].forEach((id) => ($(id).value = ""));
  $("p-form").hidden = true;
  $("p-abrir").setAttribute("aria-expanded", "false");
  toast("Parcela adicionada");
  renderGastos();
}

function encerrarParcela(id) {
  const p = getParcelas().find((x) => x.id === id);
  const idx = idxMes(mesAtual, anoAtual);
  if (!p || !confirm(`Encerrar "${p.desc}"? As parcelas depois de ${nomeIdx(idx)} deixam de contar.`)) return;
  setParcelas(
    getParcelas()
      .map((x) => (x.id === id ? { ...x, n: idx - x.inicio + 1 } : x))
      .filter((x) => x.n > 0),
  );
  toast("Parcela encerrada");
  renderGastos();
}

function excluirParcela(id) {
  const p = getParcelas().find((x) => x.id === id);
  if (!p || !confirm(`Excluir "${p.desc}"? Ela sai de todos os meses, inclusive dos anteriores.`)) return;
  setParcelas(getParcelas().filter((x) => x.id !== id));
  toast("Parcela excluída");
  renderGastos();
}

/* ============ Listas ============ */

function linhaParcela(p, idx) {
  const fim = p.inicio + p.n - 1;
  let situacao;
  if (idx < p.inicio) situacao = `Começa em ${nomeIdx(p.inicio)}, ${p.n}x`;
  else if (idx > fim) situacao = `Terminou em ${nomeIdx(fim)}, ${p.n}x`;
  else situacao = `Parcela ${idx - p.inicio + 1} de ${p.n}, termina em ${nomeIdx(fim)}`;
  const ativa = idx <= fim;
  return `
    <div class="lanc-item parcela-item">
      ${iconeCat(p.cat)}
      <div class="lanc-info">
        <span class="lanc-desc">${esc(p.desc)}${p.pago ? ` <span class="pill">${esc(p.pago)}</span>` : ""}</span>
        <span class="lanc-cat">${situacao}</span>
        ${ativa ? `<div class="parcela-trilho"><div style="width:${(Math.max(0, Math.min(idx - p.inicio + 1, p.n)) / p.n) * 100}%"></div></div>` : ""}
      </div>
      <div class="parcela-valores">
        <span class="lanc-val saida">${fmt(p.valor)}<small>/mês</small></span>
        <span class="parcela-acoes">
          ${ativa && idx >= p.inicio && idx < fim ? `<button class="link-btn link-discreto" onclick="encerrarParcela(${p.id})">Encerrar</button>` : ""}
          <button class="link-btn link-perigo" onclick="excluirParcela(${p.id})">Excluir</button>
        </span>
      </div>
    </div>`;
}

function renderParcelas() {
  const idx = idxMes(mesAtual, anoAtual);
  const todas = getParcelas().sort((a, b) => a.inicio + a.n - (b.inicio + b.n));
  const ativas = todas.filter((p) => idx >= p.inicio && idx < p.inicio + p.n);
  const futuras = todas.filter((p) => idx < p.inicio);
  const encerradas = todas.filter((p) => idx >= p.inicio + p.n);
  const total = ativas.reduce((s, p) => s + p.valor, 0);

  $("p-total").innerHTML = ativas.length
    ? `<strong>${fmt(total)}</strong> em ${MESES[mesAtual].toLowerCase()}`
    : "";
  $("p-lista").innerHTML =
    (ativas.length || futuras.length
      ? [...ativas, ...futuras].map((p) => linhaParcela(p, idx)).join("")
      : vazio("Nenhuma parcela correndo neste mês.")) +
    (encerradas.length
      ? `<details class="parcelas-encerradas"><summary>Ver ${encerradas.length} encerrada${encerradas.length > 1 ? "s" : ""}</summary>
          <div class="lancamentos-lista">${encerradas.map((p) => linhaParcela(p, idx)).join("")}</div></details>`
      : "");

  // "Pago com" só aparece para quem tem cartões
  preencherPagoCom($("p-pago"), $("p-pago-campo"));
  desenharEscolhaCat("p");
}

/* ============ Painel ============ */

function renderParcelasPainel() {
  const idx = idxMes(mesAtual, anoAtual);
  const proximos = Array.from({ length: 6 }, (_, k) => {
    const i = idx + k;
    return { idx: i, total: totalParcelas(i % 12, Math.floor(i / 12)) };
  });
  const bloco = $("p-parcelas-bloco");
  bloco.hidden = !proximos.some((m) => m.total);
  if (bloco.hidden) return;

  const agora = proximos[0].total;
  const qtd = parcelasDoMes(mesAtual, anoAtual).length;
  const queda = proximos.find((m, k) => k > 0 && m.total < proximos[k - 1].total);
  const maior = Math.max(...proximos.map((m) => m.total)) || 1;

  $("p-parcelas-resumo").innerHTML = `
    <span class="grande">${fmt(agora)}</span>
    <span class="pequeno">${qtd ? `em ${qtd} compra${qtd > 1 ? "s" : ""} parcelada${qtd > 1 ? "s" : ""} neste mês` : "nenhuma parcela neste mês"}${
      !queda ? "." : queda.total ? `. Em ${nomeIdx(queda.idx)} cai para ${fmt(queda.total)}.` : `. A partir de ${nomeIdx(queda.idx)}, nenhuma parcela.`
    }</span>`;

  $("p-parcelas-grafico").innerHTML = proximos
    .map((m, k) => {
      const h = (m.total / maior) * 100;
      return `
        <div class="col-mes">
          <div class="col-trilho"><div class="col-barra ${k === 0 ? "atual" : ""}" data-h="${h}" style="height:${animar ? 0 : h}%"
            data-tip="${nomeIdx(m.idx)}: ${fmt(m.total)}" data-tip-sub="em parcelas"></div></div>
          <span class="col-rotulo">${MESES_CURTOS[m.idx % 12]}</span>
        </div>`;
    })
    .join("");
  if (animar) {
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        document.querySelectorAll("#p-parcelas-grafico [data-h]").forEach((b) => (b.style.height = b.dataset.h + "%")),
      ),
    );
  }
}
