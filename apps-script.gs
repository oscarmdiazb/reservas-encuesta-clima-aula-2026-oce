/**
 * OCE-SED · Encuesta de clima de aula — booking backend.
 *
 * Backend for the static GitHub Pages site at:
 *   https://oscarmdiazb.github.io/reservas-encuesta-clima-aula-2026-oce/
 *
 * What this does:
 *   - GET  → returns counts per slot AND per-slot booking details
 *            (localidad, colegio, jornada, clase). Contacto + teléfono are
 *            never exposed by GET — they live only in the private Sheet.
 *   - POST → validates capacity and appends a row to the "Reservas" sheet.
 *   - Uses LockService so two concurrent bookings can't both fill the last seat.
 *
 * One-time setup:
 *   1) Open the Sheet → Extensions → Apps Script.
 *   2) Paste this whole file in.
 *   3) From the Apps Script editor, run the `setup` function once
 *      (this creates the "Reservas" tab, sets headers, and forces the
 *      Slot/Phone columns to plain-text so dates/numbers aren't
 *      auto-coerced).
 *   4) Deploy → New deployment → type "Web app",
 *      Execute as = me, Who has access = Anyone → copy the URL.
 *   5) Paste that URL into APPS_SCRIPT_URL in index.html.
 */

const SHEET_NAME = 'Reservas';
const ASSIGNMENTS_SHEET_NAME = 'Asignaciones';
const CAPACITY = 4;
const TIMEZONE = 'America/Bogota';
const SLOT_DURATION_HOURS = 2;
// Minutes the team needs after a session before it can take another booking
// (transit + setup buffer). 60 = 1h buffer, 120 = 2h buffer. Must be a multiple of 30.
// IMPORTANT: this same value also lives at the top of index.html — keep them in sync.
const BUFFER_MIN_AFTER = 60;
const TEAM_BLOCK_MIN = SLOT_DURATION_HOURS * 60 + BUFFER_MIN_AFTER;

// ---------- HTTP handlers ----------

function doGet(e) {
  try {
    const data = getCurrentData_();
    return jsonOut_({
      ok: true,
      bookings: data.counts,          // { "YYYY-MM-DD HH:mm": n }   (back-compat)
      details: data.details,          // { "YYYY-MM-DD HH:mm": [ { colegio, jornada, clase, localidad, sede, dane, ts } ] }
      assignments: getAssignments_(), // { "DANE|Jornada|Clase": "YYYY-MM-DD" }
      facilitadores: getFacilitadores_(), // { "DANE|Jornada|Clase": "Nombre" }
      capacity: CAPACITY
    });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    // Wait up to 10s for any in-flight write to finish.
    lock.waitLock(10000);

    if (!e || !e.postData || !e.postData.contents) {
      return jsonOut_({ ok: false, error: 'no_body' });
    }

    let body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return jsonOut_({ ok: false, error: 'invalid_json' });
    }

    // Branch: facilitator assignment (from acompanamiento.html) vs booking.
    if (body && body.action === 'set_facilitador') {
      return setFacilitador_(body);
    }

    const slot      = (body && body.slot)      ? String(body.slot).trim()      : '';
    const school    = (body && body.school)    ? String(body.school).trim()    : '';
    const grade     = (body && body.grade)     ? String(body.grade).trim()     : '';
    const jornada   = (body && body.jornada)   ? String(body.jornada).trim()   : '';
    const localidad = (body && body.localidad) ? String(body.localidad).trim() : '';
    const sede      = (body && body.sede)      ? String(body.sede).trim()      : '';
    const dane      = (body && body.dane)      ? String(body.dane).trim()      : '';
    const contact   = (body && body.contact)   ? String(body.contact).trim()   : '';
    const phone     = (body && body.phone)     ? String(body.phone).trim()     : '';

    if (!slot || !school || !grade || !contact || !phone) {
      return jsonOut_({ ok: false, error: 'missing_fields' });
    }
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(slot)) {
      return jsonOut_({ ok: false, error: 'invalid_slot' });
    }
    if (!/^\d{7,15}$/.test(phone)) {
      return jsonOut_({ ok: false, error: 'invalid_phone' });
    }

    // Re-check capacity inside the lock to prevent race conditions.
    // The check is conflict-aware: a 2-hour session occupies 4 half-hour marks,
    // so booking at slot T must leave at least 1 cupo free at every half-hour
    // during [T, T+2h). This prevents a school from booking 8:00 while the
    // surveying team is still busy with someone else's 6:30–8:30 session.
    const counts = getCurrentData_().counts;
    const active = buildActiveMap_(counts);
    if (maxActiveDuringSession_(active, slot) >= CAPACITY) {
      return jsonOut_({ ok: false, error: 'slot_full' });
    }

    // Each aula (colegio + sede + jornada + clase) is allowed exactly one
    // reservation in the whole calendar. Reject any second attempt and return
    // the existing slot so the frontend can tell the user when they booked.
    const existingAula = findAulaReservation_(dane, jornada, grade);
    if (existingAula) {
      return jsonOut_({
        ok: false,
        error: 'aula_already_booked',
        existingSlot: existingAula.slot
      });
    }

    const sheet = getSheet_();
    const newRow = sheet.getLastRow() + 1;

    // Force the Slot column to plain text so Sheets doesn't auto-parse
    // "2026-05-06 06:00" into a date in some other timezone.
    sheet.getRange(newRow, 2).setNumberFormat('@');
    sheet.getRange(newRow, 6).setNumberFormat('@'); // Clase as plain text
    sheet.getRange(newRow, 10).setNumberFormat('@'); // Teléfono as plain text

    // Columns: Timestamp | Slot | Localidad | Colegio | Jornada | Clase | Sede | DANE | Contacto | Teléfono
    sheet.appendRow([
      new Date(), slot, localidad, school, jornada, grade, sede, dane, contact, phone
    ]);

    return jsonOut_({ ok: true });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

// ---------- Helpers ----------

// Header columns in the Reservas sheet — order matters for appendRow() and
// the column reads in getCurrentData_().
const HEADER = [
  'Timestamp', 'Slot', 'Localidad', 'Colegio', 'Jornada',
  'Clase', 'Sede', 'DANE', 'Contacto', 'Teléfono'
];

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, HEADER.length)
      .setValues([HEADER])
      .setFontWeight('bold');
  }
  return sheet;
}

// Read all rows once and return both per-slot counts AND the per-slot booking
// details (so the calendar can show which schools have already reserved).
function getCurrentData_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { counts: {}, details: {} };

  // Read all data columns at once.
  const values = sheet.getRange(2, 1, lastRow - 1, HEADER.length).getValues();
  const counts = {};
  const details = {};

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const slotRaw = row[1]; // column B
    if (slotRaw === '' || slotRaw == null) continue;
    let key;
    if (Object.prototype.toString.call(slotRaw) === '[object Date]') {
      key = Utilities.formatDate(slotRaw, TIMEZONE, 'yyyy-MM-dd HH:mm');
    } else {
      // Normalize so "2026-08-11 6:30" → "2026-08-11 06:30". Otherwise the
      // frontend (which always pads) won't match the count back to a slot
      // and the calendar will show full availability for a booked slot.
      key = normalizeSlotKey_(String(slotRaw).trim());
    }
    if (!key) continue;
    counts[key] = (counts[key] || 0) + 1;
    if (!details[key]) details[key] = [];
    // Booking creation timestamp (column A) → "YYYY-MM-DD HH:mm" (Bogota).
    let ts = '';
    const tsRaw = row[0];
    if (Object.prototype.toString.call(tsRaw) === '[object Date]') {
      ts = Utilities.formatDate(tsRaw, TIMEZONE, 'yyyy-MM-dd HH:mm');
    } else if (tsRaw) {
      ts = String(tsRaw).trim();
    }
    details[key].push({
      localidad: String(row[2] || ''),
      colegio:   String(row[3] || ''),
      jornada:   String(row[4] || ''),
      clase:     String(row[5] || ''),
      sede:      String(row[6] || ''),
      dane:      String(row[7] || ''),  // sede DANE — used as part of aulaKey
      ts:        ts,                     // when the booking was submitted
      // Note: contact + phone are intentionally NOT exposed via the public GET.
    });
  }
  return { counts: counts, details: details };
}

// Used by doPost to detect duplicate (school, slot) submissions.
function hasExisting_(slot, school) {
  const data = getCurrentData_();
  const list = data.details[slot] || [];
  for (let i = 0; i < list.length; i++) {
    if (list[i].colegio === school) return true;
  }
  return false;
}

// Returns { slot } if this aula (identified by DANE + jornada + clase) already
// has any reservation anywhere in the calendar, or null otherwise.
// Each aula is allowed exactly one reservation in the whole window.
// Uses DANE (sede ID) as the primary key — immune to spelling drift in colegio
// or sede free-text fields.
function findAulaReservation_(dane, jornada, clase) {
  const data = getCurrentData_();
  const daneStr  = String(dane || '').trim();
  const jorStr   = String(jornada || '').trim();
  const claseStr = String(clase || '').trim();
  if (!daneStr) return null;
  const slotKeys = Object.keys(data.details);
  for (let i = 0; i < slotKeys.length; i++) {
    const list = data.details[slotKeys[i]];
    for (let j = 0; j < list.length; j++) {
      const r = list[j];
      if (r.dane === daneStr &&
          r.jornada === jorStr &&
          r.clase === claseStr) {
        return { slot: slotKeys[i] };
      }
    }
  }
  return null;
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Accepts loosely-formatted slot strings ("2026-08-11 6:30", "2026-8-1 6:5", etc.)
// and returns the canonical "YYYY-MM-DD HH:MM". Returns the input as-is if it
// doesn't look like a date-time at all (so we don't silently corrupt weird data).
function normalizeSlotKey_(s) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{1,2})$/.exec(s);
  if (!m) return s;
  function pad(n) { return ('0' + n).slice(-2); }
  return m[1] + '-' + pad(m[2]) + '-' + pad(m[3]) + ' ' + pad(m[4]) + ':' + pad(m[5]);
}

// ---------- Aula → fecha assignments ----------
// Reads the "Asignaciones" tab and returns a map
//   { "DANE|Jornada|Clase": "YYYY-MM-DD" }
// where the date is the SPECIFIC DAY (not the Monday of the week).
// Aula identity uses the 14-digit sede DANE (column G) — robust against
// spelling drift in the colegio/sede free-text columns.
// Tab schema:
//   A: Colegio   B: Sede   C: Jornada   D: Clase   E: Fecha (YYYY-MM-DD)
//   F: Pair_ID   G: DANE    H: Brazo  (T or C)   ← admin-only, never exposed
// getAssignments_ reads columns C, D, G to build the key.
// Missing tab, empty tab, or rows missing any of (DANE, Jornada, Clase, Fecha)
// are silently ignored.
const ASSIGNMENTS_HEADER = ['Colegio', 'Sede', 'Jornada', 'Clase', 'Fecha',
                             'Pair_ID', 'DANE', 'Brazo'];

function getAssignments_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(ASSIGNMENTS_SHEET_NAME);
  if (!sheet) return {};
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return {};
  // Read 8 columns so we have access to DANE in column G (index 6).
  const values = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
  const out = {};
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const jornada = String(row[2] || '').trim();
    const clase   = String(row[3] || '').trim();
    let fecha     = row[4];
    const dane    = String(row[6] || '').trim().replace(/\.0+$/, '');
    if (!dane || !jornada || !clase || !fecha) continue;
    // Normalize fecha to "YYYY-MM-DD".
    if (Object.prototype.toString.call(fecha) === '[object Date]') {
      fecha = Utilities.formatDate(fecha, TIMEZONE, 'yyyy-MM-dd');
    } else {
      fecha = String(fecha).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) continue;
    }
    const key = dane + '|' + jornada + '|' + clase;
    out[key] = fecha;
  }
  return out;
}

// ---------- Facilitadores (OCE) ----------
// A separate tab keyed by aula (DANE|Jornada|Clase) so a facilitator can be
// assigned to any aula — reserved or not. Schema (row 1 = headers):
//   A: DANE   B: Jornada   C: Clase   D: Colegio   E: Facilitador   F: updated_at
const FACILITADORES_SHEET_NAME = 'Facilitadores';
const FACILITADORES_HEADER = ['DANE', 'Jornada', 'Clase', 'Colegio', 'Facilitador', 'updated_at'];

function getFacilitadores_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(FACILITADORES_SHEET_NAME);
  if (!sheet || sheet.getLastRow() <= 1) return {};
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  const out = {};
  for (let i = 0; i < values.length; i++) {
    const dane = String(values[i][0] || '').trim().replace(/\.0+$/, '');
    const jor  = String(values[i][1] || '').trim().toUpperCase();
    const cl   = String(values[i][2] || '').trim();
    const fac  = String(values[i][4] || '').trim();
    if (!dane || !jor || !cl) continue;
    out[dane + '|' + jor + '|' + cl] = fac;
  }
  return out;
}

// Upsert a facilitator for one aula. Called from doPost when action=set_facilitador.
function setFacilitador_(body) {
  const dane = String(body.dane || '').trim().replace(/\.0+$/, '');
  const jor  = String(body.jornada || '').trim().toUpperCase();
  const cl   = String(body.clase || '').trim();
  const fac  = String(body.facilitador || '').trim();
  const colegio = String(body.colegio || '').trim();
  if (!dane || !jor || !cl) return jsonOut_({ ok: false, error: 'missing_aula' });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(FACILITADORES_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(FACILITADORES_SHEET_NAME);
    sheet.getRange(1, 1, 1, FACILITADORES_HEADER.length)
      .setValues([FACILITADORES_HEADER]).setFontWeight('bold');
    sheet.getRange('A:A').setNumberFormat('@');
    sheet.getRange('C:C').setNumberFormat('@');
  }

  // Find existing row for this aula key
  const lastRow = sheet.getLastRow();
  let targetRow = -1;
  if (lastRow > 1) {
    const keys = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
    for (let i = 0; i < keys.length; i++) {
      const k = String(keys[i][0] || '').trim().replace(/\.0+$/, '') + '|' +
                String(keys[i][1] || '').trim().toUpperCase() + '|' +
                String(keys[i][2] || '').trim();
      if (k === (dane + '|' + jor + '|' + cl)) { targetRow = i + 2; break; }
    }
  }

  const rowVals = [dane, jor, cl, colegio, fac, new Date()];
  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, rowVals.length).setValues([rowVals]);
  } else {
    const nr = sheet.getLastRow() + 1;
    sheet.getRange(nr, 1).setNumberFormat('@');
    sheet.getRange(nr, 3).setNumberFormat('@');
    sheet.getRange(nr, 1, 1, rowVals.length).setValues([rowVals]);
  }
  return jsonOut_({ ok: true, facilitador: fac });
}

// ---------- Conflict-aware capacity ----------
// A booking at slot S occupies 4 half-hour marks (S, S+30, S+60, S+90) because
// each session lasts 2 hours. To start a session at slot T, no half-hour during
// [T, T+2h) can have all 4 teams busy.

function parseSlotKey_(key) {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(key);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
}

function formatSlotKey_(d) {
  function pad(n) { return ('0' + n).slice(-2); }
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
       + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function buildActiveMap_(counts) {
  // active[k] = number of bookings whose [start, start+TEAM_BLOCK_MIN) covers k.
  // (TEAM_BLOCK_MIN = session duration + post-session buffer for transit/setup.)
  const active = {};
  const keys = Object.keys(counts);
  for (let i = 0; i < keys.length; i++) {
    const start = parseSlotKey_(keys[i]);
    if (!start) continue;
    for (let off = 0; off < TEAM_BLOCK_MIN; off += 30) {
      const t = new Date(start.getTime() + off * 60000);
      const tk = formatSlotKey_(t);
      active[tk] = (active[tk] || 0) + counts[keys[i]];
    }
  }
  return active;
}

function maxActiveDuringSession_(active, slot) {
  const start = parseSlotKey_(slot);
  if (!start) return Infinity;
  let maxA = 0;
  for (let off = 0; off < TEAM_BLOCK_MIN; off += 30) {
    const t = new Date(start.getTime() + off * 60000);
    const tk = formatSlotKey_(t);
    if ((active[tk] || 0) > maxA) maxA = active[tk];
  }
  return maxA;
}

// ---------- One-time setup utility ----------
// Run this from the Apps Script editor (Run → setup) the first time you
// install the script. It creates the sheet if missing, writes the header
// row, sets column widths, forces text formatting on the Slot and Phone
// columns, and sets the spreadsheet timezone to America/Bogota.

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone(TIMEZONE);

  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  sheet.getRange(1, 1, 1, HEADER.length)
    .setValues([HEADER])
    .setFontWeight('bold')
    .setBackground('#f3f4f6');
  sheet.setFrozenRows(1);

  sheet.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm:ss');
  sheet.getRange('B:B').setNumberFormat('@'); // Slot as plain text
  sheet.getRange('F:F').setNumberFormat('@'); // Clase as plain text
  sheet.getRange('H:H').setNumberFormat('@'); // DANE as plain text
  sheet.getRange('J:J').setNumberFormat('@'); // Teléfono as plain text

  // Columns: Timestamp | Slot | Localidad | Colegio | Jornada | Clase | Sede | DANE | Contacto | Teléfono
  sheet.setColumnWidth(1, 170); // Timestamp
  sheet.setColumnWidth(2, 140); // Slot
  sheet.setColumnWidth(3, 150); // Localidad
  sheet.setColumnWidth(4, 280); // Colegio
  sheet.setColumnWidth(5, 90);  // Jornada
  sheet.setColumnWidth(6, 70);  // Clase
  sheet.setColumnWidth(7, 200); // Sede
  sheet.setColumnWidth(8, 140); // DANE
  sheet.setColumnWidth(9, 220); // Contacto
  sheet.setColumnWidth(10, 130); // Teléfono

  // Asignaciones tab: maps each aula to its assigned week (Monday). Optional.
  let asignaciones = ss.getSheetByName(ASSIGNMENTS_SHEET_NAME);
  if (!asignaciones) {
    asignaciones = ss.insertSheet(ASSIGNMENTS_SHEET_NAME);
  }
  asignaciones.getRange(1, 1, 1, ASSIGNMENTS_HEADER.length)
    .setValues([ASSIGNMENTS_HEADER])
    .setFontWeight('bold')
    .setBackground('#f3f4f6');
  asignaciones.setFrozenRows(1);
  asignaciones.getRange('D:D').setNumberFormat('@'); // Clase as plain text
  asignaciones.getRange('E:E').setNumberFormat('yyyy-mm-dd'); // Fecha
  asignaciones.getRange('F:F').setNumberFormat('@'); // Pair_ID as plain text
  asignaciones.getRange('G:G').setNumberFormat('@'); // DANE as plain text
  asignaciones.getRange('H:H').setNumberFormat('@'); // Brazo (T/C) as plain text
  asignaciones.setColumnWidth(1, 280); // Colegio
  asignaciones.setColumnWidth(2, 200); // Sede
  asignaciones.setColumnWidth(3, 90);  // Jornada
  asignaciones.setColumnWidth(4, 70);  // Clase
  asignaciones.setColumnWidth(5, 120); // Fecha
  asignaciones.setColumnWidth(6, 120); // Pair_ID  (admin)
  asignaciones.setColumnWidth(7, 140); // DANE     (admin)
  asignaciones.setColumnWidth(8, 70);  // Brazo    (admin)
  // Visually mark the admin columns with a subtle background
  asignaciones.getRange('F1:H1').setBackground('#fef3c7');

  // Facilitadores tab (OCE accompaniment). Keyed by aula (DANE|Jornada|Clase).
  let facs = ss.getSheetByName(FACILITADORES_SHEET_NAME);
  if (!facs) facs = ss.insertSheet(FACILITADORES_SHEET_NAME);
  facs.getRange(1, 1, 1, FACILITADORES_HEADER.length)
    .setValues([FACILITADORES_HEADER]).setFontWeight('bold').setBackground('#f3f4f6');
  facs.setFrozenRows(1);
  facs.getRange('A:A').setNumberFormat('@'); // DANE plain text
  facs.getRange('C:C').setNumberFormat('@'); // Clase plain text
  facs.setColumnWidth(1, 140); facs.setColumnWidth(2, 90); facs.setColumnWidth(3, 70);
  facs.setColumnWidth(4, 280); facs.setColumnWidth(5, 200); facs.setColumnWidth(6, 160);

  Logger.log('Setup complete. Sheets "%s", "%s", "%s" ready.',
             SHEET_NAME, ASSIGNMENTS_SHEET_NAME, FACILITADORES_SHEET_NAME);
}

// =====================================================================
// LISTA DE LLAMADAS — prioritized call list of aulas that have NOT
// reserved yet, sorted by how soon their assigned date is.
// =====================================================================
// Reads: Asignaciones (aula → fecha), Reservas (who reserved),
//        Contactos (aula → contacto/celular/gestor).
// Writes: a "Llamadas" tab, sorted by fecha asignada, color-coded by urgency.
//
// Run it from the "OCE-SED" custom menu, or set a daily trigger with
// crearTriggerDiarioLlamadas(). No web-app redeploy needed.

const CONTACTS_SHEET_NAME = 'Contactos';
const CALLS_SHEET_NAME    = 'Llamadas';

// Adds a custom menu when the spreadsheet opens.
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('OCE-SED')
    .addItem('🔄 Actualizar lista de llamadas', 'actualizarLlamadas')
    .addSeparator()
    .addItem('⏰ Programar actualización diaria (7am)', 'crearTriggerDiarioLlamadas')
    .addToUI();
}

function _aulaKey_(dane, jornada, clase) {
  var d = String(dane || '').trim().replace(/\.0+$/, '');
  return d + '|' + String(jornada || '').trim().toUpperCase() + '|' + String(clase || '').trim();
}

function actualizarLlamadas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // --- Reserved aula keys (from Reservas) ---
  var reserved = {};
  var rSheet = ss.getSheetByName(SHEET_NAME);
  if (rSheet && rSheet.getLastRow() > 1) {
    // Columns: Timestamp|Slot|Localidad|Colegio|Jornada|Clase|Sede|DANE|Contacto|Teléfono
    var rv = rSheet.getRange(2, 1, rSheet.getLastRow() - 1, 8).getValues();
    for (var i = 0; i < rv.length; i++) {
      var k = _aulaKey_(rv[i][7], rv[i][4], rv[i][5]);
      var slot = rv[i][1];
      if (Object.prototype.toString.call(slot) === '[object Date]') {
        slot = Utilities.formatDate(slot, TIMEZONE, 'yyyy-MM-dd HH:mm');
      }
      reserved[k] = String(slot || '').trim();
    }
  }

  // --- Contacts lookup ---
  var contacts = {};
  var cSheet = ss.getSheetByName(CONTACTS_SHEET_NAME);
  if (cSheet && cSheet.getLastRow() > 1) {
    // Columns: DANE|Jornada|Clase|Colegio|Localidad|Contacto|Rol|Celular|Gestor
    var cv = cSheet.getRange(2, 1, cSheet.getLastRow() - 1, 9).getValues();
    for (var j = 0; j < cv.length; j++) {
      contacts[_aulaKey_(cv[j][0], cv[j][1], cv[j][2])] = {
        localidad: cv[j][4], contacto: cv[j][5], rol: cv[j][6],
        celular: String(cv[j][7] || '').replace(/\.0+$/, ''), gestor: cv[j][8]
      };
    }
  }

  // --- Assignments ---
  var aSheet = ss.getSheetByName(ASSIGNMENTS_SHEET_NAME);
  if (!aSheet || aSheet.getLastRow() <= 1) {
    SpreadsheetApp.getUi().alert('No hay datos en la pestaña "Asignaciones".');
    return;
  }
  // Columns: Colegio|Sede|Jornada|Clase|Fecha|Pair_ID|DANE|Brazo
  var av = aSheet.getRange(2, 1, aSheet.getLastRow() - 1, 8).getValues();

  // Which aulas (by pair) have reserved — to flag the partner's status.
  var assignedByKey = {};
  for (var a = 0; a < av.length; a++) {
    assignedByKey[_aulaKey_(av[a][6], av[a][2], av[a][3])] = av[a];
  }

  // Today at midnight (Bogota)
  var today = new Date(Utilities.formatDate(new Date(), TIMEZONE, 'yyyy/MM/dd'));

  var pending = [];
  for (var b = 0; b < av.length; b++) {
    var row = av[b];
    var colegio = row[0], sede = row[1], jornada = row[2], clase = row[3];
    var fecha = row[4], pair = row[5], dane = row[6], brazo = row[7];
    var key = _aulaKey_(dane, jornada, clase);
    if (reserved[key]) continue; // already reserved → not a call target

    // Normalize fecha → Date + string
    var fechaStr, fechaDt;
    if (Object.prototype.toString.call(fecha) === '[object Date]') {
      fechaDt = fecha;
      fechaStr = Utilities.formatDate(fecha, TIMEZONE, 'yyyy-MM-dd');
    } else {
      fechaStr = String(fecha || '').trim();
      var mm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaStr);
      fechaDt = mm ? new Date(+mm[1], +mm[2] - 1, +mm[3]) : null;
    }
    var dias = fechaDt ? Math.round((fechaDt.getTime() - today.getTime()) / 86400000) : '';

    // Partner reservation status (same pair, other arm)
    var partnerReserved = '';
    for (var p in assignedByKey) {
      var pr = assignedByKey[p];
      if (pr[5] === pair && p !== key) {
        partnerReserved = reserved[p] ? 'Sí' : 'No';
        break;
      }
    }

    var c = contacts[key] || {};
    var prioridad =
      (dias === '' ) ? '' :
      (dias < 0)     ? '🔴 VENCIDA' :
      (dias <= 3)    ? '🔴 URGENTE' :
      (dias <= 7)    ? '🟠 Alta' :
      (dias <= 14)   ? '🟡 Media' : 'Normal';

    pending.push([
      prioridad, fechaStr, dias, colegio, jornada, clase,
      c.localidad || '', c.contacto || '', c.rol || '', c.celular || '',
      c.gestor || '', pair, brazo, partnerReserved
    ]);
  }

  // Sort by fecha asc (empty dates last), then colegio
  pending.sort(function (x, y) {
    var fx = x[1] || '9999', fy = y[1] || '9999';
    if (fx !== fy) return fx < fy ? -1 : 1;
    return String(x[3]).localeCompare(String(y[3]));
  });

  // --- Write the Llamadas tab ---
  var out = ss.getSheetByName(CALLS_SHEET_NAME);
  if (!out) out = ss.insertSheet(CALLS_SHEET_NAME);
  out.clear();

  var header = ['Prioridad', 'Fecha asignada', 'Días', 'Colegio', 'Jornada', 'Aula',
                'Localidad', 'Contacto', 'Rol', 'Celular', 'Gestor/Dupla',
                'Par', 'Brazo', '¿Par ya reservó?'];
  out.getRange(1, 1, 1, header.length).setValues([header])
     .setFontWeight('bold').setBackground('#0f4c81').setFontColor('#ffffff');
  out.setFrozenRows(1);

  var stamp = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm');
  if (pending.length) {
    out.getRange(2, 1, pending.length, header.length).setValues(pending);
    // Color rows by urgency
    for (var r = 0; r < pending.length; r++) {
      var dias = pending[r][2];
      var bg = '#ffffff';
      if (dias !== '') {
        if (dias <= 3) bg = '#fecaca';        // red
        else if (dias <= 7) bg = '#fed7aa';   // orange
        else if (dias <= 14) bg = '#fef3c7';  // yellow
      }
      out.getRange(r + 2, 1, 1, header.length).setBackground(bg);
    }
    out.getRange('J2:J' + (pending.length + 1)).setNumberFormat('@'); // Celular as text
  } else {
    out.getRange(2, 1).setValue('🎉 Todas las aulas asignadas ya reservaron.');
  }

  // Column widths
  var widths = [110, 120, 55, 260, 90, 60, 140, 200, 150, 120, 150, 100, 60, 120];
  for (var w = 0; w < widths.length; w++) out.setColumnWidth(w + 1, widths[w]);

  // Footer note with count + timestamp
  var noteRow = pending.length + 3;
  out.getRange(noteRow, 1).setValue(
    pending.length + ' aula(s) sin reservar · actualizado ' + stamp);
  out.getRange(noteRow, 1).setFontColor('#6b7280').setFontStyle('italic');

  SpreadsheetApp.getActiveSpreadsheet().toast(
    pending.length + ' aulas sin reservar', 'Lista de llamadas actualizada', 5);
}

// Creates a daily trigger (7am) that refreshes the Llamadas tab automatically.
function crearTriggerDiarioLlamadas() {
  // Remove existing triggers for this function to avoid duplicates
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'actualizarLlamadas') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('actualizarLlamadas')
    .timeBased().atHour(7).everyDays(1)
    .inTimezone(TIMEZONE).create();
  SpreadsheetApp.getUi().alert('Listo. La lista de llamadas se actualizará automáticamente cada día a las 7am.');
}
