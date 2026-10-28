// Categorias de gasto: um catálogo padrão com ícones, e cada conta escolhe as que usa
// e pode criar as próprias. Os gastos guardam o nome da categoria.

// Ícones no estilo traço (24×24). Viram <symbol id="ci-nome"> na página.
const ICONES = {
  talheres: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  carrinho: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  moto: '<circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>',
  onibus: '<path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>',
  casa: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  remedio: '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>',
  brilho: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/>',
  camiseta: '<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>',
  ingresso: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>',
  tv: '<rect width="20" height="15" x="2" y="7" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/>',
  formatura: '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  presente: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>',
  pata: '<circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/>',
  monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
  controle: '<path d="M6 11h4"/><path d="M8 9v4"/><path d="M15 12h.01"/><path d="M18 10h.01"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/>',
  caixa: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"/><path d="m7.5 4.27 9 5.15"/>',
  coracao: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  cafe: '<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>',
  pizza: '<path d="M15 11h.01"/><path d="M11 15h.01"/><path d="M16 16h.01"/><path d="m2 16 20 6-6-20A20 20 0 0 0 2 16"/><path d="M5.71 17.11a17.04 17.04 0 0 1 11.4-11.4"/>',
  bolo: '<path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v3"/><path d="M12 8v3"/><path d="M17 8v3"/>',
  haltere: '<path d="M6.5 6v12"/><path d="M17.5 6v12"/><path d="M3.5 9v6"/><path d="M20.5 9v6"/><path d="M6.5 12h11"/><path d="M3.5 9h3M3.5 15h3M17.5 9h3M17.5 15h3"/>',
  aviao: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  carro: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
  combustivel: '<path d="M3 22h12"/><path d="M4 9h10"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2 2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/>',
  musica: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  tesoura: '<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>',
  paleta: '<circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/><circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
  celular: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
  ferramenta: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  livro: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  folha: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  bebe: '<path d="M9 12h.01"/><path d="M15 12h.01"/><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1"/>',
  etiqueta: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r="1"/>',
};

// Cores da paleta validada para daltonismo (definidas no CSS, versão clara e escura)
const CORES = ["azul", "laranja", "agua", "amarelo", "magenta", "verde", "violeta", "vermelho"];

const CATALOGO = [
  { nome: "Alimentação", icone: "talheres", cor: "agua" },
  { nome: "Mercado", icone: "carrinho", cor: "verde" },
  { nome: "Delivery", icone: "moto", cor: "vermelho" },
  { nome: "Transporte", icone: "onibus", cor: "amarelo" },
  { nome: "Casa e contas", icone: "casa", cor: "azul" },
  { nome: "Saúde e farmácia", icone: "remedio", cor: "vermelho" },
  { nome: "Beleza e cuidados", icone: "brilho", cor: "magenta" },
  { nome: "Roupas", icone: "camiseta", cor: "magenta" },
  { nome: "Lazer", icone: "ingresso", cor: "laranja" },
  { nome: "Assinaturas", icone: "tv", cor: "violeta" },
  { nome: "Estudos", icone: "formatura", cor: "azul" },
  { nome: "Presentes", icone: "presente", cor: "laranja" },
  { nome: "Pets", icone: "pata", cor: "amarelo" },
  { nome: "Setup/Tech", icone: "monitor", cor: "azul" },
  { nome: "Games", icone: "controle", cor: "violeta" },
  { nome: "Outros", icone: "caixa", cor: "cinza" },
];

// Quem já usava o app continua com as categorias de antes; conta nova ganha uma lista geral
const ATIVAS_ANTIGAS = ["Setup/Tech", "Games", "Alimentação", "Transporte", "Roupas", "Lazer", "Outros"];
const ATIVAS_PADRAO = ["Alimentação", "Mercado", "Delivery", "Transporte", "Casa e contas", "Saúde e farmácia", "Beleza e cuidados", "Roupas", "Lazer", "Assinaturas", "Outros"];

// Coloca os ícones na página uma vez
(function () {
  const defs = document.querySelector("svg defs");
  defs.insertAdjacentHTML(
    "beforeend",
    Object.entries(ICONES).map(([id, corpo]) => `<symbol id="ci-${id}" viewBox="0 0 24 24">${corpo}</symbol>`).join(""),
  );
})();

/* ============ Configuração da conta ============ */

function getCategorias() {
  const salvo = localStorage.getItem("fluxo_categorias");
  if (salvo) {
    try {
      return JSON.parse(salvo);
    } catch (e) {}
  }
  if (mesesSalvos().length || getParcelas().length) {
    const cfg = { ativas: ATIVAS_ANTIGAS, proprias: [] };
    setCategorias(cfg);
    return cfg;
  }
  return { ativas: ATIVAS_PADRAO, proprias: [] };
}

function setCategorias(cfg) {
  localStorage.setItem("fluxo_categorias", JSON.stringify(cfg));
  marcarModificado("fluxo_categorias");
}

function infoCat(nome) {
  const { proprias } = getCategorias();
  return (
    CATALOGO.find((c) => c.nome === nome) ||
    proprias.find((c) => c.nome === nome) || { nome, icone: "etiqueta", cor: "cinza" }
  );
}

// As categorias que aparecem para escolher, com "Outros" sempre no fim
function categoriasEmUso() {
  const { ativas, proprias } = getCategorias();
  const lista = [...CATALOGO.filter((c) => c.nome !== "Outros" && ativas.includes(c.nome)), ...proprias];
  return [...lista, CATALOGO.find((c) => c.nome === "Outros")];
}

function corCat(nome) {
  return `var(--c-${infoCat(nome).cor})`;
}

function iconeCat(nome, classe = "lanc-icone") {
  const c = infoCat(nome);
  return `<div class="${classe}" style="--cor:var(--c-${c.cor})" aria-hidden="true"><svg class="ic"><use href="#ci-${c.icone}"/></svg></div>`;
}

/* ============ Escolher a categoria (botões) ============ */

// Desenha os botões de categoria e guarda a escolha no campo escondido (#g-cat, #p-cat)
function desenharEscolhaCat(prefixo) {
  const campo = $(prefixo + "-cat");
  const cats = categoriasEmUso();
  if (!cats.some((c) => c.nome === campo.value)) campo.value = cats[0].nome;
  $(prefixo + "-cat-escolha").innerHTML = cats
    .map(
      (c) => `
      <button type="button" class="cat-chip" role="radio" aria-checked="${c.nome === campo.value}" style="--cor:var(--c-${c.cor})"
        onclick="escolherCat('${prefixo}', this)" data-nome="${esc(c.nome)}">
        <svg class="ic"><use href="#ci-${c.icone}"/></svg>${esc(c.nome)}
      </button>`,
    )
    .join("");
}

function escolherCat(prefixo, botao) {
  $(prefixo + "-cat").value = botao.dataset.nome;
  $(prefixo + "-cat-escolha")
    .querySelectorAll(".cat-chip")
    .forEach((b) => b.setAttribute("aria-checked", String(b === botao)));
}

/* ============ Janela "Minhas categorias" ============ */

let catRascunho = null;
let iconeEscolhido = "coracao";

function abrirCategorias() {
  const { ativas, proprias } = getCategorias();
  catRascunho = { ativas: [...ativas], proprias: proprias.map((p) => ({ ...p })) };
  $("cat-nova-nome").value = "";
  desenharCategorias();
  bootstrap.Modal.getOrCreateInstance($("modal-categorias")).show();
}

function desenharCategorias() {
  $("cat-catalogo").innerHTML = CATALOGO.map((c) => {
    const ligada = c.nome === "Outros" || catRascunho.ativas.includes(c.nome);
    return `
      <button type="button" class="cat-chip" aria-pressed="${ligada}" style="--cor:var(--c-${c.cor})"
        ${c.nome === "Outros" ? 'disabled title="Outros fica sempre disponível"' : ""}
        onclick="alternarCategoria('${esc(c.nome)}')">
        <svg class="ic"><use href="#ci-${c.icone}"/></svg>${esc(c.nome)}
      </button>`;
  }).join("");

  $("cat-proprias").innerHTML = catRascunho.proprias.length
    ? catRascunho.proprias
        .map(
          (c, n) => `
        <span class="cat-chip cat-propria" style="--cor:var(--c-${c.cor})">
          <svg class="ic"><use href="#ci-${c.icone}"/></svg>${esc(c.nome)}
          <button type="button" class="cat-remover" onclick="removerCategoria(${n})" aria-label="Remover ${esc(c.nome)}"><svg class="ic"><use href="#i-x"/></svg></button>
        </span>`,
        )
        .join("")
    : `<p class="cat-vazio">Nenhuma ainda. Crie abaixo.</p>`;

  $("cat-icones").innerHTML = Object.keys(ICONES)
    .filter((i) => i !== "etiqueta")
    .map(
      (i) => `
      <button type="button" class="icone-opcao" role="radio" aria-checked="${i === iconeEscolhido}" aria-label="${i}"
        onclick="iconeEscolhido='${i}'; desenharCategorias()"><svg class="ic"><use href="#ci-${i}"/></svg></button>`,
    )
    .join("");
}

function alternarCategoria(nome) {
  const i = catRascunho.ativas.indexOf(nome);
  if (i >= 0) catRascunho.ativas.splice(i, 1);
  else catRascunho.ativas.push(nome);
  desenharCategorias();
}

function criarCategoria() {
  const nome = $("cat-nova-nome").value.trim();
  if (!nome) return toast("Dê um nome para a categoria");
  const existe = [...CATALOGO, ...catRascunho.proprias].some((c) => semAcentoCat(c.nome) === semAcentoCat(nome));
  if (existe) return toast("Já existe uma categoria com esse nome");
  const cor = CORES[catRascunho.proprias.length % CORES.length];
  catRascunho.proprias.push({ nome, icone: iconeEscolhido, cor });
  $("cat-nova-nome").value = "";
  desenharCategorias();
}

function removerCategoria(n) {
  catRascunho.proprias.splice(n, 1);
  desenharCategorias();
}

function salvarCategorias() {
  setCategorias({ ativas: catRascunho.ativas.filter((n) => n !== "Outros").concat("Outros"), proprias: catRascunho.proprias });
  bootstrap.Modal.getInstance($("modal-categorias"))?.hide();
  toast("Categorias salvas");
  renderTudo();
}

function semAcentoCat(s) {
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}
