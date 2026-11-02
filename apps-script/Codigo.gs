/**
 * Agenda y caja · Clases de tenis — "puerta" hacia Google Sheets.
 *
 * Se pega en la planilla (Extensiones → Apps Script) y se publica como
 * aplicación web. Ver LEEME-NUBE.md para los pasos.
 *
 * Cada movimiento es una fila. Los borrados quedan marcados con "SI" en la
 * columna "eliminado" (así se sincronizan con el celular y la computadora).
 */

// ⚠ CAMBIAR por una clave larga y propia (la misma que se pone en la página).
const CLAVE = 'cambiar-esta-clave';

const HOJA = 'Movimientos';
const COLUMNAS = ['id', 'fecha', 'tipo', 'monto (ARS)', 'categoria', 'cliente', 'nota', 'actualizado', 'eliminado'];
const COL_ACTUALIZADO = 8; // columna H

function hoja_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(HOJA);
  if (!sh) {
    sh = ss.insertSheet(HOJA);
    sh.appendRow(COLUMNAS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, COLUMNAS.length).setFontWeight('bold');
    // Texto plano en las columnas de texto: evita que Sheets convierta fechas
    // o interprete como fórmula algo que empiece con "=".
    ['A', 'B', 'C', 'E', 'F', 'G', 'I'].forEach(c => sh.getRange(c + '2:' + c).setNumberFormat('@'));
    sh.getRange('D2:D').setNumberFormat('#,##0.00');
    sh.getRange('H2:H').setNumberFormat('0');
    sh.setColumnWidth(1, 90);
  }
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
      type: String(r[2]).toLowerCase().charAt(0) === 'e' ? 'out' : 'in',
      amount: Number(r[3]),
      category: String(r[4]),
      client: String(r[5]),
      note: String(r[6]),
      u: Number(r[7]) || 0,
      del: String(r[8]).toUpperCase() === 'SI'
    }));
}

function aFila_(m) {
  return [
    String(m.id),
    String(m.date || ''),
    m.type === 'out' ? 'Egreso' : 'Ingreso',
    Number(m.amount) || 0,
    String(m.category || ''),
    String(m.client || ''),
    String(m.note || ''),
    Number(m.u) || Date.now(),
    m.del ? 'SI' : ''
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

function manejar_(clave, registros) {
  if (!CLAVE || CLAVE === 'cambiar-esta-clave') return { ok: false, error: 'Falta definir CLAVE en el script.' };
  if (clave !== CLAVE) return { ok: false, error: 'Clave incorrecta.' };
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
    if (sh.getRange(f, 1).getValue() === '' && sh.getRange(f, 4).getValue() !== '') {
      sh.getRange(f, 1).setValue(Utilities.getUuid().slice(0, 12));
    }
    sh.getRange(f, COL_ACTUALIZADO).setValue(Date.now());
  }
}
