(() => {
'use strict';

/* ============ Datos ============ */
const KEY = 'tenis-caja-v2', KEY_OLD = 'tenis-caja-v1', KEY_CLOUD = 'tenis-caja-nube';
const CATS = {
  in:  ['Clase individual', 'Clase grupal', 'Pack de clases', 'Torneo / evento', 'Otro ingreso'],
  out: ['Alquiler de cancha', 'Pelotas y material', 'Transporte', 'Otro gasto']
};
const PACK_CAT = 'Pack de clases';
const REASONS = ['Lluvia', 'Faltó el alumno', 'Avisó que no viene', 'Reprogramada', 'Otro'];
const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DAYS_LONG = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const DAYS_SHORT = ['L','M','M','J','V','S','D'];

let memoryOnly = false;
let movs = [];          // movimientos vigentes
let tombs = [];         // borrados {id, u}: hacen falta para que el borrado llegue a la nube
let lastPush = 0;       // hasta cuándo se subieron los cambios locales a la nube
let lastPull = 0, lastFull = 0;   // hora (de la planilla) de la última bajada, y de la última bajada completa
let cfg = null;         // { url, key } de la nube, si está conectada
let dataVer = 0;        // sube con cada cambio de datos (invalida el índice por día)
loadAll();

function loadAll() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      movs = (d.movs || []).filter(validMov);
      tombs = (d.tombs || []).filter(t => t && t.id);
      lastPush = d.lastPush || 0; lastPull = d.lastPull || 0; lastFull = d.lastFull || 0;
    } else {
      const old = localStorage.getItem(KEY_OLD); // versión anterior: lista simple
      if (old) { const now = Date.now(); movs = JSON.parse(old).filter(validMov).map(m => ({ ...m, u: now })); }
    }
    const c = localStorage.getItem(KEY_CLOUD);
    cfg = c ? JSON.parse(c) : null;
  } catch (e) { memoryOnly = true; }
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify({ movs, tombs, lastPush, lastPull, lastFull })); }
  catch (e) { memoryOnly = true; render(); }
}
/* Guardar en el dispositivo se hace un instante después (así la pantalla responde primero) y siempre antes de cerrar. */
let persistTimer = 0;
function save() { clearTimeout(persistTimer); persistTimer = setTimeout(persist, 150); scheduleSync(); }
function flushPersist() { if (persistTimer) { clearTimeout(persistTimer); persistTimer = 0; persist(); } }
window.addEventListener('pagehide', flushPersist);
document.addEventListener('visibilitychange', () => { if (document.hidden) flushPersist(); });
function validMov(m) {
  if (!m || typeof m.id !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(m.date) || (m.type !== 'in' && m.type !== 'out')) return false;
  const okAmt = Number.isFinite(m.amount) && (m.amount > 0 || (m.amount === 0 && (m.cancelled || m.packId)));
  return okAmt &&
    (m.time == null || m.time === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(m.time)) &&
    (m.pending == null || typeof m.pending === 'boolean') &&
    (m.cancelled == null || typeof m.cancelled === 'boolean');
}

/* Alta / edición / baja: cada cambio lleva la hora (u) para resolver conflictos entre dispositivos. */
function putMov(rec) {
  dataVer++;
  rec.u = Date.now();
  tombs = tombs.filter(t => t.id !== rec.id);
  const i = movs.findIndex(x => x.id === rec.id);
  if (i >= 0) movs[i] = rec; else movs.push(rec);
}
function removeMov(m) {
  dataVer++;
  movs = movs.filter(x => x.id !== m.id);
  tombs = tombs.filter(t => t.id !== m.id);
  tombs.push({ id: m.id, u: Date.now() });
}
function replaceAll(list) {
  dataVer++;
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

/* Ingresos = lo ya cobrado. Lo "pendiente" (clase dada, todavía no pagada) se cuenta aparte como "por cobrar".
   Las clases canceladas no suman nada. Las clases descontadas de un pack no suman: la plata entró cuando se pagó el pack. */
function sums(list) {
  let i = 0, o = 0, ni = 0, no = 0, pend = 0, np = 0, nc = 0, lost = 0, npk = 0;
  for (const m of list) {
    if (m.cancelled) { nc++; if (m.reason !== 'Reprogramada') lost += m.amount; continue; }
    if (m.type === 'in') {
      if (m.pending) { pend += m.amount; np++; }
      else if (m.packId) npk++;
      else { i += m.amount; ni++; }
    } else { o += m.amount; no++; }
  }
  return { i, o, bal: i - o, ni, no, pend, np, nc, lost, npk };
}
const allPending = () => movs.filter(m => m.type === 'in' && m.pending && !m.cancelled);
const clientKey = c => (c || '').trim().toLowerCase();

/* Packs: se compra un pack (ingreso con "packSize") y cada clase descontada lleva "packId" y monto 0. */
let packVer = -1, packMap = new Map();
function packs() {
  if (packVer !== dataVer) {
    packMap = new Map();
    for (const m of movs) if (m.type === 'in' && m.packSize > 0 && !m.cancelled) packMap.set(m.id, { id: m.id, size: m.packSize, client: (m.client || '').trim(), date: m.date, used: 0, idx: new Map() });
    const uses = movs.filter(m => m.packId && packMap.has(m.packId) && !m.cancelled).sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
    for (const u of uses) { const p = packMap.get(u.packId); p.used++; p.idx.set(u.id, p.used); }
    packVer = dataVer;
  }
  return packMap;
}
const packLeft = p => p.size - p.used;
function activePacksFor(client, keepId) {
  const k = clientKey(client);
  if (!k) return [];
  return [...packs().values()].filter(p => clientKey(p.client) === k && (packLeft(p) > 0 || p.id === keepId)).sort((a, b) => a.date.localeCompare(b.date));
}

/* Meta mensual (se guarda en este dispositivo y va en la copia de seguridad). */
const KEY_GOAL = 'tenis-caja-meta';
let goal = 0;
try { goal = Number(localStorage.getItem(KEY_GOAL)) || 0; } catch (e) {}
function setGoal(v) {
  goal = v > 0 ? v : 0;
  try { if (goal) localStorage.setItem(KEY_GOAL, String(goal)); else localStorage.removeItem(KEY_GOAL); } catch (e) {}
}
function goalData(y, m) {
  const list = inRange(ymd(new Date(y, m, 1)), ymd(new Date(y, m + 1, 0)));
  const t = sums(list);
  const classes = list.filter(x => x.type === 'in' && !x.pending && !x.cancelled && x.amount > 0 && !(x.packSize > 0));
  const avg = classes.length ? classes.reduce((a, x) => a + x.amount, 0) / classes.length : 0;
  const pct = Math.min(100, t.i / goal * 100);
  const left = Math.max(0, goal - t.i);
  return { t, pct, pend: Math.min(100 - pct, t.pend / goal * 100), left, need: avg ? Math.ceil(left / avg) : 0, reach: (t.i + t.pend) / goal * 100 };
}
function goalBar(g) { return `<div class="gbar" role="img" aria-label="${Math.round(g.pct)}% de la meta cobrado"><span class="gpaid" style="width:${g.pct.toFixed(1)}%"></span><span class="gpend" style="width:${g.pend.toFixed(1)}%"></span></div>`; }
function goalSlim() {
  if (!goal) return '';
  const g = goalData(ui.y, ui.m);
  return `<div class="goal slim"><div class="goal-line"><span><b>Meta del mes:</b> ${mny(g.t.i)} de ${mny(goal)} · ${Math.round(g.t.i / goal * 100)}%</span><button class="btn link" data-act="goal">Cambiar</button></div>${goalBar(g)}</div>`;
}
function goalCard(y, m) {
  const nm = cap(MONTHS[m]);
  if (!goal) return `<div class="card pad goal"><div class="goal-line"><div><div class="l">Meta de ${nm}</div><div class="insight">Definí cuánto querés ganar este mes y seguí tu avance día a día.</div></div><button class="btn primary" data-act="goal">Definir meta</button></div></div>`;
  const g = goalData(y, m);
  const msg = g.left === 0 ? `Meta cumplida. Superaste por ${mny(g.t.i - goal)}.`
    : `Te faltan ${mny(g.left)}${g.need ? ` · unas <b>${g.need}</b> clases más` : ''}.${g.t.pend ? ` Si cobrás lo que te deben llegás al <b>${Math.round(g.reach)}%</b>.` : ''}`;
  return `<div class="card pad goal"><div class="goal-line"><div><div class="l">Meta de ${nm}</div><div class="gv">${mny(g.t.i)} <span class="muted">de</span> ${mny(goal)} <span class="gpct">${Math.round(g.t.i / goal * 100)}%</span></div></div><button class="btn" data-act="goal">Cambiar meta</button></div>${goalBar(g)}<div class="insight">${msg}</div></div>`;
}

/* Movimientos entre dos fechas: se buscan día por día en el índice (no se recorre todo el historial). */
function inRange(a, b) {
  const span = Math.round((parse(b) - parse(a)) / 86400000);
  if (span > 800) return movs.filter(m => m.date >= a && m.date <= b);
  const idx = dayIndex(), out = [];
  for (let d = parse(a), s = a; s <= b; d = addDays(d, 1), s = ymd(d)) { const l = idx.get(s); if (l) for (const m of l) out.push(m); }
  return out;
}
let idxVer = -1, idxMap = new Map();
function dayIndex() {
  if (idxVer !== dataVer) {
    idxMap = new Map();
    for (const m of movs) { let a = idxMap.get(m.date); if (!a) idxMap.set(m.date, a = []); a.push(m); }
    idxVer = dataVer;
  }
  return idxMap;
}
const byDay = date => (dayIndex().get(date) || []).slice();

/* Horarios: cualquier minuto (06:30, 07:30, 14:33…). Sin hora = va al final del día. */
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const addMin = (t, n) => { const x = (((toMin(t) + n) % 1440) + 1440) % 1440; return pad(Math.floor(x / 60)) + ':' + pad(x % 60); };
const byTime = (a, b) => (a.time ? 0 : 1) - (b.time ? 0 : 1) || (a.time || '').localeCompare(b.time || '') || (a.type === b.type ? 0 : a.type === 'in' ? -1 : 1);

/* ============ Estado de la interfaz ============ */
const t0 = new Date();
const ui = {
  view: 'cal',
  y: t0.getFullYear(), m: t0.getMonth(),
  sel: today(),
  period: 'month',
  anchor: today(),
  sheet: false          // en pantallas chicas, el detalle del día es una hoja que sube desde abajo
};
const isMobile = () => window.matchMedia('(max-width:900px)').matches;
const $ = s => document.querySelector(s);
const app = $('#app');

/* ============ Render principal ============ */
function render() {
  $('#tab-cal').setAttribute('aria-selected', ui.view === 'cal');
  $('#tab-sum').setAttribute('aria-selected', ui.view === 'sum');
  let html = '';
  if (memoryOnly) html += `<div class="banner warn"><b>Atención:</b> este navegador no permite guardar datos (modo privado o bloqueado). Lo que se cargue se perderá al cerrar. Usar “Descargar copia” para no perderlo.</div>`;
  if (!movs.length) html += `<div class="banner"><span><b>Todavía no hay movimientos.</b> Tocar un día del calendario para cargar la primera clase.</span>${cfg ? '' : '<button class="btn" data-act="sample">Probar con datos de ejemplo</button>'}</div>`;
  html += ui.view === 'cal' ? renderCal() : renderSum();
  app.innerHTML = html;
  app.dataset.view = ui.view;
  document.body.classList.toggle('sheet-open', ui.view === 'cal' && ui.sheet && isMobile());
}

/* Cambiar de día sin reconstruir todo el calendario (más rápido y sin saltos). */
function selectDay(s, focus, open) {
  const prev = ui.sel, d = parse(s);
  ui.sel = s;
  if (open && isMobile()) ui.sheet = true;
  if (d.getMonth() !== ui.m || d.getFullYear() !== ui.y) { ui.y = d.getFullYear(); ui.m = d.getMonth(); render(); }
  else {
    const set = (date, on) => { const b = app.querySelector(`[data-date="${date}"]`); if (b) { b.classList.toggle('sel', on); b.setAttribute('aria-pressed', on); } };
    set(prev, false); set(s, true);
    const p = $('#panel'); if (p) { p.innerHTML = panelInner(); if (open && isMobile()) openSheet(); }
  }
  if (focus) { const b = app.querySelector(`[data-date="${s}"]`); if (b) b.focus({ preventScroll: true }); }
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
    const s = ymd(d), list = map[s] || [], t = sums(list), nAct = list.filter(x => !x.cancelled).length;
    const cls = ['day', d.getMonth() !== ui.m && 'other', s === tdy && 'today', s === ui.sel && 'sel', t.np && 'has-pend'].filter(Boolean).join(' ');
    let amts = '';
    if (nAct) {
      amts = `<span class="amts">${t.i ? `<span class="i">+${compact(t.i)}</span>` : ''}${t.o ? `<span class="o">−${compact(t.o)}</span>` : ''}</span>` +
             `<span class="net ${t.bal >= 0 ? 'pos' : 'neg'}">${t.bal < 0 ? '−' : ''}${compact(t.bal)}</span>`;
    }
    cells += `<button class="${cls}" data-date="${s}" aria-label="${esc(longDay(s))}${nAct ? `, ${nAct} movimientos, balance ${signed(t.bal)}` : ''}${t.np ? `, ${t.np} por cobrar` : ''}${t.nc ? `, ${t.nc} canceladas` : ''}" aria-pressed="${s === ui.sel}">
      <span class="n">${d.getDate()}</span>${nAct ? `<span class="dots">${nAct}×</span>` : ''}${amts}</button>`;
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
        <div class="stat tot"><div class="l">Balance</div><div class="v ${ms.bal < 0 ? 'deficit' : ''}">${mny(ms.bal)}</div></div>
      </div>
      <div class="infos">${pendBar()}${goalSlim()}</div>
      <div class="wk" aria-hidden="true">${DAYS_SHORT.map(d => `<div>${d}</div>`).join('')}</div>
      <div class="grid" style="--rows:${Math.round(((gridEnd - gridStart) / 864e5 + 1) / 7)}">${cells}</div>
    </section>
    ${renderPanel()}
  </div>`;
}

function pendBar() {
  const p = allPending();
  if (!p.length) return '';
  const tot = p.reduce((a, m) => a + m.amount, 0);
  return `<div class="pendbar"><span><b>Por cobrar:</b> ${mny(tot)} · ${p.length} clase${p.length > 1 ? 's' : ''}</span><button class="btn link" data-view-go="sum">Ver quién</button></div>`;
}

function tagsFor(m) {
  const t = [];
  if (m.cancelled) t.push(`<span class="tag cancel">${esc(m.reason || 'Cancelada')}</span>`);
  else if (m.pending) t.push('<span class="tag">Debe</span>');
  if (m.packSize > 0) t.push(`<span class="tag pack">Pack ×${m.packSize}</span>`);
  else if (m.packId) { const p = packs().get(m.packId), n = p && p.idx.get(m.id); t.push(`<span class="tag pack">${n ? `Pack ${n}/${p.size}` : 'Pack'}</span>`); }
  return t.join('');
}
const amtHtml = m => m.packId ? '<span class="packlbl">incluida</span>' : (m.cancelled && !m.amount ? '—' : mny(m.type === 'in' ? m.amount : -m.amount, m.type === 'in'));

function panelInner() {
  const list = byDay(ui.sel).sort(byTime);
  const t = sums(list);
  const d = parse(ui.sel);
  const isToday = ui.sel === today();
  const items = list.map(m => `
    <li class="tl-item ${m.type}${m.time ? '' : ' notime'}${m.pending ? ' pend' : ''}${m.cancelled ? ' cancel' : ''}">
      <span class="tl-t">${m.time ? esc(m.time) : '--:--'}</span>
      <div class="movwrap">
        <button class="mov ${m.type}${m.pending ? ' pend' : ''}${m.cancelled ? ' cancel' : ''}" data-edit="${m.id}">
          <span class="ic" aria-hidden="true">${m.cancelled ? '×' : m.type === 'in' ? '+' : '−'}</span>
          <span class="t"><span class="trow"><b>${esc(m.type === 'in' && m.client ? m.client : m.category)}</b>${tagsFor(m)}</span>
            <span>${esc(m.type === 'in' && m.client ? m.category : '')}${m.note ? (m.type === 'in' && m.client ? ' · ' : '') + esc(m.note) : ''}</span></span>
          <span class="a">${amtHtml(m)}</span>
        </button>
        ${m.pending && !m.cancelled ? `<button class="cobrar" data-pay="${m.id}">Marcar como cobrado</button>` : ''}
      </div>
    </li>`).join('');
  const n = t.ni;
  return `
    <button class="sheet-x" data-sheet-close aria-label="Cerrar el detalle del día">✕</button>
    <div class="dayhead">
      <div class="dn">${d.getDate()}</div>
      <div class="dt"><div class="dw">${esc(cap(DAYS_LONG[d.getDay()]))}${isToday ? '<span class="badge">hoy</span>' : ''}</div><div class="dm">${MONTHS[d.getMonth()]} ${d.getFullYear()}</div></div>
    </div>
    <div class="pad">
      <div class="mini">
        <div><div class="l">Ingresos${n ? `<span class="cnt"> · ${n} cobro${n > 1 ? 's' : ''}</span>` : ''}</div><div class="v pos">${mny(t.i)}</div></div>
        <div><div class="l">Egresos</div><div class="v neg">${mny(t.o)}</div></div>
        <div class="bal"><div class="l">Balance del día</div><div class="v ${t.bal < 0 ? 'deficit' : ''}">${mny(t.bal)}</div></div>
        ${t.nc ? `<div class="pendnote cancelnote"><span class="l">Clases canceladas</span><span class="v">${t.nc}</span></div>` : ''}
        ${t.np ? `<div class="pendnote"><span class="l">Por cobrar este día</span><span class="v">${mny(t.pend)}</span></div>` : ''}
      </div>
      <div class="actions">
        <button class="btn in" data-new="in">+ Ingreso</button>
        <button class="btn out" data-new="out">− Egreso</button>
      </div>
      <h3 class="agenda-h">Agenda del día</h3>
      ${list.length ? `<ol class="tl">${items}</ol>` : `<div class="empty">Nada cargado este día.<br>Agregar una clase cobrada o un gasto.</div>`}
    </div>`;
}
const renderPanel = () => `<aside class="card panel${ui.sheet ? ' open' : ''}" id="panel" aria-label="Detalle del día">${panelInner()}</aside><div class="sheet-bg" data-sheet-close></div>`;
function openSheet() { ui.sheet = true; const p = $('#panel'); if (p) p.classList.add('open'); document.body.classList.add('sheet-open'); }
function closeSheet() { ui.sheet = false; const p = $('#panel'); if (p) p.classList.remove('open'); document.body.classList.remove('sheet-open'); }

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
    if (m.pending || m.cancelled) continue;
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
  for (const m of list) if (m.type === 'in' && !m.pending && !m.cancelled && !m.packId) {
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
    <li><span class="pos-n out">−</span>
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
    ${ui.period === 'month' ? goalCard(s.getFullYear(), s.getMonth()) : ''}
    ${cancelBar(t, list)}
    <div class="sumgrid">
    <div class="two">
      <div class="card pad">
        <h3>${ui.period === 'year' ? 'Mes por mes' : 'Día por día'}</h3>
        <div class="legend"><span><i style="background:var(--in)"></i>Ingresos</span><span><i style="background:var(--out)"></i>Egresos</span></div>
        <div class="chart" role="group" aria-label="Gráfico de barras de ingresos y egresos">${bars}</div>
        <div class="muted" style="font-size:.8rem;margin-top:8px">Tocar una barra para ver ${ui.period === 'year' ? 'ese mes' : 'ese día'}.</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="card pad"><h3>Clientes que más ingresos dejan</h3>
          ${ranked.length ? `<ol class="rank">${rank}</ol>` : `<div class="empty">Todavía no hay ingresos en este período.</div>`}
        </div>
        <div class="card pad"><h3>En qué se gasta</h3>
          ${outs.length ? `<ol class="rank">${outHtml}</ol>` : `<div class="empty">Sin egresos en este período.</div>`}
        </div>
      </div>
    </div>
    <div class="two" style="margin-top:16px">
      ${renderWhen(list)}
      <div class="stack">${renderPend()}${renderPacks()}</div>
    </div>
    </div>
  </section>`;
}

/* Horarios y días con más clases (todas las clases del período, cobradas o no). */
function renderWhen(list) {
  const classes = list.filter(m => m.type === 'in' && !m.cancelled && !(m.packSize > 0));
  const timed = classes.filter(m => m.time);
  const noTime = classes.length - timed.length;
  const col = (key, n, sum, label, max, peak) => `<div class="wcol${peak ? ' peak' : ''}" title="${esc(label)}: ${n} clase${n === 1 ? '' : 's'} · ${money(sum)}"><span class="wn">${n || ''}</span><span class="wbar" style="height:${n ? Math.max(4, n / max * 100) : 0}%"></span><span class="wl">${esc(key)}</span></div>`;
  let body;
  if (!timed.length) {
    body = `<div class="empty">Cargar la <b>hora</b> de las clases para ver cuáles son los horarios más ocupados.</div>`;
  } else {
    const hours = new Map();
    timed.forEach(m => { const h = +m.time.slice(0, 2); const r = hours.get(h) || { n: 0, sum: 0 }; r.n++; r.sum += m.amount; hours.set(h, r); });
    const hs = [...hours.keys()], lo = Math.min(...hs), hi = Math.max(...hs);
    const hmax = Math.max(...[...hours.values()].map(r => r.n));
    const peakH = [...hours.entries()].sort((a, b) => b[1].n - a[1].n || b[1].sum - a[1].sum)[0];
    let hcols = '';
    for (let h = Math.min(lo, hi - 5); h <= hi; h++) { const r = hours.get(h) || { n: 0, sum: 0 }; hcols += col(pad(h), r.n, r.sum, `${pad(h)}:00 a ${pad(h)}:59`, hmax, h === peakH[0] && r.n); }
    const wd = Array.from({ length: 7 }, () => ({ n: 0, sum: 0 }));
    classes.forEach(m => { const k = (parse(m.date).getDay() + 6) % 7; wd[k].n++; wd[k].sum += m.amount; });
    const wmax = Math.max(1, ...wd.map(r => r.n));
    const peakW = wd.reduce((b, r, k) => r.n > wd[b].n ? k : b, 0);
    const names = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
    body = `
      <p class="insight">Horario más pedido: <b>${pad(peakH[0])}:00 hs</b> (${peakH[1].n} clase${peakH[1].n > 1 ? 's' : ''}) · Día más fuerte: <b>${names[peakW]}</b> (${wd[peakW].n})</p>
      <div class="l" style="margin:10px 0 4px">Por hora de inicio</div>
      <div class="when">${hcols}</div>
      <div class="l" style="margin:14px 0 4px">Por día de la semana</div>
      <div class="when">${wd.map((r, k) => col(DAYS_SHORT[k], r.n, r.sum, cap(names[k]), wmax, k === peakW && r.n)).join('')}</div>
      ${noTime ? `<div class="muted small" style="margin-top:8px">${noTime} clase${noTime > 1 ? 's' : ''} sin hora cargada no entra${noTime > 1 ? 'n' : ''} en el gráfico por hora.</div>` : ''}`;
  }
  return `<div class="card pad"><h3>Horarios con más clases</h3>${body}</div>`;
}

/* Canceladas del período, con el motivo, y cuánta plata no se cobró por eso. */
function cancelBar(t, list) {
  if (!t.nc) return '';
  const by = new Map();
  list.filter(m => m.cancelled).forEach(m => by.set(m.reason || 'Cancelada', (by.get(m.reason || 'Cancelada') || 0) + 1));
  const parts = [...by.entries()].sort((a, b) => b[1] - a[1]).map(([r, n]) => `${esc(r)} ${n}`).join(' · ');
  return `<div class="cancelbar"><span><b>${t.nc} clase${t.nc > 1 ? 's' : ''} cancelada${t.nc > 1 ? 's' : ''}</b> (${parts})${t.lost ? ` · ${mny(t.lost)} que no se cobraron` : ''}</span></div>`;
}

/* Packs con clases por usar, de todos los clientes. */
function renderPacks() {
  const act = [...packs().values()].filter(p => packLeft(p) > 0).sort((a, b) => packLeft(a) - packLeft(b));
  const rows = act.map(p => `
    <li class="pack-row">
      <div class="pk-top"><span class="nm">${esc(p.client || 'Sin cliente')}</span><span class="pk-n">${packLeft(p) <= 1 ? '<span class="tag">Renovar</span>' : ''} <b>${packLeft(p)}</b> de ${p.size}</span></div>
      <div class="track"><span class="fill" style="width:${(p.used / p.size * 100).toFixed(0)}%"></span></div>
    </li>`).join('');
  return `<div class="card pad"><h3>Packs con clases por usar</h3>${rows ? `<ul class="pack-list">${rows}</ul>` : `<div class="empty">Ningún pack activo.<br>Se carga como ingreso, categoría “Pack de clases”.</div>`}</div>`;
}

/* Deudas: todas las clases pendientes de cobro, sin importar el período. */
function renderPend() {
  const groups = new Map();
  for (const m of allPending()) {
    const name = (m.client || '').trim(), k = name.toLowerCase();
    const g = groups.get(k) || { name: name || 'Sin cliente asignado', total: 0, n: 0, first: m.date, none: !name, key: k };
    g.total += m.amount; g.n++; if (m.date < g.first) g.first = m.date;
    groups.set(k, g);
  }
  const rows = [...groups.values()].sort((a, b) => a.first.localeCompare(b.first));
  const total = rows.reduce((a, g) => a + g.total, 0);
  const fd = d => { const x = parse(d); return `${x.getDate()} ${MONTHS[x.getMonth()].slice(0, 3)}`; };
  const html = rows.map(g => `
    <li class="pend-row">
      <button class="pend-go" data-goto="${g.first}" title="Ver el día más antiguo">
        <span class="nm ${g.none ? 'muted' : ''}">${esc(g.name)}</span>
        <span class="meta">${g.n} clase${g.n > 1 ? 's' : ''} · desde el ${fd(g.first)}</span>
      </button>
      <span class="am">${mny(g.total)}</span>
      <button class="btn pay-all" data-payall="${esc(g.key)}">Cobrado</button>
    </li>`).join('');
  return `<div class="card pad"><h3>Por cobrar</h3>
    ${rows.length ? `<div class="pend-total"><span class="l">Te deben en total</span><span class="v">${mny(total)}</span></div><ul class="pend-list">${html}</ul>`
      : `<div class="empty">No hay clases pendientes de cobro.<br>Al cargar una clase se puede tildar “Todavía no me pagó”.</div>`}
  </div>`;
}

/* ============ Ventanas como hoja inferior (celular) ============
   En pantallas chicas, las ventanas suben desde abajo, como en Android, y se cierran bajándolas con el dedo. */
function openDlg(d) { d.classList.remove('closing'); d.style.transform = ''; d.style.transition = ''; d.showModal(); }
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function closeAnim(d) {
  if (!d.open) return;
  if (!isMobile() || reduceMotion()) { d.close(); return; }
  if (d.classList.contains('closing')) return;
  d.classList.add('closing');
  let done = false;
  const end = () => { if (done) return; done = true; d.classList.remove('closing'); d.style.transform = ''; d.style.transition = ''; if (d.open) d.close(); };
  d.addEventListener('animationend', end, { once: true });
  setTimeout(end, 300);
}
document.querySelectorAll('dialog').forEach(d => {
  // Esc (o el gesto "atrás") también cierra con la animación
  d.addEventListener('cancel', e => { if (isMobile() && !reduceMotion()) { e.preventDefault(); closeAnim(d); } });
  // Arrastrar la manija hacia abajo para cerrar
  const g = d.querySelector('.sheet-grab'); if (!g) return;
  let y0 = null, dy = 0;
  g.addEventListener('pointerdown', e => { if (!isMobile()) return; y0 = e.clientY; dy = 0; g.setPointerCapture(e.pointerId); d.style.transition = 'none'; });
  g.addEventListener('pointermove', e => { if (y0 === null) return; dy = Math.max(0, e.clientY - y0); d.style.transform = `translateY(${dy}px)`; });
  const release = () => {
    if (y0 === null) return;
    y0 = null; d.style.transition = 'transform .18s ease-out';
    if (dy > 90) closeAnim(d); else d.style.transform = '';
  };
  g.addEventListener('pointerup', release); g.addEventListener('pointercancel', release);
});
/* En el celular se enfoca el campo cuando la hoja ya terminó de subir (así el teclado no compite con la animación). */
const focusSoon = el => { if (isMobile()) setTimeout(() => el.focus({ preventScroll: true }), 260); else el.focus(); };

/* ============ Formulario ============ */
const dlg = $('#dlg'), form = $('#form');
let editing = null, reprog = null;

function fillCats(type, selected) {
  $('#f-cat').innerHTML = CATS[type].map(c => `<option${c === selected ? ' selected' : ''}>${esc(c)}</option>`).join('');
}
function refreshChips() {
  const type = form.type.value;
  const count = new Map();
  movs.filter(m => m.type === type && m.amount > 0 && !(m.packSize > 0)).forEach(m => count.set(m.amount, (count.get(m.amount) || 0) + 1));
  const top = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(x => x[0]).sort((a, b) => a - b);
  $('#chips').innerHTML = top.map(v => `<button type="button" class="chip" data-amt="${v}">${nf.format(v)}</button>`).join('');
}
function refreshTimeChips() {
  const cnt = new Map();
  movs.forEach(m => { if (m.time) cnt.set(m.time, (cnt.get(m.time) || 0) + 1); });
  const top = [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => x[0]).sort();
  $('#time-chips').innerHTML = top.map(v => `<button type="button" class="chip" data-time="${v}">${v}</button>`).join('') +
    `<button type="button" class="chip ghost" data-time="">Sin hora</button>`;
}
/* Aviso (no bloquea): ya hay una clase ese día a la misma hora o muy cerca (una clase dura ~1 h). Las canceladas no cuentan. */
function conflicts() {
  const time = $('#f-time').value, date = $('#f-date').value;
  if (form.type.value !== 'in' || form.state.value === 'cancel' || !time || !date) return [];
  const me = toMin(time), skip = reprog ? reprog.id : editing && editing.id;
  return movs.filter(m => m.type === 'in' && m.time && !m.cancelled && !(m.packSize > 0) && m.date === date && m.id !== skip && Math.abs(toMin(m.time) - me) < 60)
    .sort((a, b) => a.time.localeCompare(b.time));
}
function showConflict() {
  const c = conflicts(), el = $('#time-warn');
  el.classList.toggle('hidden', !c.length);
  if (!c.length) return;
  const who = m => `${m.time}${m.client ? ' ' + m.client : ''}`;
  el.textContent = c.length === 1 ? `Ojo: ya hay una clase a las ${who(c[0])}. ¿Se pisan?` : `Ojo: ya hay ${c.length} clases cerca de esa hora (${c.map(who).join(', ')}). ¿Se pisan?`;
}
/* Muestra u oculta cada campo según el tipo, la categoría, el estado y si el alumno tiene un pack. */
function syncFormUI() {
  const isIn = form.type.value === 'in';
  const cat = $('#f-cat').value, packBuy = isIn && cat === PACK_CAT;
  $('#client-field').classList.toggle('hidden', !isIn);
  $('#state-field').classList.toggle('hidden', !isIn);
  $('#pack-field').classList.toggle('hidden', !packBuy);
  $('#f-packsize').required = packBuy;
  const cand = isIn && !packBuy ? activePacksFor($('#f-client').value, editing && editing.packId) : [];
  const pk = cand[0], row = $('#packuse-field');
  const wasHidden = row.classList.contains('hidden');
  row.classList.toggle('hidden', !pk);
  if (pk) {
    $('#packuse-text').innerHTML = `Descontar de su pack <small>(quedan ${packLeft(pk)} de ${pk.size})</small>`;
    if (wasHidden && !editing && !reprog) $('#f-packuse').checked = true;     // si tiene pack, lo normal es descontar
  } else $('#f-packuse').checked = false;
  const using = !!pk && $('#f-packuse').checked;
  row.classList.toggle('on', using);
  form.dataset.packId = using ? pk.id : '';
  if (using && form.state.value === 'pending') $('#s-paid').checked = true;
  $('#s-pending').disabled = using;
  const cancel = isIn && form.state.value === 'cancel';
  $('#reason-field').classList.toggle('hidden', !cancel);
  const amt = $('#f-amount');
  amt.required = !(using || cancel);
  amt.disabled = using;
  if (using) amt.value = '';
  showConflict();
}
function openForm({ id, date, type, time } = {}) {
  editing = id ? movs.find(m => m.id === id) : null;
  reprog = null;
  const m = editing;
  const ty = m ? m.type : (type || 'in');
  $('#dlg-title').textContent = m ? 'Editar movimiento' : 'Nuevo movimiento';
  form.type.value = ty;
  fillCats(ty, m ? m.category : CATS[ty][0]);
  $('#f-amount').value = m && m.amount ? m.amount : '';
  $('#f-date').value = m ? m.date : (date || ui.sel);
  $('#f-time').value = m ? (m.time || '') : (time || '');
  refreshTimeChips();
  $('#f-client').value = m ? (m.client || '') : '';
  $('#f-note').value = m ? (m.note || '') : '';
  $('#f-packsize').value = m && m.packSize ? m.packSize : '';
  $('#f-packuse').checked = !!(m && m.packId);
  (m && m.cancelled ? $('#s-cancel') : m && m.pending ? $('#s-pending') : $('#s-paid')).checked = true;
  $('#f-reason').innerHTML = REASONS.map(r => `<option${m && m.reason === r ? ' selected' : ''}>${r}</option>`).join('');
  $('#clients').innerHTML = [...new Set(movs.map(x => x.client).filter(Boolean))].sort().map(c => `<option value="${esc(c)}">`).join('');
  $('#f-del').classList.toggle('hidden', !m);
  $('#f-reprog').classList.toggle('hidden', !(m && m.type === 'in' && !m.cancelled && !(m.packSize > 0)));
  $('#reprog-hint').classList.add('hidden');
  $('#another-row').classList.toggle('hidden', !!m);
  refreshChips();
  syncFormUI();
  openDlg(dlg);
  focusSoon(ty === 'in' && !(m && m.cancelled) ? $('#f-amount') : $('#f-note'));
}
form.addEventListener('change', e => {
  if (e.target.name === 'type') { const cur = $('#f-cat').value; fillCats(form.type.value, CATS[form.type.value].includes(cur) ? cur : CATS[form.type.value][0]); refreshChips(); }
  if (e.target.name === 'type' || e.target.name === 'state' || e.target.id === 'f-cat' || e.target.id === 'f-packuse') syncFormUI();
});
$('#f-client').addEventListener('input', syncFormUI);
$('#chips').addEventListener('click', e => {
  const b = e.target.closest('[data-amt]');
  if (b) { $('#f-amount').value = b.dataset.amt; (form.type.value === 'in' ? $('#f-client') : $('#f-note')).focus(); }
});
$('#time-chips').addEventListener('click', e => {
  const b = e.target.closest('[data-time]');
  if (b) { $('#f-time').value = b.dataset.time; showConflict(); }
});
$('#f-time').addEventListener('input', showConflict);
$('#f-date').addEventListener('input', showConflict);
$('#f-cancel').addEventListener('click', () => closeAnim(dlg));
dlg.addEventListener('click', e => { if (e.target === dlg) closeAnim(dlg); });
$('#f-del').addEventListener('click', () => {
  if (!editing) return;
  const removed = editing;
  removeMov(removed);
  save(); closeAnim(dlg); render();
  toast('Movimiento eliminado', 'Deshacer', () => { putMov(removed); save(); render(); });
});
/* Reprogramar: la clase original queda como cancelada ("Reprogramada") y se crea la nueva en la fecha y hora elegidas. */
$('#f-reprog').addEventListener('click', () => {
  if (!editing) return;
  reprog = editing;
  $('#dlg-title').textContent = 'Reprogramar clase';
  const h = $('#reprog-hint');
  h.textContent = `La clase del ${longDay(editing.date)}${editing.time ? ' a las ' + editing.time : ''} queda como cancelada (reprogramada). Elegí la nueva fecha y hora.`;
  h.classList.remove('hidden');
  $('#f-del').classList.add('hidden'); $('#f-reprog').classList.add('hidden');
  $('#f-date').focus();
  showConflict();
});
form.addEventListener('submit', e => {
  e.preventDefault();
  const another = e.submitter && e.submitter.value === 'another';
  const type = form.type.value, isIn = type === 'in';
  const state = isIn ? form.state.value : 'paid';
  const cancel = state === 'cancel';
  const category = $('#f-cat').value;
  const packBuy = isIn && category === PACK_CAT;
  const packId = form.dataset.packId || '';
  const date = $('#f-date').value, time = $('#f-time').value || '';
  let amount = packId ? 0 : Math.round((parseFloat($('#f-amount').value) || 0) * 100) / 100;
  if (!date || (!packId && !cancel && !(amount > 0))) return;
  const size = packBuy ? parseInt($('#f-packsize').value, 10) : 0;
  if (packBuy && !(size > 0)) return;
  if (reprog && date === reprog.date && time === (reprog.time || '')) {
    const w = $('#time-warn'); w.textContent = 'Para reprogramar, elegí otra fecha u otra hora.'; w.classList.remove('hidden'); return;
  }
  const rec = {
    id: editing && !reprog ? editing.id : uid(), date, time, type, amount,
    pending: isIn && state === 'pending', cancelled: isIn && cancel, reason: cancel ? $('#f-reason').value : '',
    packSize: size || 0, packId,
    category, client: isIn ? $('#f-client').value.trim() : '', note: $('#f-note').value.trim()
  };
  if (reprog) putMov({ ...reprog, cancelled: true, reason: 'Reprogramada', pending: false });
  putMov(rec);
  save();
  const d = parse(date);
  ui.sel = date; ui.y = d.getFullYear(); ui.m = d.getMonth();
  const wasReprog = !!reprog; reprog = null;
  if (another) {
    render();
    openForm({ date, type, time: rec.time ? addMin(rec.time, 60) : '' });   // sugiere la clase siguiente, 1 hora después
    toast('Guardado');
  } else {
    closeAnim(dlg); render();
    toast(wasReprog ? 'Clase reprogramada' : 'Guardado');
  }
});

/* ============ Meta mensual ============ */
const dlgGoal = $('#dlg-goal');
function openGoal() {
  $('#g-val').value = goal || '';
  $('#g-off').classList.toggle('hidden', !goal);
  openDlg(dlgGoal);
  $('#g-val').focus();
}
$('#goal-form').addEventListener('submit', e => { e.preventDefault(); setGoal(parseFloat($('#g-val').value) || 0); closeAnim(dlgGoal); render(); toast(goal ? 'Meta guardada' : 'Meta quitada'); });
$('#g-off').addEventListener('click', () => { setGoal(0); closeAnim(dlgGoal); render(); toast('Meta quitada'); });
$('#g-close').addEventListener('click', () => closeAnim(dlgGoal));
dlgGoal.addEventListener('click', e => { if (e.target === dlgGoal) closeAnim(dlgGoal); });

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
  const rows = [['Fecha', 'Hora', 'Tipo', 'Categoría', 'Cliente', 'Nota', 'Monto (ARS)', 'Estado', 'Motivo']].concat(
    [...movs].sort((a, b) => a.date.localeCompare(b.date) || byTime(a, b)).map(m => [m.date, m.time || '', m.type === 'in' ? 'Ingreso' : 'Egreso', m.category, m.client, m.note, String(m.amount).replace('.', ','), m.type === 'in' ? (m.cancelled ? 'Cancelada' : m.pending ? 'Pendiente' : m.packId ? 'De pack' : 'Cobrado') : '', m.reason || '']));
  download(`tenis-movimientos-${today()}.csv`, '﻿' + rows.map(r => r.map(q).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
}
$('#file').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    const list = (Array.isArray(data) ? data : data.movimientos).filter(validMov);
    if (!confirm(`Se encontraron ${list.length} movimientos. Esto reemplaza lo que hay cargado ahora (${movs.length}). ¿Continuar?`)) return;
    replaceAll(list); if (data && data.meta > 0) setGoal(data.meta); save(); render(); toast('Copia restaurada');
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
    const base = ['06:30', '07:30', '08:30', '09:30', '10:30', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
    const first = Math.floor(rnd() * (base.length - n));
    for (let k = 0; k < n; k++) {
      const time = rnd() < 0.1 ? `${pad(8 + Math.floor(rnd() * 11))}:${pad(Math.floor(rnd() * 60))}` : base[first + k];
      if (rnd() < 0.2) { out.push({ id: uid(), date: s, time, type: 'in', amount: 30000, category: 'Clase grupal', client: 'Club Los Aromos', note: 'Grupo infantil' }); courts++; continue; }
      const c = pick(clients);
      const cx = rnd() < 0.06;
      out.push({ id: uid(), date: s, time, type: 'in', amount: prices[c], category: 'Clase individual', client: c, note: '1 hora', pending: !cx && d > addDays(end, -9) && rnd() < 0.3, cancelled: cx, reason: cx ? pick(['Lluvia', 'Faltó el alumno']) : '' });
      courts++;
    }
    if (courts >= 3) out.push({ id: uid(), date: s, time: '', type: 'out', amount: 9000, category: 'Alquiler de cancha', client: '', note: '' });
    if (rnd() < 0.25) out.push({ id: uid(), date: s, type: 'out', amount: 3500, category: 'Transporte', client: '', note: '' });
    if (d.getDate() === 5) out.push({ id: uid(), date: s, type: 'out', amount: 28000, category: 'Pelotas y material', client: '', note: 'Tubos de pelotas' });
  }
  // Un pack de 8 clases pagado por adelantado (usadas 5)
  const packId = uid(), bought = addDays(end, -22);
  out.push({ id: packId, date: ymd(bought), time: '', type: 'in', amount: 100000, category: 'Pack de clases', client: 'Sofía Benítez', note: '8 clases', packSize: 8 });
  [['-19', '17:30'], ['-16', '18:30'], ['-12', '17:30'], ['-8', '19:00'], ['-4', '18:30']].forEach(([off, time]) =>
    out.push({ id: uid(), date: ymd(addDays(end, +off)), time, type: 'in', amount: 0, category: 'Clase individual', client: 'Sofía Benítez', note: '1 hora', packId }));
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
async function post(url, body) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 30000);
  try {
    const res = await fetch(url, {
      method: 'POST', redirect: 'follow', signal: ctl.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // evita el "preflight" CORS
      body: JSON.stringify(body)
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
const cloudCall = (records, since) => post(cfg.url, { key: cfg.key, records, since });
const pair = async url => (await post(url, { action: 'pair' })).key;   // la primera vez, la planilla entrega su clave

/* Une lo recibido con lo local: para cada id gana el cambio más reciente. */
function mergeRemote(remote) {
  const local = new Map();
  movs.forEach(m => local.set(m.id, { u: m.u || 0, rec: m }));
  tombs.forEach(t => local.set(t.id, { u: t.u, del: true }));
  let changed = false;
  dataVer++;
  for (const r of remote) {
    const l = local.get(r.id);
    if (l && !(r.u > l.u)) continue;
    changed = true;
    local.set(r.id, r.del ? { u: r.u, del: true } : { u: r.u, rec: { id: r.id, date: r.date, time: r.time || '', pending: !!r.pending && r.type === 'in', cancelled: !!r.cancelled && r.type === 'in', reason: r.reason || '', packSize: r.packSize || 0, packId: r.packId || '', type: r.type, amount: r.amount, category: r.category, client: r.client, note: r.note, u: r.u } });
  }
  movs = []; tombs = [];
  for (const [id, l] of local) {
    if (l.del) tombs.push({ id, u: l.u });
    else if (validMov(l.rec)) movs.push(l.rec);
  }
  return changed;
}
/* Bajar solo lo que cambió desde la última vez (con un margen por si los relojes no coinciden), y una bajada completa cada tanto. */
const PULL_MARGIN = 6 * 3600e3, FULL_EVERY = 12 * 3600e3;
async function sync(full = false) {
  if (!cfg) return false;
  if (syncing) { pendingSync = true; return false; }
  syncing = true; setSync('syncing');
  const started = Date.now();
  let ok = false;
  try {
    const dirty = [...movs.filter(m => m.u > lastPush), ...tombs.filter(t => t.u > lastPush).map(t => ({ id: t.id, u: t.u, del: true }))];
    const since = (!full && lastPull && Date.now() - lastFull < FULL_EVERY) ? Math.max(1, lastPull - PULL_MARGIN) : 0;
    const data = await cloudCall(dirty, since);
    const changed = mergeRemote(data.records);
    lastPush = started; lastOk = Date.now();
    lastPull = data.now || Date.now(); if (!since) lastFull = Date.now();
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
  $('#c-off').classList.toggle('hidden', !cfg);
  $('#c-now-row').classList.toggle('hidden', !cfg);
  showCode();
  showCloudStatus();
  openDlg(dlgCloud);
}
function showCode() {
  $('#c-code-row').classList.toggle('hidden', !cfg);
  $('#c-code').value = cfg ? `${cfg.url}#${cfg.key}` : '';
  $('#c-copy').textContent = 'Copiar código';
}
function showCloudStatus() {
  const el = $('#cloud-status');
  el.className = 'small ' + (syncState === 'error' ? 'neg' : syncState === 'ok' ? 'pos' : 'muted');
  el.textContent = !cfg ? 'Pegar la URL que da Google al publicar el script. Si la planilla ya está conectada en otro dispositivo, pegar el código que muestra ese dispositivo.'
    : syncState === 'error' ? 'Problema: ' + syncMsg
    : syncState === 'ok' ? 'Conectada. ' + syncMsg
    : 'Conectada.';
}
$('#sync-btn').addEventListener('click', openCloud);
$('#c-close').addEventListener('click', () => closeAnim(dlgCloud));
dlgCloud.addEventListener('click', e => { if (e.target === dlgCloud) closeAnim(dlgCloud); });
$('#c-now').addEventListener('click', async () => { $('#cloud-status').textContent = 'Sincronizando…'; await sync(true); showCloudStatus(); });
$('#c-copy').addEventListener('click', async () => {
  const el = $('#c-code');
  try { await navigator.clipboard.writeText(el.value); } catch (e) { el.select(); try { document.execCommand('copy'); } catch (e2) {} }
  $('#c-copy').textContent = '¡Copiado!';
});
$('#c-off').addEventListener('click', () => {
  if (!confirm('¿Desconectar de la nube? Los datos siguen en este dispositivo y en la planilla, pero ya no se sincronizan.\n\nPara volver a conectar vas a necesitar el código (se ve en esta misma ventana: copialo antes).')) return;
  cfg = null; lastPush = 0; lastPull = 0; lastFull = 0; try { localStorage.removeItem(KEY_CLOUD); } catch (e) {}
  persist(); setSync('off'); closeAnim(dlgCloud); render();
});
$('#cloud-form').addEventListener('submit', async e => {
  e.preventDefault();
  const [urlPart, ...rest] = $('#c-url').value.trim().split('#');
  const url = urlPart.trim(); let key = rest.join('#').trim();      // acepta "URL" o "URL#clave" (código de otro dispositivo)
  const st = $('#cloud-status');
  if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(url)) { st.className = 'small neg'; st.textContent = 'La URL tiene que empezar con https://script.google.com/ y terminar en /exec'; return; }
  st.className = 'small muted'; st.textContent = 'Conectando…';
  const prev = { cfg, lastPush, lastPull, lastFull };
  let justPaired = false;
  if (!key) {
    try { key = await pair(url); justPaired = true; }
    catch (err) { st.className = 'small neg'; st.textContent = 'No se pudo conectar: ' + err.message; return; }
  }
  cfg = { url, key }; lastPush = 0; lastPull = 0; lastFull = 0;
  if (justPaired) { try { localStorage.setItem(KEY_CLOUD, JSON.stringify(cfg)); } catch (e2) {} }   // la clave ya no se puede volver a pedir: guardarla enseguida
  if (await sync()) {
    try { localStorage.setItem(KEY_CLOUD, JSON.stringify(cfg)); } catch (e2) {}
    showCode(); closeAnim(dlgCloud); render(); toast('Conectado a Google Sheets');
  } else if (justPaired) {
    showCode(); showCloudStatus(); render();       // vinculada; la sincronización se reintenta sola
  } else {
    const msg = syncMsg;
    cfg = prev.cfg; lastPush = prev.lastPush; lastPull = prev.lastPull; lastFull = prev.lastFull; setSync(cfg ? 'idle' : 'off');
    st.className = 'small neg'; st.textContent = 'No se pudo conectar: ' + msg;
  }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleSync(300); });
window.addEventListener('online', () => scheduleSync(300));
setInterval(() => { if (!document.hidden) scheduleSync(0); }, 120000);

/* ============ Modo claro / oscuro ============ */
const KEY_THEME = 'tenis-caja-tema';
const mqDark = window.matchMedia('(prefers-color-scheme: dark)');
const root = document.documentElement;
const effectiveTheme = () => root.dataset.theme || (mqDark.matches ? 'dark' : 'light');
const ICON_SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const ICON_MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/></svg>';
function applyTheme() {
  const t = effectiveTheme(), btn = $('#theme-btn');
  btn.innerHTML = t === 'dark' ? ICON_SUN : ICON_MOON;      // muestra el modo al que se puede cambiar
  const label = t === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  btn.setAttribute('aria-label', label); btn.title = label;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = t === 'dark' ? '#7a361c' : '#b4502a';
}
function setTheme(t) {            // t: 'light' | 'dark' | null (automático)
  if (t) root.dataset.theme = t; else delete root.dataset.theme;
  try { if (t) localStorage.setItem(KEY_THEME, t); else localStorage.removeItem(KEY_THEME); } catch (e) {}
  applyTheme();
}
$('#theme-btn').addEventListener('click', () => setTheme(effectiveTheme() === 'dark' ? 'light' : 'dark'));
mqDark.addEventListener('change', applyTheme);
applyTheme();

/* ============ Eventos ============ */
const menu = $('#menu'), menuBtn = $('#menu-btn');
const closeMenu = () => { menu.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); };
menuBtn.addEventListener('click', e => { e.stopPropagation(); const o = menu.classList.toggle('open'); menuBtn.setAttribute('aria-expanded', o); });
document.addEventListener('click', e => { if (!menu.contains(e.target)) closeMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeMenu(); if (ui.sheet && !document.querySelector('dialog[open]')) closeSheet(); } });

menu.addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  closeMenu();
  if (a.dataset.act === 'cloud') return openCloud();
  if (a.dataset.act === 'goal') return openGoal();
  if (a.dataset.act === 'theme-auto') return setTheme(null);
  if (a.dataset.act === 'export-json') download(`tenis-copia-${today()}.json`, JSON.stringify({ app: 'tenis-caja', version: 2, meta: goal, movimientos: movs }, null, 1), 'application/json');
  if (a.dataset.act === 'import-json') $('#file').click();
  if (a.dataset.act === 'export-csv') exportCSV();
  if (a.dataset.act === 'wipe' && confirm('¿Borrar TODOS los movimientos? Esto no se puede deshacer (conviene descargar una copia antes).')) { replaceAll([]); save(); render(); }
});

document.querySelector('.tabs').addEventListener('click', e => {
  const b = e.target.closest('[data-view]'); if (!b) return;
  ui.view = b.dataset.view; ui.sheet = false; render(); window.scrollTo({ top: 0 });
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
  if ((el = t.closest('[data-sheet-close]'))) return closeSheet();
  if ((el = t.closest('[data-act="goal"]'))) return openGoal();
  if ((el = t.closest('[data-edit]'))) return openForm({ id: el.dataset.edit });
  if ((el = t.closest('[data-pay]'))) {
    const m = movs.find(x => x.id === el.dataset.pay); if (!m) return;
    const before = { ...m };
    putMov({ ...m, pending: false }); save(); render();
    return toast('Marcado como cobrado', 'Deshacer', () => { putMov(before); save(); render(); });
  }
  if ((el = t.closest('[data-payall]'))) {
    const key = el.dataset.payall;
    const list = allPending().filter(m => (m.client || '').trim().toLowerCase() === key);
    if (!list.length) return;
    const tot = list.reduce((a, m) => a + m.amount, 0);
    if (!confirm(`¿Marcar como cobradas ${list.length} clase${list.length > 1 ? 's' : ''} (${money(tot)})?`)) return;
    const before = list.map(m => ({ ...m }));
    list.forEach(m => putMov({ ...m, pending: false })); save(); render();
    return toast('Marcado como cobrado', 'Deshacer', () => { before.forEach(putMov); save(); render(); });
  }
  if ((el = t.closest('[data-goto]'))) { ui.view = 'cal'; selectDay(el.dataset.goto, false, true); render(); return window.scrollTo({ top: 0 }); }
  if ((el = t.closest('[data-view-go]'))) { ui.view = el.dataset.viewGo; render(); return window.scrollTo({ top: 0 }); }
  if ((el = t.closest('[data-date]'))) {
    selectDay(el.dataset.date, false, true);
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
      case 'sample': replaceAll(sampleData()); if (!goal) setGoal(1500000); save(); break;
    }
    render();
  }
});

/* Teclado: flechas para moverse entre días del calendario. */
app.addEventListener('keydown', e => {
  const b = e.target.closest && e.target.closest('.day');
  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
  if (!b || !step) return;
  e.preventDefault();
  selectDay(ymd(addDays(parse(b.dataset.date), step)), true);
});

/* Instalable y sin señal: solo cuando se abre desde internet (no desde un archivo local). */
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

setSync(syncState);
render();
scheduleSync(200);
})();
