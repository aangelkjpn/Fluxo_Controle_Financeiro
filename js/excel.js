/* ═══════════════════════════════════════
   MEU FLUXO — excel.js
   Exporta e importa os dados em planilha Excel (.xlsx) usando ExcelJS.
═══════════════════════════════════════ */

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const FMT_REAL  = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
const COR_CABECALHO = 'FF1E2535';

function estilizarCabecalho(row) {
  row.eachCell(c => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR_CABECALHO } };
    c.alignment = { vertical: 'middle' };
  });
  row.height = 20;
}

function novaAba(wb, nome, colunas) {
  const ws = wb.addWorksheet(nome, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = colunas.map(([header, width, numFmt]) => ({ header, width, style: numFmt ? { numFmt } : {} }));
  estilizarCabecalho(ws.getRow(1));
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colunas.length } };
  return ws;
}

function baixarArquivo(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: nome });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/* ── EXPORTAR ── */
async function exportarExcel() {
  if (typeof ExcelJS === 'undefined') { toast('O gerador de Excel não carregou. Recarregue a página.'); return; }
  const meses = mesesSalvos();
  if (!meses.length && !getMeta()) { toast('Nenhum dado para exportar'); return; }

  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Meu Fluxo';
    wb.created = new Date();

    // Resumo: só para leitura (não é usado na importação)
    const resumo = novaAba(wb, 'Resumo', [
      ['Mês', 18], ['Entrou', 15, FMT_REAL], ['Gastou', 15, FMT_REAL], ['Guardou', 15, FMT_REAL], ['Saldo', 15, FMT_REAL]
    ]);
    meses.forEach(({ mes, ano, d }) => {
      const entrada = entradaDoMes(d);
      const saida = d.gastos.reduce((s, g) => s + g.valor, 0);
      resumo.addRow([nomeMes(mes, ano), entrada, saida, d.reserva, entrada - saida - d.reserva]);
    });
    if (meses.length) {
      const n = meses.length + 1;
      const total = resumo.addRow(['Total', ...['B','C','D','E'].map(col => ({ formula: `SUM(${col}2:${col}${n})` }))]);
      total.font = { bold: true };
    }

    const lanc = novaAba(wb, 'Lançamentos', [
      ['Ano', 7], ['Mês', 12], ['Tipo', 10], ['Descrição', 34], ['Categoria', 14], ['Valor', 14, FMT_REAL]
    ]);
    meses.forEach(({ mes, ano, d }) => {
      d.entradas.forEach(e => lanc.addRow([ano, MESES[mes], 'Entrada', e.desc, '', e.valor]));
      d.gastos.forEach(g => lanc.addRow([ano, MESES[mes], 'Gasto', g.desc, g.cat, g.valor]));
    });

    const rendas = novaAba(wb, 'Meses', [
      ['Ano', 7], ['Mês', 12], ['Dias úteis', 11], ['Dias trabalhados', 17], ['Bolsa', 14, FMT_REAL], ['Reserva', 14, FMT_REAL]
    ]);
    meses.forEach(({ mes, ano, d }) => {
      rendas.addRow([ano, MESES[mes], d.diasUteis || null, d.diasTrabalhados, d.bolsa, d.reserva]);
    });

    const config = wb.addWorksheet('Configurações');
    config.columns = [{ width: 28 }, { width: 14, style: { numFmt: FMT_REAL } }];
    estilizarCabecalho(config.addRow(['Configuração', 'Valor']));
    config.addRow(['Meta mensal de reserva', getMeta()]);

    const buffer = await wb.xlsx.writeBuffer();
    baixarArquivo(new Blob([buffer], { type: XLSX_MIME }), `MeuFluxo_${new Date().toISOString().slice(0,10)}.xlsx`);
    toast('Planilha gerada! Confira a pasta Downloads.');
  } catch (err) {
    console.error(err);
    toast('Não foi possível gerar a planilha');
  }
}

/* ── IMPORTAR ── */
function valorCelula(cell) {
  const v = cell.value;
  if (v && typeof v === 'object') {
    if ('result' in v) return v.result;                                 // fórmula
    if (v.richText) return v.richText.map(t => t.text).join('');        // texto formatado
    if ('text' in v) return v.text;                                     // link
  }
  return v;
}

function numero(v) {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return NaN;
  // aceita "1.234,56", "R$ 10,50" e "10.5"
  const s = v.replace(/[R$\s]/g, '');
  return parseFloat(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
}

const semAcento = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

// Aceita o nome do mês ("Outubro") ou o número (1 a 12). Devolve 0–11, ou -1 se inválido.
function indiceMes(v) {
  const n = numero(v);
  if (Number.isInteger(n)) return n >= 1 && n <= 12 ? n - 1 : -1;
  return MESES.findIndex(m => semAcento(m) === semAcento(v));
}

// Lê as linhas de uma aba (pulando o cabeçalho) como listas de valores
function linhas(ws) {
  const out = [];
  ws?.eachRow((row, i) => {
    if (i > 1) out.push(Array.from({ length: row.cellCount }, (_, c) => valorCelula(row.getCell(c + 1))));
  });
  return out;
}

async function importarExcel(file) {
  if (typeof ExcelJS === 'undefined') { toast('O leitor de Excel não carregou. Recarregue a página.'); return; }
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const abaMeses = wb.getWorksheet('Meses');
    const abaLanc  = wb.getWorksheet('Lançamentos');
    if (!abaMeses && !abaLanc) { toast('Planilha inválida: use uma exportada pelo Meu Fluxo'); return; }

    const novos = {};
    let ignoradas = 0;
    const mesDe = (ano, mesVal) => {
      const m = indiceMes(mesVal);
      ano = numero(ano);
      if (m < 0 || !Number.isInteger(ano)) return null;
      const k = keyMes(m, ano);
      if (!novos[k]) novos[k] = { entradas: [], gastos: [], reserva: 0, diasTrabalhados: 0, bolsa: 937.59 };
      return novos[k];
    };

    linhas(abaMeses).forEach(([ano, mes, diasUteis, dias, bolsa, reserva]) => {
      const d = mesDe(ano, mes);
      if (!d) { ignoradas++; return; }
      d.diasTrabalhados = numero(dias) || 0;
      if (numero(diasUteis)) d.diasUteis = numero(diasUteis);
      if (!isNaN(numero(bolsa))) d.bolsa = numero(bolsa);
      d.reserva = numero(reserva) || 0;
    });

    let id = Date.now();
    linhas(abaLanc).forEach(([ano, mes, tipo, desc, cat, valor]) => {
      const d = mesDe(ano, mes);
      valor = numero(valor);
      desc = desc == null ? '' : String(desc).trim();
      if (!d || !desc || !(valor > 0)) { ignoradas++; return; }
      if (semAcento(tipo) === 'entrada') d.entradas.push({ id: id++, desc, valor });
      else d.gastos.push({ id: id++, desc, valor, cat: cat ? String(cat).trim() : 'Outros' });
    });

    const abaConfig = wb.getWorksheet('Configurações');
    const meta = linhas(abaConfig).find(([nome]) => semAcento(nome).startsWith('meta'));
    if (meta && numero(meta[1]) >= 0) setMeta(numero(meta[1]));

    Object.entries(novos).forEach(([k, d]) => localStorage.setItem(k, JSON.stringify(d)));
    const qtd = Object.keys(novos).length;
    toast(`${qtd} ${qtd === 1 ? 'mês importado' : 'meses importados'}` + (ignoradas ? ` (${ignoradas} linha(s) ignorada(s))` : ''));
    renderTudo();
  } catch (err) {
    console.error(err);
    toast('Arquivo inválido');
  }
}
