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
      bookings: data.counts,        // { "YYYY-MM-DD HH:mm": n }   (back-compat)
      details: data.details,        // { "YYYY-MM-DD HH:mm": [ { colegio, jornada, clase, localidad, sede } ] }
      assignments: getAssignments_(),  // { "Colegio|Sede|Jornada|Clase": "YYYY-MM-DD" }
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
    const existingAula = findAulaReservation_(school, sede, jornada, grade);
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
    details[key].push({
      localidad: String(row[2] || ''),
      colegio:   String(row[3] || ''),
      jornada:   String(row[4] || ''),
      clase:     String(row[5] || ''),
      sede:      String(row[6] || ''),
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

// Returns { slot } if this aula (colegio + sede + jornada + clase) already has
// any reservation anywhere in the calendar, or null otherwise.
// Each aula is allowed exactly one reservation in the whole window.
function findAulaReservation_(school, sede, jornada, clase) {
  const data = getCurrentData_();
  const claseStr = String(clase || '');
  const slotKeys = Object.keys(data.details);
  for (let i = 0; i < slotKeys.length; i++) {
    const list = data.details[slotKeys[i]];
    for (let j = 0; j < list.length; j++) {
      const r = list[j];
      if (r.colegio === school &&
          r.sede === sede &&
          r.jornada === jornada &&
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

// ---------- Aula → semana assignments ----------
// Reads the "Asignaciones" tab and returns a map { "Colegio|Sede|Jornada|Clase": "YYYY-MM-DD" }
// where the date is the Monday of the assigned week. Tab schema (row 1 = headers):
//   A: Colegio   B: Sede   C: Jornada   D: Clase   E: Semana (YYYY-MM-DD, lunes)
// Missing tab, empty tab, or invalid rows are silently ignored — the frontend
// simply won't show an assignment banner for aulas not listed here.
const ASSIGNMENTS_HEADER = ['Colegio', 'Sede', 'Jornada', 'Clase', 'Semana'];

function getAssignments_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(ASSIGNMENTS_SHEET_NAME);
  if (!sheet) return {};
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return {};
  const values = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  const out = {};
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const colegio = String(row[0] || '').trim();
    const sede    = String(row[1] || '').trim();
    const jornada = String(row[2] || '').trim();
    const clase   = String(row[3] || '').trim();
    let semana    = row[4];
    if (!colegio || !sede || !jornada || !clase || !semana) continue;
    // Normalize semana to "YYYY-MM-DD".
    if (Object.prototype.toString.call(semana) === '[object Date]') {
      semana = Utilities.formatDate(semana, TIMEZONE, 'yyyy-MM-dd');
    } else {
      semana = String(semana).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(semana)) continue;
    }
    const key = colegio + '|' + sede + '|' + jornada + '|' + clase;
    out[key] = semana;
  }
  return out;
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
  asignaciones.getRange('E:E').setNumberFormat('yyyy-mm-dd'); // Semana
  asignaciones.setColumnWidth(1, 280); // Colegio
  asignaciones.setColumnWidth(2, 200); // Sede
  asignaciones.setColumnWidth(3, 90);  // Jornada
  asignaciones.setColumnWidth(4, 70);  // Clase
  asignaciones.setColumnWidth(5, 120); // Semana

  Logger.log('Setup complete. Sheets "%s" and "%s" are ready.', SHEET_NAME, ASSIGNMENTS_SHEET_NAME);
}
