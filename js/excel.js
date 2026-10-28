// Exportar e importar a planilha Excel do Meu Fluxo.
// A importação lê as colunas pelo nome do cabeçalho, então planilhas de versões antigas também funcionam.

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const FMT_REAL = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
const COR_CABECALHO = "FF1E2535";

/* ============ Montar a planilha ============ */

function estilizarCabecalho(linha) {
  linha.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR_CABECALHO } };
    c.alignment = { vertical: "middle" };
  });
  linha.height = 20;
}

function novaAba(wb, nome, colunas) {
  const aba = wb.addWorksheet(nome, { views: [{ state: "frozen", ySplit: 1 }] });
  aba.columns = colunas.map(([header, width, numFmt]) => ({ header, width, style: numFmt ? { numFmt } : {} }));
  estilizarCabecalho(aba.getRow(1));
  aba.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colunas.length } };
  return aba;
}

// No iPhone abre a folha de compartilhar ("Salvar em Arquivos"); nos outros, baixa
async function baixarArquivo(blob, nome) {
  if (ehIOS() && navigator.canShare) {
    const arquivo = new File([blob], nome, { type: blob.type });
    if (navigator.canShare({ files: [arquivo] })) {
      try {
        return void (await navigator.share({ files: [arquivo] }));
      } catch (e) {
        if (e.name === "AbortError") return;
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: nome });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

const textoOnde = (onde) => onde || "Conta";

async function exportarExcel() {
  if (typeof ExcelJS === "undefined") return toast("O gerador de Excel não carregou. Recarregue a página.");
  const meses = mesesSalvos();
  const parcelas = getParcelas();
  const config = getConfigRenda();
  if (!meses.length && !getMeta() && !parcelas.length && !config.fontes.length) return toast("Nenhum dado para exportar");

  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = "Meu Fluxo";
    wb.created = new Date();

    const resumo = novaAba(wb, "Resumo", [
      ["Mês", 18], ["Entrou", 15, FMT_REAL], ["Gastou", 15, FMT_REAL], ["Em parcelas", 15, FMT_REAL],
      ["Guardou", 15, FMT_REAL], ["Saldo", 15, FMT_REAL],
    ]);
    meses.forEach(({ mes, ano, d }) => {
      const entrou = entradaDoMes(d);
      const gastou = gastoDoMes(mes, ano, d);
      const reserva = d.reserva || 0;
      resumo.addRow([nomeMes(mes, ano), entrou, gastou, totalParcelas(mes, ano), reserva, entrou - gastou - reserva]);
    });
    if (meses.length) {
      const ultima = meses.length + 1;
      resumo.addRow(["Total", ...["B", "C", "D", "E", "F"].map((c) => ({ formula: `SUM(${c}2:${c}${ultima})` }))]).font = { bold: true };
    }

    const lanc = novaAba(wb, "Lançamentos", [
      ["Ano", 7], ["Mês", 12], ["Tipo", 10], ["Descrição", 34], ["Categoria", 14], ["Pago com", 14], ["Valor", 14, FMT_REAL],
    ]);
    meses.forEach(({ mes, ano, d }) => {
      d.entradas.forEach((e) => lanc.addRow([ano, MESES[mes], "Entrada", e.desc, "", "Conta", e.valor]));
      d.gastos.forEach((g) => lanc.addRow([ano, MESES[mes], "Gasto", g.desc, g.cat, textoOnde(g.pago), g.valor]));
    });

    const renda = novaAba(wb, "Renda", [
      ["Ano", 7], ["Mês", 12], ["Parte", 22], ["Como calcula", 22], ["Onde cai", 14],
      ["Valor base", 14, FMT_REAL], ["Valor", 14, FMT_REAL], ["Dias úteis", 11], ["Dias trabalhados", 17],
    ]);
    meses.forEach(({ mes, ano, d }) => {
      const r = rendaDoMes(d);
      if (!r.salva) return;
      r.itens.forEach((i) =>
        renda.addRow([ano, MESES[mes], i.nome, TIPOS_FONTE[i.tipo], textoOnde(i.onde), i.base, i.valor, r.diasUteis || null, r.diasTrabalhados || null]),
      );
    });

    const abaMeses = novaAba(wb, "Meses", [["Ano", 7], ["Mês", 12], ["Reserva", 14, FMT_REAL]]);
    meses.forEach(({ mes, ano, d }) => abaMeses.addRow([ano, MESES[mes], d.reserva || 0]));

    const abaParcelas = novaAba(wb, "Parcelas", [
      ["Descrição", 30], ["Categoria", 14], ["Pago com", 14], ["Valor da parcela", 16, FMT_REAL],
      ["Nº de parcelas", 15], ["Primeira parcela (mês)", 21], ["Primeira parcela (ano)", 21], ["Total", 14, FMT_REAL],
    ]);
    parcelas.forEach((p) =>
      abaParcelas.addRow([p.desc, p.cat, textoOnde(p.pago), p.valor, p.n, MESES[p.inicio % 12], Math.floor(p.inicio / 12), p.valor * p.n]),
    );

    const abaConfig = novaAba(wb, "Como eu recebo", [["Parte", 22], ["Como calcula", 22], ["Onde cai", 14], ["Valor", 14, FMT_REAL]]);
    config.fontes.forEach((f) => abaConfig.addRow([f.nome, TIPOS_FONTE[f.tipo], textoOnde(f.onde), f.valor]));

    const { ativas, proprias } = getCategorias();
    const abaCats = novaAba(wb, "Categorias", [["Categoria", 22], ["Ícone", 14], ["Cor", 12], ["Tipo", 16], ["Em uso", 10]]);
    CATALOGO.forEach((c) => abaCats.addRow([c.nome, c.icone, c.cor, "Padrão", c.nome === "Outros" || ativas.includes(c.nome) ? "Sim" : "Não"]));
    proprias.forEach((c) => abaCats.addRow([c.nome, c.icone, c.cor, "Criada por mim", "Sim"]));

    const ajustes = wb.addWorksheet("Configurações");
    ajustes.columns = [{ width: 28 }, { width: 14, style: { numFmt: FMT_REAL } }];
    estilizarCabecalho(ajustes.addRow(["Configuração", "Valor"]));
    ajustes.addRow(["Meta mensal de reserva", getMeta()]);

    const buffer = await wb.xlsx.writeBuffer();
    await baixarArquivo(new Blob([buffer], { type: XLSX_MIME }), `MeuFluxo_${new Date().toISOString().slice(0, 10)}.xlsx`);
    marcarBackup();
    toast(ehIOS() ? "Planilha gerada" : "Planilha gerada! Confira a pasta Downloads.");
  } catch (e) {
    console.error(e);
    toast("Não foi possível gerar a planilha");
  }
}

/* ============ Ler a planilha ============ */

function valorCelula(celula) {
  const v = celula.value;
  if (v && typeof v === "object") {
    if ("result" in v) return v.result;
    if (v.richText) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return v.text;
  }
  return v;
}

function numero(v) {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return NaN;
  const limpo = v.replace(/[R$\s]/g, "");
  return parseFloat(limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo);
}

const semAcento = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

function indiceMes(v) {
  const n = numero(v);
  if (Number.isInteger(n)) return n >= 1 && n <= 12 ? n - 1 : -1;
  return MESES.findIndex((m) => semAcento(m) === semAcento(v));
}

// Cada linha vira um objeto com as colunas pelo nome: linha.get("Valor")
function lerAba(aba) {
  if (!aba) return [];
  const cab = [];
  aba.getRow(1).eachCell({ includeEmpty: true }, (c, i) => (cab[i] = semAcento(valorCelula(c))));
  const linhas = [];
  aba.eachRow((row, n) => {
    if (n === 1) return;
    const vals = {};
    cab.forEach((nome, i) => nome && (vals[nome] = valorCelula(row.getCell(i))));
    linhas.push({ tem: (k) => semAcento(k) in vals, get: (k) => vals[semAcento(k)] });
  });
  return linhas;
}

const ondeDeTexto = (t) => (!t || semAcento(t) === "conta" ? "" : String(t).trim());

function tipoDeTexto(t) {
  const s = semAcento(t);
  return Object.keys(TIPOS_FONTE).find((k) => k === s || semAcento(TIPOS_FONTE[k]) === s) || "fixo";
}

async function importarExcel(arquivo) {
  if (typeof ExcelJS === "undefined") return toast("O leitor de Excel não carregou. Recarregue a página.");
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await arquivo.arrayBuffer());
    const aba = (nome) => wb.getWorksheet(nome);
    const abas = ["Meses", "Lançamentos", "Renda", "Parcelas", "Como eu recebo", "Categorias"];
    if (!abas.some((n) => aba(n))) return toast("Planilha inválida: use uma exportada pelo Meu Fluxo");

    const novos = {};
    let ignoradas = 0;
    const mesDe = (ano, mes) => {
      const m = indiceMes(mes);
      const a = numero(ano);
      if (m < 0 || !Number.isInteger(a)) return null;
      const k = keyMes(m, a);
      return (novos[k] ||= mesVazio());
    };

    lerAba(aba("Meses")).forEach((l) => {
      const d = mesDe(l.get("Ano"), l.get("Mês"));
      if (!d) return ignoradas++;
      d.reserva = numero(l.get("Reserva")) || 0;
      // Planilhas antigas: bolsa e dias ficavam aqui
      if (l.tem("Bolsa") && numero(l.get("Dias trabalhados")) > 0) {
        d.diasTrabalhados = numero(l.get("Dias trabalhados"));
        if (numero(l.get("Dias úteis"))) d.diasUteis = numero(l.get("Dias úteis"));
        if (!isNaN(numero(l.get("Bolsa")))) d.bolsa = numero(l.get("Bolsa"));
      }
    });

    lerAba(aba("Renda")).forEach((l) => {
      const d = mesDe(l.get("Ano"), l.get("Mês"));
      const valor = numero(l.get("Valor"));
      const nome = String(l.get("Parte") ?? "").trim();
      if (!d || !nome || isNaN(valor)) return ignoradas++;
      d.renda ||= {
        diasUteis: numero(l.get("Dias úteis")) || null,
        diasTrabalhados: numero(l.get("Dias trabalhados")) || null,
        itens: [],
      };
      const base = numero(l.get("Valor base"));
      d.renda.itens.push({ nome, tipo: tipoDeTexto(l.get("Como calcula")), onde: ondeDeTexto(l.get("Onde cai")), base: isNaN(base) ? valor : base, valor });
      delete d.bolsa;
      delete d.diasTrabalhados;
      delete d.diasUteis;
    });

    let id = Date.now();
    lerAba(aba("Lançamentos")).forEach((l) => {
      const d = mesDe(l.get("Ano"), l.get("Mês"));
      const valor = numero(l.get("Valor"));
      const desc = String(l.get("Descrição") ?? "").trim();
      if (!d || !desc || !(valor > 0)) return ignoradas++;
      if (semAcento(l.get("Tipo")) === "entrada") {
        d.entradas.push({ id: id++, desc, valor });
      } else {
        const pago = ondeDeTexto(l.get("Pago com"));
        const cat = l.get("Categoria") ? String(l.get("Categoria")).trim() : "Outros";
        d.gastos.push(pago ? { id: id++, desc, valor, cat, pago } : { id: id++, desc, valor, cat });
      }
    });

    if (aba("Parcelas")) {
      const lista = [];
      lerAba(aba("Parcelas")).forEach((l) => {
        const desc = String(l.get("Descrição") ?? "").trim();
        const valor = numero(l.get("Valor da parcela"));
        const n = numero(l.get("Nº de parcelas"));
        const m = indiceMes(l.get("Primeira parcela (mês)"));
        const a = numero(l.get("Primeira parcela (ano)"));
        if (!desc || !(valor > 0) || !(n > 0) || m < 0 || !Number.isInteger(a)) return ignoradas++;
        const cat = l.get("Categoria") ? String(l.get("Categoria")).trim() : "Outros";
        lista.push({ id: id++, desc, valor, n, inicio: idxMes(m, a), cat, pago: ondeDeTexto(l.get("Pago com")) });
      });
      setParcelas(lista);
    }

    if (aba("Como eu recebo")) {
      const fontes = lerAba(aba("Como eu recebo"))
        .map((l) => ({
          nome: String(l.get("Parte") ?? "").trim(),
          tipo: tipoDeTexto(l.get("Como calcula")),
          onde: ondeDeTexto(l.get("Onde cai")),
          valor: numero(l.get("Valor")) || 0,
        }))
        .filter((f) => f.nome);
      setConfigRenda({ fontes });
    }

    if (aba("Categorias")) {
      const linhas = lerAba(aba("Categorias"));
      const sim = (v) => semAcento(v) === "sim";
      const ativas = linhas.filter((l) => semAcento(l.get("Tipo")) === "padrao" && sim(l.get("Em uso"))).map((l) => String(l.get("Categoria")).trim());
      const proprias = linhas
        .filter((l) => semAcento(l.get("Tipo")) !== "padrao" && String(l.get("Categoria") ?? "").trim())
        .map((l) => ({
          nome: String(l.get("Categoria")).trim(),
          icone: ICONES[l.get("Ícone")] ? l.get("Ícone") : "etiqueta",
          cor: CORES.includes(l.get("Cor")) ? l.get("Cor") : "azul",
        }));
      setCategorias({ ativas, proprias });
    }

    const meta = lerAba(aba("Configurações")).find((l) => semAcento(l.get("Configuração")).startsWith("meta"));
    if (meta && numero(meta.get("Valor")) >= 0) setMeta(numero(meta.get("Valor")));

    Object.entries(novos).forEach(([k, d]) => {
      localStorage.setItem(k, JSON.stringify(d));
      marcarModificado(k);
    });

    const qtd = Object.keys(novos).length;
    toast(`${qtd} ${qtd === 1 ? "mês importado" : "meses importados"}` + (ignoradas ? ` (${ignoradas} linha(s) ignorada(s))` : ""));
    renderTudo();
  } catch (e) {
    console.error(e);
    toast("Arquivo inválido");
  }
}
