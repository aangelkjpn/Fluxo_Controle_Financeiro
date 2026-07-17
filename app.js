/* ═══════════════════════════════════════
   MEU FLUXO — app.js
═══════════════════════════════════════ */

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const CORES_CAT = {
  'Setup/Tech':   '#4f8ef7',
  'Games':        '#a78bfa',
  'Alimentação':  '#34d399',
  'Transporte':   '#fbbf24',
  'Roupas':       '#f472b6',
  'Lazer':        '#fb923c',
  'Outros':       '#8a97ad',
};

let mesAtual = new Date().getMonth();
let anoAtual = new Date().getFullYear();

/* ── STORAGE ── */
function keyMes(m, a) { return `fluxo_${a}_${String(m).padStart(2,'0')}`; }

function getMes(m, a) {
  const raw = localStorage.getItem(keyMes(m, a));
  return raw ? JSON.parse(raw) : { entradas: [], gastos: [], reserva: 0, diasTrabalhados: 0, bolsa: 937.59 };
}

function setMes(m, a, data) {
  localStorage.setItem(keyMes(m, a), JSON.stringify(data));
}

function getMeta() {
  return parseFloat(localStorage.getItem('fluxo_meta') || '0');
}

function setMeta(v) {
  localStorage.setItem('fluxo_meta', String(v));
}

function getReservaTotal() {
  let total = 0;
  for (let k in localStorage) {
    if (k.startsWith('fluxo_') && k !== 'fluxo_meta') {
      try {
        const d = JSON.parse(localStorage.getItem(k));
        total += d.reserva || 0;
      } catch(e) {}
    }
  }
  return total;
}

/* ── UTILS ── */
function fmt(v) {
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(v, total) {
  if (!total) return 0;
  return Math.min(100, Math.round((v / total) * 100));
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

function nomeMes(m, a) { return `${MESES[m]} ${a}`; }

/* ── NAVEGAÇÃO ── */
function trocarAba(aba) {
  document.querySelectorAll('.aba').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('aba-' + aba).classList.add('active');
  event.currentTarget.classList.add('active');
  renderAba(aba);
}

function mudarMes(delta) {
  mesAtual += delta;
  if (mesAtual > 11) { mesAtual = 0; anoAtual++; }
  if (mesAtual < 0)  { mesAtual = 11; anoAtual--; }
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
  document.getElementById('mes-label').textContent = nomeMes(mesAtual, anoAtual);
}

function renderAba(aba) {
  if (aba === 'painel')   renderPainel();
  if (aba === 'renda')    renderRenda();
  if (aba === 'gastos')   renderGastos();
  if (aba === 'reserva')  renderReserva();
  if (aba === 'historico') renderHistorico();
}

function renderTudo() {
  const aba = document.querySelector('.aba.active')?.id?.replace('aba-','');
  if (aba) renderAba(aba);
}

/* ── PAINEL ── */
function renderPainel() {
  const d = getMes(mesAtual, anoAtual);
  const sub = nomeMes(mesAtual, anoAtual);
  document.getElementById('painel-mes-sub').textContent = sub;

  const totalEntradas = d.bolsa + (d.diasTrabalhados * 12) + (d.diasTrabalhados * 19.85)
    + d.entradas.reduce((s, e) => s + e.valor, 0);
  const totalGastos = d.gastos.reduce((s, g) => s + g.valor, 0);
  const sobrou = totalEntradas - totalGastos - d.reserva;

  document.getElementById('p-entrada').textContent = fmt(totalEntradas);
  document.getElementById('p-entrada-sub').textContent = d.diasTrabalhados ? `${d.diasTrabalhados} dias trabalhados` : 'sem renda registrada';
  document.getElementById('p-saida').textContent = fmt(totalGastos);
  document.getElementById('p-saida-sub').textContent = `${d.gastos.length} lançamento${d.gastos.length !== 1 ? 's' : ''}`;
  document.getElementById('p-sobrou').textContent = fmt(Math.max(0, sobrou));
  document.getElementById('p-sobrou-sub').textContent = sobrou < 0 ? '⚠ no vermelho' : 'disponível';
  document.getElementById('p-reserva').textContent = fmt(getReservaTotal());

  // categorias
  const catEl = document.getElementById('p-categorias');
  const porCat = {};
  d.gastos.forEach(g => { porCat[g.cat] = (porCat[g.cat] || 0) + g.valor; });
  const sorted = Object.entries(porCat).sort((a,b) => b[1]-a[1]);

  if (!sorted.length) {
    catEl.innerHTML = '<div class="empty-state">Nenhum gasto registrado</div>';
  } else {
    catEl.innerHTML = sorted.map(([cat, val]) => `
      <div class="cat-item">
        <span class="cat-nome">${cat}</span>
        <div class="cat-barra-wrap">
          <div class="cat-barra" style="width:${pct(val,totalGastos)}%;background:${CORES_CAT[cat]||'#8a97ad'}"></div>
        </div>
        <span class="cat-valor">${fmt(val)}</span>
      </div>`).join('');
  }

  // meta reserva
  const meta = getMeta();
  const metaEl = document.getElementById('p-meta-area');
  if (!meta) {
    metaEl.innerHTML = '<div class="empty-state">Configure uma meta na aba Reserva</div>';
  } else {
    const p = pct(d.reserva, meta);
    const cls = p >= 100 ? 'over' : p >= 50 ? '' : 'warn';
    metaEl.innerHTML = `
      <div class="progresso-label"><span>Guardado este mês</span><span>${fmt(d.reserva)} / ${fmt(meta)}</span></div>
      <div class="progresso-bar"><div class="progresso-fill ${cls}" style="width:${p}%"></div></div>
      <div style="font-size:13px;color:var(--text2)">${p}% da meta atingida</div>`;
  }

  // últimos lançamentos
  const todos = [
    ...d.entradas.map(e => ({ ...e, tipo: 'entrada' })),
    ...d.gastos.map(g => ({ ...g, tipo: 'saida' }))
  ].slice(-6).reverse();

  const ultEl = document.getElementById('p-ultimos');
  if (!todos.length) {
    ultEl.innerHTML = '<div class="empty-state">Nenhum lançamento ainda</div>';
  } else {
    ultEl.innerHTML = '<div class="lancamentos-lista">' + todos.map(l => `
      <div class="lanc-item">
        <div class="lanc-dot" style="background:${l.tipo==='entrada'?'var(--green)':'var(--red)'}"></div>
        <span class="lanc-desc">${l.desc}</span>
        ${l.cat ? `<span class="lanc-cat">${l.cat}</span>` : ''}
        <span class="lanc-val ${l.tipo}">${l.tipo==='entrada'?'+':'-'}${fmt(l.valor)}</span>
      </div>`).join('') + '</div>';
  }
}

/* ── RENDA ── */
function calcularRenda() {
  const dias = parseInt(document.getElementById('r-dias').value) || 0;
  const diasUteis = parseInt(document.getElementById('r-dias-uteis').value) || 22;
  const bolsaProp = diasUteis > 0 ? (937.59 / diasUteis) * dias : 937.59;
  const vr = dias * 12;
  const vt = dias * 19.85;
  const total = bolsaProp + vr + vt;
  document.getElementById('r-bolsa').textContent = fmt(bolsaProp);
  document.getElementById('r-vr').textContent = fmt(vr);
  document.getElementById('r-vt').textContent = fmt(vt);
  document.getElementById('r-total').textContent = fmt(total);
}

function salvarRenda() {
  const dias = parseInt(document.getElementById('r-dias').value) || 0;
  const diasUteis = parseInt(document.getElementById('r-dias-uteis').value) || 22;
  if (!dias) { toast('Informe os dias trabalhados'); return; }
  const bolsaProp = diasUteis > 0 ? (937.59 / diasUteis) * dias : 937.59;
  const d = getMes(mesAtual, anoAtual);
  d.diasTrabalhados = dias;
  d.diasUteis = diasUteis;
  d.bolsa = bolsaProp;
  setMes(mesAtual, anoAtual, d);
  toast('Renda salva!');
  renderRenda();
}

function addEntrada() {
  const desc = document.getElementById('r-desc').value.trim();
  const valor = parseFloat(document.getElementById('r-valor').value) || 0;
  if (!desc || !valor) { toast('Preenche descrição e valor'); return; }
  const d = getMes(mesAtual, anoAtual);
  d.entradas.push({ id: Date.now(), desc, valor });
  setMes(mesAtual, anoAtual, d);
  document.getElementById('r-desc').value = '';
  document.getElementById('r-valor').value = '';
  toast('Entrada adicionada!');
  renderRenda();
}

function delEntrada(id) {
  const d = getMes(mesAtual, anoAtual);
  d.entradas = d.entradas.filter(e => e.id !== id);
  setMes(mesAtual, anoAtual, d);
  renderRenda();
}

function renderRenda() {
  const d = getMes(mesAtual, anoAtual);
  document.getElementById('renda-mes-sub').textContent = nomeMes(mesAtual, anoAtual);
  if (d.diasTrabalhados) document.getElementById('r-dias').value = d.diasTrabalhados;
  if (d.diasUteis) document.getElementById('r-dias-uteis').value = d.diasUteis;
  calcularRenda();

  const lista = document.getElementById('r-lista-extras');
  if (!d.entradas.length) {
    lista.innerHTML = '<div class="empty-state">Nenhuma entrada extra registrada</div>';
    return;
  }
  lista.innerHTML = d.entradas.map(e => `
    <div class="lanc-item">
      <div class="lanc-dot" style="background:var(--green)"></div>
      <span class="lanc-desc">${e.desc}</span>
      <span class="lanc-val entrada">+${fmt(e.valor)}</span>
      <button class="lanc-del" onclick="delEntrada(${e.id})">✕</button>
    </div>`).join('');
}

/* ── GASTOS ── */
function addGasto() {
  const desc = document.getElementById('g-desc').value.trim();
  const valor = parseFloat(document.getElementById('g-valor').value) || 0;
  const cat = document.getElementById('g-cat').value;
  if (!desc || !valor) { toast('Preenche descrição e valor'); return; }
  const d = getMes(mesAtual, anoAtual);
  d.gastos.push({ id: Date.now(), desc, valor, cat });
  setMes(mesAtual, anoAtual, d);
  document.getElementById('g-desc').value = '';
  document.getElementById('g-valor').value = '';
  toast('Gasto adicionado!');
  renderGastos();
}

function delGasto(id) {
  const d = getMes(mesAtual, anoAtual);
  d.gastos = d.gastos.filter(g => g.id !== id);
  setMes(mesAtual, anoAtual, d);
  renderGastos();
}

function renderGastos() {
  const d = getMes(mesAtual, anoAtual);
  document.getElementById('gastos-mes-sub').textContent = nomeMes(mesAtual, anoAtual);
  const lista = document.getElementById('g-lista');
  if (!d.gastos.length) {
    lista.innerHTML = '<div class="empty-state">Nenhum gasto registrado este mês</div>';
    return;
  }
  lista.innerHTML = [...d.gastos].reverse().map(g => `
    <div class="lanc-item">
      <div class="lanc-dot" style="background:${CORES_CAT[g.cat]||'#8a97ad'}"></div>
      <span class="lanc-desc">${g.desc}</span>
      <span class="lanc-cat">${g.cat}</span>
      <span class="lanc-val saida">-${fmt(g.valor)}</span>
      <button class="lanc-del" onclick="delGasto(${g.id})">✕</button>
    </div>`).join('');
}

/* ── RESERVA ── */
function salvarMeta() {
  const v = parseFloat(document.getElementById('res-meta').value) || 0;
  if (!v) { toast('Informe um valor'); return; }
  setMeta(v);
  toast('Meta salva!');
  renderReserva();
}

function salvarReserva() {
  const v = parseFloat(document.getElementById('res-valor').value) || 0;
  if (!v) { toast('Informe um valor'); return; }
  const d = getMes(mesAtual, anoAtual);
  d.reserva = v;
  setMes(mesAtual, anoAtual, d);
  document.getElementById('res-valor').value = '';
  toast('Reserva registrada!');
  renderReserva();
}

function renderReserva() {
  const meta = getMeta();
  const d = getMes(mesAtual, anoAtual);

  const metaEl = document.getElementById('res-meta-atual');
  if (meta) {
    document.getElementById('res-meta').value = meta;
    metaEl.innerHTML = `<span style="color:var(--text2)">Meta atual: </span><span style="color:var(--green);font-family:'JetBrains Mono',monospace;font-weight:600">${fmt(meta)}/mês</span>`;
  } else {
    metaEl.innerHTML = '<span style="color:var(--text3)">Nenhuma meta definida</span>';
  }

  const progEl = document.getElementById('res-progresso');
  if (d.reserva || meta) {
    const p = meta ? pct(d.reserva, meta) : 0;
    const cls = p >= 100 ? 'over' : p >= 50 ? '' : 'warn';
    progEl.innerHTML = `
      <div class="progresso-wrap">
        <div class="progresso-label">
          <span>${nomeMes(mesAtual, anoAtual)}</span>
          <span>${fmt(d.reserva)}${meta ? ' / ' + fmt(meta) : ''}</span>
        </div>
        <div class="progresso-bar"><div class="progresso-fill ${cls}" style="width:${p}%"></div></div>
        <div style="font-size:13px;color:var(--text2);margin-top:4px">${meta ? p + '% da meta' : 'meta não definida'}</div>
      </div>`;
  } else {
    progEl.innerHTML = '';
  }

  // histórico reservas
  const histEl = document.getElementById('res-historico');
  const reservas = [];
  for (let k in localStorage) {
    if (k.startsWith('fluxo_') && k !== 'fluxo_meta') {
      try {
        const parts = k.replace('fluxo_','').split('_');
        const ano = parseInt(parts[0]);
        const mes = parseInt(parts[1]);
        const dd = JSON.parse(localStorage.getItem(k));
        if (dd.reserva) reservas.push({ mes, ano, valor: dd.reserva });
      } catch(e) {}
    }
  }
  reservas.sort((a,b) => b.ano - a.ano || b.mes - a.mes);

  if (!reservas.length) {
    histEl.innerHTML = '<div class="empty-state">Nenhuma reserva registrada ainda</div>';
  } else {
    histEl.innerHTML = reservas.map(r => `
      <div class="lanc-item">
        <div class="lanc-dot" style="background:var(--purple)"></div>
        <span class="lanc-desc">${nomeMes(r.mes, r.ano)}</span>
        <span class="lanc-val" style="color:var(--purple)">+${fmt(r.valor)}</span>
      </div>`).join('');
  }
}

/* ── HISTÓRICO ── */
function renderHistorico() {
  const meses = [];
  for (let k in localStorage) {
    if (k.startsWith('fluxo_') && k !== 'fluxo_meta') {
      try {
        const parts = k.replace('fluxo_','').split('_');
        const ano = parseInt(parts[0]);
        const mes = parseInt(parts[1]);
        const d = JSON.parse(localStorage.getItem(k));
        const entrada = d.bolsa + (d.diasTrabalhados * 31.85) + d.entradas.reduce((s,e)=>s+e.valor,0);
        const saida = d.gastos.reduce((s,g)=>s+g.valor,0);
        if (entrada || saida || d.reserva) meses.push({ mes, ano, d, entrada, saida });
      } catch(e) {}
    }
  }
  meses.sort((a,b) => b.ano - a.ano || b.mes - a.mes);

  const el = document.getElementById('hist-lista');
  if (!meses.length) {
    el.innerHTML = '<div class="empty-state" style="padding:3rem">Nenhum dado registrado ainda.<br>Comece adicionando a renda do mês!</div>';
    return;
  }

  el.innerHTML = meses.map(({ mes, ano, entrada, saida, d }) => {
    const saldo = entrada - saida - d.reserva;
    return `
    <div class="hist-mes">
      <div class="hist-mes-header">
        <span class="hist-mes-nome">${nomeMes(mes, ano)}</span>
        <div class="hist-mes-stats">
          <span class="hist-stat">Entrou <span class="g">${fmt(entrada)}</span></span>
          <span class="hist-stat">Gastou <span class="r">${fmt(saida)}</span></span>
          <span class="hist-stat">Guardou <span class="b">${fmt(d.reserva)}</span></span>
          <span class="hist-stat">Saldo <span class="${saldo>=0?'g':'r'}">${fmt(Math.abs(saldo))}</span></span>
        </div>
      </div>
    </div>`;
  }).join('');
}

/* ── EXPORT / IMPORT ── */
function exportarDados() {
  const dump = {};
  for (let k in localStorage) {
    if (k.startsWith('fluxo_')) dump[k] = localStorage.getItem(k);
  }
  const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `meufluxo_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  toast('Dados exportados!');
}

function importarDados() {
  document.getElementById('import-file').click();
}

function processarImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const dump = JSON.parse(ev.target.result);
      Object.entries(dump).forEach(([k, v]) => {
        if (k.startsWith('fluxo_')) localStorage.setItem(k, v);
      });
      toast('Dados importados!');
      renderTudo();
    } catch(err) {
      toast('Arquivo inválido');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

/* ── INIT ── */
atualizarLabel();
renderPainel();
