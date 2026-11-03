/**
 * Agenda y caja · Clases de tenis — "puerta" hacia Google Sheets.
 *
 * Se pega en la planilla (Extensiones → Apps Script) y se publica como
 * aplicación web. Ver LEEME-NUBE.md para los pasos.
 *
 * Cada movimiento es una fila. Los borrados quedan marcados con "SI" en la
 * columna "eliminado" (así se sincronizan con el celular y la computadora).
 */

// No hay nada que configurar: la clave se genera sola la primera vez que se pega
// la URL en la página ("vinculación") y queda guardada en este script.

const HOJA = 'Movimientos';
const COLUMNAS = ['id', 'fecha', 'hora', 'tipo', 'monto (ARS)', 'categoria', 'cliente', 'nota', 'actualizado', 'eliminado', 'pendiente', 'cancelada', 'motivo', 'pack (clases)', 'pack (id)'];
const COL_MONTO = 5;        // columna E
const COL_ACTUALIZADO = 9; // columna I

function hoja_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(HOJA);
  const nueva = !sh;
  if (!sh) {
    sh = ss.insertSheet(HOJA);
    sh.appendRow(COLUMNAS);
    sh.setFrozenRows(1);
    const enc = sh.getRange(1, 1, 1, COLUMNAS.length);
    enc.setFontWeight('bold');
    enc.setBackground('#b4502a');
    enc.setFontColor('#ffffff');
    [90, 90, 55, 70, 100, 140, 150, 200, 100, 80, 80, 80, 130, 90, 100].forEach((w, i) => sh.setColumnWidth(i + 1, w));
    sh.getRange(1, 1, sh.getMaxRows(), COLUMNAS.length).createFilter();
  }
  // Formatos: texto plano en las columnas de texto (evita que Sheets convierta fechas
  // o interprete como fórmula algo que empiece con "="); números en las numéricas.
  // También agrega las columnas nuevas a hojas creadas con una versión anterior del script.
  const hdr = sh.getRange(1, 1, 1, COLUMNAS.length).getValues()[0];
  COLUMNAS.forEach((nombre, i) => {
    const faltaEncabezado = hdr[i] === '' || hdr[i] == null;
    if (nueva || faltaEncabezado) {
      if (faltaEncabezado) {
        sh.getRange(1, i + 1).setValue(nombre);
        sh.getRange(1, i + 1).setFontWeight('bold');
      }
      const filas = Math.max(1, sh.getMaxRows() - 1);
      const fmt = i === 4 ? '#,##0.00' : (i === 8 || i === 13) ? '0' : '@';
      sh.getRange(2, i + 1, filas, 1).setNumberFormat(fmt);
    }
  });
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function leer_(sh) {
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, COLUMNAS.length).getValues()
    .filter(r => r[0] !== '' && r[0] != null)
    .map(r => ({
      id: String(r[0]),
      date: String(r[1]),
      time: hora_(r[2]),
      type: String(r[3]).toLowerCase().charAt(0) === 'e' ? 'out' : 'in',
      amount: Number(r[4]),
      category: String(r[5]),
      client: String(r[6]),
      note: String(r[7]),
      u: Number(r[8]) || 0,
      del: String(r[9]).toUpperCase() === 'SI',
      pending: String(r[10]).toUpperCase() === 'SI',
      cancelled: String(r[11]).toUpperCase() === 'SI',
      reason: String(r[12]),
      packSize: Number(r[13]) || 0,
      packId: String(r[14])
    }));
}

/** Normaliza una hora a "HH:MM" (acepta "6:30", "06:30:00"). Vacío si no hay hora válida. */
function hora_(v) {
  const t = /^(\d{1,2}):(\d{2})/.exec(String(v == null ? '' : v).trim());
  if (!t || Number(t[1]) > 23 || Number(t[2]) > 59) return '';
  return ('0' + t[1]).slice(-2) + ':' + t[2];
}

function aFila_(m) {
  return [
    String(m.id),
    String(m.date || ''),
    hora_(m.time),
    m.type === 'out' ? 'Egreso' : 'Ingreso',
    Number(m.amount) || 0,
    String(m.category || ''),
    String(m.client || ''),
    String(m.note || ''),
    Number(m.u) || Date.now(),
    m.del ? 'SI' : '',
    m.pending && m.type !== 'out' ? 'SI' : '',
    m.cancelled && m.type !== 'out' ? 'SI' : '',
    String(m.reason || ''),
    Number(m.packSize) || '',
    String(m.packId || '')
  ];
}

/** Guarda (por id) los registros recibidos; gana el más reciente. */
function guardar_(sh, registros) {
  if (!registros || !registros.length) return;
  const last = sh.getLastRow();
  const existentes = {}; // id -> {fila, u}
  if (last >= 2) {
    sh.getRange(2, 1, last - 1, COL_ACTUALIZADO).getValues().forEach((r, i) => {
      if (r[0] !== '') existentes[String(r[0])] = { fila: i + 2, u: Number(r[COL_ACTUALIZADO - 1]) || 0 };
    });
  }
  const nuevas = [];
  registros.forEach(m => {
    if (!m || !m.id) return;
    const ex = existentes[String(m.id)];
    if (ex) {
      if ((Number(m.u) || 0) > ex.u) sh.getRange(ex.fila, 1, 1, COLUMNAS.length).setValues([aFila_(m)]);
    } else {
      nuevas.push(aFila_(m));
      existentes[String(m.id)] = { fila: -1, u: Number(m.u) || 0 };
    }
  });
  if (nuevas.length) {
    sh.getRange(sh.getLastRow() + 1, 1, nuevas.length, COLUMNAS.length).setValues(nuevas);
  }
}

function claveGuardada_() {
  return PropertiesService.getScriptProperties().getProperty('CLAVE') || '';
}

/**
 * Vinculación: la primera vez que alguien pega la URL en la página, se genera una clave
 * y se la devuelve. Desde ese momento todo pedido necesita esa clave. Si ya está vinculada,
 * no entrega nada (para sumar otro dispositivo se usa el código que muestra el primero).
 */
function vincular_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (claveGuardada_()) {
      return { ok: false, code: 'paired', error: 'Esta planilla ya está vinculada. En el otro dispositivo: Opciones → Guardar en la nube → “Código para otro dispositivo”, y pegarlo acá. (O, en la planilla: menú Tenis → Restablecer vinculación.)' };
    }
    const clave = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
    PropertiesService.getScriptProperties().setProperty('CLAVE', clave);
    hoja_();   // arma la hoja "Movimientos" con su estructura
    return { ok: true, key: clave };
  } finally {
    lock.releaseLock();
  }
}

function manejar_(clave, registros) {
  const guardada = claveGuardada_();
  if (!guardada) return { ok: false, code: 'unpaired', error: 'Todavía no está vinculada. Pegar la URL en la página para vincularla.' };
  if (clave !== guardada) return { ok: false, error: 'Clave incorrecta.' };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = hoja_();
    guardar_(sh, registros);
    return { ok: true, records: leer_(sh) };
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return json_(manejar_(e && e.parameter && e.parameter.key, []));
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'Pedido inválido.' }); }
  if (body.action === 'pair') return json_(vincular_());
  return json_(manejar_(body.key, body.records));
}

/**
 * Si se edita una fila a mano en la planilla, se marca como "actualizada"
 * para que el cambio llegue a la página. También completa el id de las filas
 * agregadas a mano.
 */
function onEdit(e) {
  const sh = e.range.getSheet();
  if (sh.getName() !== HOJA) return;
  if (e.range.getColumn() === COL_ACTUALIZADO) return;
  const desde = Math.max(2, e.range.getRow());
  const hasta = e.range.getRow() + e.range.getNumRows() - 1;
  for (let f = desde; f <= hasta; f++) {
    if (sh.getRange(f, 1).getValue() === '' && sh.getRange(f, COL_MONTO).getValue() !== '') {
      sh.getRange(f, 1).setValue(Utilities.getUuid().slice(0, 12));
    }
    sh.getRange(f, COL_ACTUALIZADO).setValue(Date.now());
  }
}

/** Menú "Tenis" en la planilla: permite desvincular (genera una clave nueva en la próxima vinculación). */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Tenis').addItem('Restablecer vinculación…', 'restablecer').addToUi();
}

function restablecer() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.alert('Restablecer vinculación',
    'Se borra la clave actual. Los dispositivos conectados dejan de sincronizar hasta volver a pegar la URL en la página (Opciones → Guardar en la nube). Los datos de la planilla NO se borran.\n\n¿Continuar?',
    ui.ButtonSet.YES_NO);
  if (r === ui.Button.YES) PropertiesService.getScriptProperties().deleteProperty('CLAVE');
}
