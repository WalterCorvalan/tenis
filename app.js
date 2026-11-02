(() => {
'use strict';

/* ============ Datos ============ */
const KEY = 'tenis-caja-v2', KEY_OLD = 'tenis-caja-v1', KEY_CLOUD = 'tenis-caja-nube';
const CATS = {
  in:  ['Clase individual', 'Clase grupal', 'Torneo / evento', 'Otro ingreso'],
  out: ['Alquiler de cancha', 'Pelotas y material', 'Transporte', 'Otro gasto']
};
const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DAYS_LONG = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const DAYS_SHORT = ['L','M','M','J','V','S','D'];

let memoryOnly = false;
let movs = [];          // movimientos vigentes
let tombs = [];         // borrados {id, u}: hacen falta para que el borrado llegue a la nube
let lastPush = 0;       // hasta cuándo se subieron los cambios locales a la nube
let cfg = null;         // { url, key } de la nube, si está conectada
loadAll();

function loadAll() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      movs = (d.movs || []).filter(validMov);
      tombs = (d.tombs || []).filter(t => t && t.id);
      lastPush = d.lastPush || 0;
    } else {
      const old = localStorage.getItem(KEY_OLD); // versión anterior: lista simple
      if (old) { const now = Date.now(); movs = JSON.parse(old).filter(validMov).map(m => ({ ...m, u: now })); }
    }
    const c = localStorage.getItem(KEY_CLOUD);
    cfg = c ? JSON.parse(c) : null;
  } catch (e) { memoryOnly = true; }
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify({ movs, tombs, lastPush })); }
  catch (e) { memoryOnly = true; render(); }
}
function save() { persist(); scheduleSync(); }
function validMov(m) {
  return m && typeof m.id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(m.date) &&
    (m.type === 'in' || m.type === 'out') && Number.isFinite(m.amount) && m.amount > 0;
}

/* Alta / edición / baja: cada cambio lleva la hora (u) para resolver conflictos entre dispositivos. */
function putMov(rec) {
  rec.u = Date.now();
  tombs = tombs.filter(t => t.id !== rec.id);
  const i = movs.findIndex(x => x.id === rec.id);
  if (i >= 0) movs[i] = rec; else movs.push(rec);
}
function removeMov(m) {
  movs = movs.filter(x => x.id !== m.id);
  tombs = tombs.filter(t => t.id !== m.id);
  tombs.push({ id: m.id, u: Date.now() });
}
function replaceAll(list) {
  const now = Date.now(), keep = new Set(list.map(m => m.id));
  const t = new Map(tombs.map(x => [x.id, x]));
  movs.forEach(m => { if (!keep.has(m.id)) t.set(m.id, { id: m.id, u: now }); });
  tombs = [...t.values()].filter(x => !keep.has(x.id));
  movs = list.map(m => ({ ...m, u: now }));
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ============ Fechas y formato ============ */
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfWeek = d => addDays(d, -((d.getDay() + 6) % 7));
const today = () => ymd(new Date());

const nf = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const money = n => (n < 0 ? '−' : '') + '$ ' + nf.format(Math.abs(n));
/* Monto para mostrar en pantalla: el $ va chico y levantado, pegado al número, y nunca se corta en dos líneas. */
const mny = (n, plus = false) => `<span class="mny">${n < 0 ? '−' : plus && n > 0 ? '+' : ''}<span class="cur">$</span>${nf.format(Math.abs(n))}</span>`;
const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '') + '$ ' + nf.format(Math.abs(n));
function compact(n) {
  const a = Math.abs(n);
  let s;
  if (a >= 1e6) s = (a / 1e6).toFixed(1).replace(/\.0$/, '').replace('.', ',') + 'M';
  else if (a >= 1e4) s = Math.round(a / 1e3) + 'k';
  else if (a >= 1e3) s = (a / 1e3).toFixed(1).replace(/\.0$/, '').replace('.', ',') + 'k';
  else s = String(Math.round(a));
  return s;
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const longDay = s => { const d = parse(s); return cap(`${DAYS_LONG[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`); };

function sums(list) {
  let i = 0, o = 0, ni = 0, no = 0;
  for (const m of list) { if (m.type === 'in') { i += m.amount; ni++; } else { o += m.amount; no++; } }
  return { i, o, bal: i - o, ni, no };
}
const inRange = (a, b) => movs.filter(m => m.date >= a && m.date <= b);
const byDay = date => movs.filter(m => m.date === date);

/* ============ Estado de la interfaz ============ */
const t0 = new Date();
const ui = {
  view: 'cal',
  y: t0.getFullYear(), m: t0.getMonth(),
  sel: today(),
  period: 'month',
  anchor: today()
};
const $ = s => document.querySelector(s);
const app = $('#app');

/* ============ Render principal ============ */
function render() {
  $('#tab-cal').setAttribute('aria-selected', ui.view === 'cal');
  $('#tab-sum').setAttribute('aria-selected', ui.view === 'sum');
  let html = '';
  if (memoryOnly) html += `<div class="banner warn">⚠ Este navegador no permite guardar datos (modo privado o bloqueado). Lo que se cargue se perderá al cerrar. Usar “Descargar copia” para no perderlo.</div>`;
  if (!movs.length) html += `<div class="banner"><span>👋 Todavía no hay movimientos. Tocar un día del calendario para cargar el primero.</span>${cfg ? '' : '<button class="btn" data-act="sample">Probar con datos de ejemplo</button>'}</div>`;
  html += ui.view === 'cal' ? renderCal() : renderSum();
  app.innerHTML = html;
}

/* ---------- Calendario ---------- */
function renderCal() {
  const first = new Date(ui.y, ui.m, 1);
  const last = new Date(ui.y, ui.m + 1, 0);
  const gridStart = startOfWeek(first);
  const gridEnd = addDays(startOfWeek(last), 6);
  const monthList = inRange(ymd(first), ymd(last));
  const ms = sums(monthList);

  const map = {};
  for (const m of inRange(ymd(gridStart), ymd(gridEnd))) (map[m.date] ||= []).push(m);

  let cells = '';
  const tdy = today();
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) {
    const s = ymd(d), list = map[s] || [], t = sums(list);
    const cls = ['day', d.getMonth() !== ui.m && 'other', s === tdy && 'today', s === ui.sel && 'sel'].filter(Boolean).join(' ');
    let amts = '';
    if (list.length) {
      amts = `<span class="amts">${t.i ? `<span class="i">+${compact(t.i)}</span>` : ''}${t.o ? `<span class="o">−${compact(t.o)}</span>` : ''}</span>` +
             `<span class="net ${t.bal >= 0 ? 'pos' : 'neg'}">${t.bal < 0 ? '−' : ''}${compact(t.bal)}</span>`;
    }
    cells += `<button class="${cls}" data-date="${s}" aria-label="${esc(longDay(s))}${list.length ? `, ${list.length} movimientos, balance ${signed(t.bal)}` : ''}" aria-pressed="${s === ui.sel}">
      <span class="n">${d.getDate()}</span>${list.length ? `<span class="dots">${list.length}×</span>` : ''}${amts}</button>`;
  }

  return `
  <div class="layout">
    <section aria-label="Calendario">
      <div class="toolbar">
        <h1>${cap(MONTHS[ui.m])} ${ui.y}</h1>
        <button class="btn" data-act="today">Hoy</button>
        <button class="nav-btn" data-act="prev-month" aria-label="Mes anterior">‹</button>
        <button class="nav-btn" data-act="next-month" aria-label="Mes siguiente">›</button>
      </div>
      <div class="stats">
        <div class="stat in"><div class="l">Ingresos del mes</div><div class="v">${mny(ms.i)}</div></div>
        <div class="stat out"><div class="l">Egresos del mes</div><div class="v">${mny(ms.o)}</div></div>
        <div class="stat"><div class="l">Balance</div><div class="v ${ms.bal < 0 ? 'neg' : ''}">${mny(ms.bal)}</div></div>
      </div>
      <div class="wk" aria-hidden="true">${DAYS_SHORT.map(d => `<div>${d}</div>`).join('')}</div>
      <div class="grid">${cells}</div>
    </section>
    ${renderPanel()}
  </div>`;
}

function renderPanel() {
  const list = byDay(ui.sel).sort((a, b) => (a.type === b.type ? 0 : a.type === 'in' ? -1 : 1));
  const t = sums(list);
  const isToday = ui.sel === today();
  const items = list.map(m => `
    <button class="mov ${m.type}" data-edit="${m.id}">
      <span class="ic" aria-hidden="true">${m.type === 'in' ? '↑' : '↓'}</span>
      <span class="t"><b>${esc(m.type === 'in' && m.client ? m.client : m.category)}</b>
        <span>${esc(m.type === 'in' && m.client ? m.category : '')}${m.note ? (m.type === 'in' && m.client ? ' · ' : '') + esc(m.note) : ''}</span></span>
      <span class="a">${mny(m.type === 'in' ? m.amount : -m.amount, true)}</span>
    </button>`).join('');
  return `
  <aside class="card pad panel" id="panel" aria-label="Detalle del día">
    <h2>${esc(longDay(ui.sel))}${isToday ? '<span class="badge">hoy</span>' : ''}</h2>
    <div class="sub">${list.length ? `${list.length} movimiento${list.length > 1 ? 's' : ''}` : 'Sin movimientos'}</div>
    <div class="mini">
      <div><div class="l">Ingresos</div><div class="v pos">${mny(t.i)}</div></div>
      <div><div class="l">Egresos</div><div class="v neg">${mny(t.o)}</div></div>
      <div class="bal"><div class="l">Balance del día</div><div class="v ${t.bal < 0 ? 'neg' : ''}">${mny(t.bal)}</div></div>
    </div>
    <div class="actions">
      <button class="btn in" data-new="in">↑ Ingreso</button>
      <button class="btn out" data-new="out">↓ Egreso</button>
    </div>
    ${list.length ? `<div class="list">${items}</div>` : `<div class="empty">Nada cargado este día.<br>Agregar una clase cobrada o un gasto.</div>`}
  </aside>`;
}

/* ---------- Resumen ---------- */
function getRange() {
  const a = parse(ui.anchor);
  if (ui.period === 'week') { const s = startOfWeek(a); return [s, addDays(s, 6)]; }
  if (ui.period === 'month') return [new Date(a.getFullYear(), a.getMonth(), 1), new Date(a.getFullYear(), a.getMonth() + 1, 0)];
  return [new Date(a.getFullYear(), 0, 1), new Date(a.getFullYear(), 11, 31)];
}
function rangeLabel([s, e]) {
  if (ui.period === 'year') return String(s.getFullYear());
  if (ui.period === 'month') return `${cap(MONTHS[s.getMonth()])} ${s.getFullYear()}`;
  const f = d => `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
  return `${f(s)} – ${f(e)} ${e.getFullYear()}`;
}

function renderSum() {
  const [s, e] = getRange();
  const list = inRange(ymd(s), ymd(e));
  const t = sums(list);
  const periodName = { week: 'de la semana', month: 'del mes', year: 'del año' }[ui.period];

  // Barras
  const buckets = [];
  if (ui.period === 'year') {
    for (let k = 0; k < 12; k++) buckets.push({ key: `${s.getFullYear()}-${pad(k + 1)}`, label: MONTHS[k].slice(0, 3), full: `${cap(MONTHS[k])} ${s.getFullYear()}`, i: 0, o: 0 });
  } else {
    for (let d = s; d <= e; d = addDays(d, 1)) {
      const dd = d.getDate();
      const label = ui.period === 'week' ? DAYS_LONG[d.getDay()].slice(0, 3) + ' ' + dd : (dd === 1 || dd % 5 === 0 ? String(dd) : '');
      buckets.push({ key: ymd(d), label, full: longDay(ymd(d)), i: 0, o: 0 });
    }
  }
  const idx = Object.fromEntries(buckets.map((b, k) => [b.key, k]));
  for (const m of list) {
    const b = buckets[idx[ui.period === 'year' ? m.date.slice(0, 7) : m.date]];
    if (b) b[m.type === 'in' ? 'i' : 'o'] += m.amount;
  }
  const max = Math.max(1, ...buckets.map(b => Math.max(b.i, b.o)));
  const bars = buckets.map(b => `
    <button class="col" data-bucket="${b.key}" title="${esc(b.full)}: ingresos ${money(b.i)} · egresos ${money(b.o)}" aria-label="${esc(b.full)}: ingresos ${money(b.i)}, egresos ${money(b.o)}">
      <span class="pair"><span class="bar in" style="height:${(b.i / max * 100).toFixed(1)}%"></span><span class="bar out" style="height:${(b.o / max * 100).toFixed(1)}%"></span></span>
      <span class="cl">${esc(b.label)}</span>
    </button>`).join('');

  // Ranking de clientes
  const cl = new Map();
  for (const m of list) if (m.type === 'in') {
    const name = (m.client || '').trim();
    const k = name.toLowerCase();
    const row = cl.get(k) || { name: name || 'Sin cliente asignado', total: 0, n: 0, none: !name };
    row.total += m.amount; row.n++;
    cl.set(k, row);
  }
  const ranked = [...cl.values()].sort((a, b) => (a.none - b.none) || b.total - a.total);
  const topMax = Math.max(1, ...ranked.map(r => r.total));
  const rank = ranked.slice(0, 10).map((r, k) => `
    <li><span class="pos-n">${r.none ? '–' : k + 1}</span>
      <span class="nm ${r.none ? 'muted' : ''}">${esc(r.name)}</span><span class="am">${mny(r.total)}</span>
      <span class="meta"><span class="track"><span class="fill" style="width:${(r.total / topMax * 100).toFixed(1)}%"></span></span>
      <span>${r.n} cobro${r.n > 1 ? 's' : ''} · ${t.i ? Math.round(r.total / t.i * 100) : 0}%</span></span></li>`).join('');

  // Gastos por categoría
  const oc = new Map();
  for (const m of list) if (m.type === 'out') oc.set(m.category, (oc.get(m.category) || 0) + m.amount);
  const outs = [...oc.entries()].sort((a, b) => b[1] - a[1]);
  const omax = Math.max(1, ...outs.map(x => x[1]));
  const outHtml = outs.map(([c, v]) => `
    <li><span class="pos-n" style="background:var(--out-bg);color:var(--out)">↓</span>
      <span class="nm">${esc(c)}</span><span class="am">${mny(v)}</span>
      <span class="meta"><span class="track"><span class="fill o" style="width:${(v / omax * 100).toFixed(1)}%"></span></span><span>${t.o ? Math.round(v / t.o * 100) : 0}%</span></span></li>`).join('');

  const avg = t.ni ? t.i / t.ni : 0;
  return `
  <section aria-label="Resumen">
    <div class="toolbar">
      <div class="seg" role="group" aria-label="Período">
        ${['week', 'month', 'year'].map(p => `<button data-period="${p}" aria-pressed="${ui.period === p}">${{ week: 'Semana', month: 'Mes', year: 'Año' }[p]}</button>`).join('')}
      </div>
      <h1 style="margin-left:auto">${esc(rangeLabel([s, e]))}</h1>
      <button class="btn" data-act="sum-today">Hoy</button>
      <button class="nav-btn" data-act="sum-prev" aria-label="Anterior">‹</button>
      <button class="nav-btn" data-act="sum-next" aria-label="Siguiente">›</button>
    </div>
    <div class="cards">
      <div class="card big in"><div class="l">Ingresos</div><div><div class="v">${mny(t.i)}</div><div class="s">${t.ni} cobro${t.ni === 1 ? '' : 's'}${t.ni ? ` · promedio ${mny(avg)}` : ''}</div></div></div>
      <div class="card big out"><div class="l">Egresos</div><div><div class="v">${mny(t.o)}</div><div class="s">${t.no} gasto${t.no === 1 ? '' : 's'}</div></div></div>
      <div class="card big bal"><div class="l">Balance ${periodName}</div><div><div class="v">${mny(t.bal, true)}</div><div class="s">${t.i ? `Te queda el ${Math.round(t.bal / t.i * 100)}% de lo que cobraste` : 'Sin ingresos en el período'}</div></div></div>
    </div>
    <div class="two">
      <div class="card pad">
        <h3>${ui.period === 'year' ? 'Mes por mes' : 'Día por día'}</h3>
        <div class="legend"><span><i style="background:var(--in)"></i>Ingresos</span><span><i style="background:var(--out)"></i>Egresos</span></div>
        <div class="chart" role="group" aria-label="Gráfico de barras de ingresos y egresos">${bars}</div>
        <div class="muted" style="font-size:.8rem;margin-top:8px">Tocar una barra para ver ${ui.period === 'year' ? 'ese mes' : 'ese día'}.</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="card pad"><h3>🏆 Clientes que más ingresos dejan</h3>
          ${ranked.length ? `<ol class="rank">${rank}</ol>` : `<div class="empty">Todavía no hay ingresos en este período.</div>`}
        </div>
        <div class="card pad"><h3>En qué se gasta</h3>
          ${outs.length ? `<ol class="rank">${outHtml}</ol>` : `<div class="empty">Sin egresos en este período.</div>`}
        </div>
      </div>
    </div>
  </section>`;
}

/* ============ Formulario ============ */
const dlg = $('#dlg'), form = $('#form');
let editing = null;

function fillCats(type, selected) {
  $('#f-cat').innerHTML = CATS[type].map(c => `<option${c === selected ? ' selected' : ''}>${esc(c)}</option>`).join('');
}
function refreshChips() {
  const type = form.type.value;
  const count = new Map();
  movs.filter(m => m.type === type).forEach(m => count.set(m.amount, (count.get(m.amount) || 0) + 1));
  const top = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(x => x[0]).sort((a, b) => a - b);
  $('#chips').innerHTML = top.map(v => `<button type="button" class="chip" data-amt="${v}">${nf.format(v)}</button>`).join('');
}
function applyType() {
  const type = form.type.value;
  const cur = $('#f-cat').value;
  fillCats(type, CATS[type].includes(cur) ? cur : CATS[type][0]);
  $('#client-field').classList.toggle('hidden', type !== 'in');
  refreshChips();
}
function openForm({ id, date, type } = {}) {
  editing = id ? movs.find(m => m.id === id) : null;
  const m = editing;
  const ty = m ? m.type : (type || 'in');
  $('#dlg-title').textContent = m ? 'Editar movimiento' : 'Nuevo movimiento';
  form.type.value = ty;
  fillCats(ty, m ? m.category : CATS[ty][0]);
  $('#f-amount').value = m ? m.amount : '';
  $('#f-date').value = m ? m.date : (date || ui.sel);
  $('#f-client').value = m ? (m.client || '') : '';
  $('#f-note').value = m ? (m.note || '') : '';
  $('#client-field').classList.toggle('hidden', ty !== 'in');
  $('#clients').innerHTML = [...new Set(movs.map(x => x.client).filter(Boolean))].sort().map(c => `<option value="${esc(c)}">`).join('');
  $('#f-del').classList.toggle('hidden', !m);
  $('#another-row').classList.toggle('hidden', !!m);
  refreshChips();
  dlg.showModal();
  $('#f-amount').focus();
}
form.addEventListener('change', e => { if (e.target.name === 'type') applyType(); });
$('#chips').addEventListener('click', e => {
  const b = e.target.closest('[data-amt]');
  if (b) { $('#f-amount').value = b.dataset.amt; $('#f-note').focus(); }
});
$('#f-cancel').addEventListener('click', () => dlg.close());
dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
$('#f-del').addEventListener('click', () => {
  if (!editing) return;
  const removed = editing;
  removeMov(removed);
  save(); dlg.close(); render();
  toast('Movimiento eliminado', 'Deshacer', () => { putMov(removed); save(); render(); });
});
form.addEventListener('submit', e => {
  e.preventDefault();
  const another = e.submitter && e.submitter.value === 'another';
  const type = form.type.value;
  const amount = Math.round(parseFloat($('#f-amount').value) * 100) / 100;
  const date = $('#f-date').value;
  if (!(amount > 0) || !date) return;
  const rec = {
    id: editing ? editing.id : uid(), date, type, amount,
    category: $('#f-cat').value,
    client: type === 'in' ? $('#f-client').value.trim() : '',
    note: $('#f-note').value.trim()
  };
  putMov(rec);
  save();
  const d = parse(date);
  ui.sel = date; ui.y = d.getFullYear(); ui.m = d.getMonth();
  if (another) {
    render();
    openForm({ date, type });
    toast('Guardado ✓');
  } else {
    dlg.close(); render();
  }
});

/* ============ Aviso con "deshacer" ============ */
let toastTimer;
function toast(msg, actionLabel, action) {
  const host = $('#toast-host');
  clearTimeout(toastTimer);
  host.innerHTML = `<div class="toast" role="status"><span>${esc(msg)}</span>${actionLabel ? `<button>${esc(actionLabel)}</button>` : ''}</div>`;
  if (actionLabel) host.querySelector('button').onclick = () => { host.innerHTML = ''; action(); };
  toastTimer = setTimeout(() => host.innerHTML = '', actionLabel ? 7000 : 1800);
}

/* ============ Copias de seguridad ============ */
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportCSV() {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Fecha', 'Tipo', 'Categoría', 'Cliente', 'Nota', 'Monto (ARS)']].concat(
    [...movs].sort((a, b) => a.date.localeCompare(b.date)).map(m => [m.date, m.type === 'in' ? 'Ingreso' : 'Egreso', m.category, m.client, m.note, String(m.amount).replace('.', ',')]));
  download(`tenis-movimientos-${today()}.csv`, '﻿' + rows.map(r => r.map(q).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
}
$('#file').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    const list = (Array.isArray(data) ? data : data.movimientos).filter(validMov);
    if (!confirm(`Se encontraron ${list.length} movimientos. Esto reemplaza lo que hay cargado ahora (${movs.length}). ¿Continuar?`)) return;
    replaceAll(list); save(); render(); toast('Copia restaurada ✓');
  } catch (err) { alert('No se pudo leer el archivo. Tiene que ser una copia descargada desde esta misma aplicación.'); }
});

function sampleData() {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const clients = ['Martín Gómez', 'Lucía Pereyra', 'Andrés Silva', 'Valentina Ríos', 'Tomás Acuña'];
  const prices = { 'Martín Gómez': 18000, 'Lucía Pereyra': 18000, 'Andrés Silva': 15000, 'Valentina Ríos': 15000, 'Tomás Acuña': 12000 };
  const out = [];
  const end = new Date(), start = addDays(end, -75);
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const dow = d.getDay(), s = ymd(d);
    if (dow === 0) continue;
    const n = dow === 6 ? 2 : 2 + Math.floor(rnd() * 3);
    let courts = 0;
    for (let k = 0; k < n; k++) {
      if (rnd() < 0.2) { out.push({ id: uid(), date: s, type: 'in', amount: 30000, category: 'Clase grupal', client: 'Club Los Aromos', note: 'Grupo infantil' }); courts++; continue; }
      const c = pick(clients);
      out.push({ id: uid(), date: s, type: 'in', amount: prices[c], category: 'Clase individual', client: c, note: '1 hora' });
      courts++;
    }
    if (courts >= 3) out.push({ id: uid(), date: s, type: 'out', amount: 9000, category: 'Alquiler de cancha', client: '', note: '' });
    if (rnd() < 0.25) out.push({ id: uid(), date: s, type: 'out', amount: 3500, category: 'Transporte', client: '', note: '' });
    if (d.getDate() === 5) out.push({ id: uid(), date: s, type: 'out', amount: 28000, category: 'Pelotas y material', client: '', note: 'Tubos de pelotas' });
  }
  return out;
}

/* ============ Nube (Google Sheets) ============ */
let syncState = cfg ? 'idle' : 'off';   // off | idle | syncing | ok | error
let syncMsg = '', lastOk = 0, syncing = false, pendingSync = false, syncTimer;

function setSync(state, msg = '') {
  syncState = state; syncMsg = msg;
  const b = $('#sync-btn'); if (!b) return;
  const label = {
    off: 'Sin nube', idle: 'Nube', syncing: 'Sincronizando…',
    ok: 'Guardado en la nube', error: navigator.onLine === false ? 'Sin conexión' : 'Error de nube'
  }[state];
  b.dataset.state = state;
  b.querySelector('.lbl').textContent = label;
  b.setAttribute('aria-label', label + (msg ? ': ' + msg : '') + '. Tocar para ver o configurar.');
  b.title = msg || label;
}
function scheduleSync(delay = 1500) {
  if (!cfg) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(sync, delay);
}
async function cloudCall(records) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 30000);
  try {
    const res = await fetch(cfg.url, {
      method: 'POST', redirect: 'follow', signal: ctl.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // evita el "preflight" CORS
      body: JSON.stringify({ key: cfg.key, records })
    });
    if (!res.ok) throw new Error('Respuesta HTTP ' + res.status);
    let data;
    try { data = await res.json(); }
    catch (e) { throw new Error('La URL no respondió como se esperaba. ¿Se publicó con acceso para “Cualquier persona”?'); }
    if (!data.ok) throw new Error(data.error || 'Error desconocido');
    return data;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Tardó demasiado en responder.');
    if (e instanceof TypeError) throw new Error(navigator.onLine === false ? 'Sin conexión a internet.' : 'No se pudo conectar. Revisar la URL.');
    throw e;
  } finally { clearTimeout(to); }
}
/* Une lo recibido con lo local: para cada id gana el cambio más reciente. */
function mergeRemote(remote) {
  const local = new Map();
  movs.forEach(m => local.set(m.id, { u: m.u || 0, rec: m }));
  tombs.forEach(t => local.set(t.id, { u: t.u, del: true }));
  let changed = false;
  for (const r of remote) {
    const l = local.get(r.id);
    if (l && !(r.u > l.u)) continue;
    changed = true;
    local.set(r.id, r.del ? { u: r.u, del: true } : { u: r.u, rec: { id: r.id, date: r.date, type: r.type, amount: r.amount, category: r.category, client: r.client, note: r.note, u: r.u } });
  }
  movs = []; tombs = [];
  for (const [id, l] of local) {
    if (l.del) tombs.push({ id, u: l.u });
    else if (validMov(l.rec)) movs.push(l.rec);
  }
  return changed;
}
async function sync() {
  if (!cfg) return false;
  if (syncing) { pendingSync = true; return false; }
  syncing = true; setSync('syncing');
  const started = Date.now();
  let ok = false;
  try {
    const dirty = [...movs.filter(m => m.u > lastPush), ...tombs.filter(t => t.u > lastPush).map(t => ({ id: t.id, u: t.u, del: true }))];
    const data = await cloudCall(dirty);
    const changed = mergeRemote(data.records);
    lastPush = started; lastOk = Date.now();
    persist();
    setSync('ok', 'Última sincronización ' + new Date(lastOk).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }));
    if (changed) render();
    ok = true;
  } catch (e) {
    setSync('error', e.message);
  } finally {
    syncing = false;
    if (pendingSync) { pendingSync = false; scheduleSync(300); }
  }
  return ok;
}

const dlgCloud = $('#dlg-cloud');
function openCloud() {
  $('#c-url').value = cfg ? cfg.url : '';
  $('#c-key').value = cfg ? cfg.key : '';
  $('#c-off').classList.toggle('hidden', !cfg);
  $('#c-now-row').classList.toggle('hidden', !cfg);
  showCloudStatus();
  dlgCloud.showModal();
}
function showCloudStatus() {
  const el = $('#cloud-status');
  el.className = 'small ' + (syncState === 'error' ? 'neg' : syncState === 'ok' ? 'pos' : 'muted');
  el.textContent = !cfg ? 'Todavía no está conectada. Pegar la URL y la clave que se generan siguiendo LEEME-NUBE.md.'
    : syncState === 'error' ? 'Problema: ' + syncMsg
    : syncState === 'ok' ? '✓ Conectada. ' + syncMsg
    : 'Conectada.';
}
$('#sync-btn').addEventListener('click', openCloud);
$('#c-close').addEventListener('click', () => dlgCloud.close());
dlgCloud.addEventListener('click', e => { if (e.target === dlgCloud) dlgCloud.close(); });
$('#c-now').addEventListener('click', async () => { $('#cloud-status').textContent = 'Sincronizando…'; await sync(); showCloudStatus(); });
$('#c-off').addEventListener('click', () => {
  if (!confirm('¿Desconectar de la nube? Los datos siguen en este dispositivo y en la planilla, pero ya no se sincronizan.')) return;
  cfg = null; lastPush = 0; try { localStorage.removeItem(KEY_CLOUD); } catch (e) {}
  persist(); setSync('off'); dlgCloud.close(); render();
});
$('#cloud-form').addEventListener('submit', async e => {
  e.preventDefault();
  const url = $('#c-url').value.trim(), key = $('#c-key').value.trim();
  const st = $('#cloud-status');
  if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(url)) { st.className = 'small neg'; st.textContent = 'La URL tiene que terminar en /exec y empezar con https://script.google.com/'; return; }
  if (key.length < 8) { st.className = 'small neg'; st.textContent = 'La clave es muy corta (mínimo 8 caracteres).'; return; }
  const prev = { cfg, lastPush };
  cfg = { url, key }; lastPush = 0;
  st.className = 'small muted'; st.textContent = 'Conectando…';
  if (await sync()) {
    try { localStorage.setItem(KEY_CLOUD, JSON.stringify(cfg)); } catch (e) {}
    dlgCloud.close(); render(); toast('Conectado a Google Sheets ✓');
  } else {
    const msg = syncMsg;
    cfg = prev.cfg; lastPush = prev.lastPush; setSync(cfg ? 'idle' : 'off');
    st.className = 'small neg'; st.textContent = 'No se pudo conectar: ' + msg;
  }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleSync(300); });
window.addEventListener('online', () => scheduleSync(300));
setInterval(() => { if (!document.hidden) scheduleSync(0); }, 120000);

/* ============ Eventos ============ */
const menu = $('#menu'), menuBtn = $('#menu-btn');
const closeMenu = () => { menu.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); };
menuBtn.addEventListener('click', e => { e.stopPropagation(); const o = menu.classList.toggle('open'); menuBtn.setAttribute('aria-expanded', o); });
document.addEventListener('click', e => { if (!menu.contains(e.target)) closeMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

menu.addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  closeMenu();
  if (a.dataset.act === 'cloud') return openCloud();
  if (a.dataset.act === 'export-json') download(`tenis-copia-${today()}.json`, JSON.stringify({ app: 'tenis-caja', version: 2, movimientos: movs }, null, 1), 'application/json');
  if (a.dataset.act === 'import-json') $('#file').click();
  if (a.dataset.act === 'export-csv') exportCSV();
  if (a.dataset.act === 'wipe' && confirm('¿Borrar TODOS los movimientos? Esto no se puede deshacer (conviene descargar una copia antes).')) { replaceAll([]); save(); render(); }
});

document.querySelector('.tabs').addEventListener('click', e => {
  const b = e.target.closest('[data-view]'); if (!b) return;
  ui.view = b.dataset.view; render(); window.scrollTo({ top: 0 });
});
$('#fab').addEventListener('click', () => openForm({ date: ui.sel }));

function shiftAnchor(dir) {
  const a = parse(ui.anchor);
  if (ui.period === 'week') ui.anchor = ymd(addDays(a, 7 * dir));
  else if (ui.period === 'month') ui.anchor = ymd(new Date(a.getFullYear(), a.getMonth() + dir, 1));
  else ui.anchor = ymd(new Date(a.getFullYear() + dir, 0, 1));
}

app.addEventListener('click', e => {
  const t = e.target;
  let el;
  if ((el = t.closest('[data-new]'))) return openForm({ type: el.dataset.new, date: ui.sel });
  if ((el = t.closest('[data-edit]'))) return openForm({ id: el.dataset.edit });
  if ((el = t.closest('[data-date]'))) {
    ui.sel = el.dataset.date;
    const d = parse(ui.sel);
    ui.y = d.getFullYear(); ui.m = d.getMonth();
    render();
    if (window.matchMedia('(max-width:900px)').matches) $('#panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if ((el = t.closest('[data-period]'))) { ui.period = el.dataset.period; return render(); }
  if ((el = t.closest('[data-bucket]'))) {
    const k = el.dataset.bucket;
    if (ui.period === 'year') { ui.period = 'month'; ui.anchor = k + '-01'; }
    else { ui.sel = k; const d = parse(k); ui.y = d.getFullYear(); ui.m = d.getMonth(); ui.view = 'cal'; }
    render(); return window.scrollTo({ top: 0 });
  }
  if ((el = t.closest('[data-act]'))) {
    switch (el.dataset.act) {
      case 'today': ui.y = new Date().getFullYear(); ui.m = new Date().getMonth(); ui.sel = today(); break;
      case 'prev-month': ui.m--; if (ui.m < 0) { ui.m = 11; ui.y--; } break;
      case 'next-month': ui.m++; if (ui.m > 11) { ui.m = 0; ui.y++; } break;
      case 'sum-today': ui.anchor = today(); break;
      case 'sum-prev': shiftAnchor(-1); break;
      case 'sum-next': shiftAnchor(1); break;
      case 'sample': replaceAll(sampleData()); save(); break;
    }
    render();
  }
});

setSync(syncState);
render();
scheduleSync(200);
})();
