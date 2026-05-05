/**
 * OCE-SED · Encuesta de clima de aula — booking backend.
 *
 * Backend for the static GitHub Pages site at:
 *   https://oscarmdiazb.github.io/reservas-encuesta-clima-aula-2026-oce/
 *
 * What this does:
 *   - GET  → returns counts per slot ({ "YYYY-MM-DD HH:mm": n }), no PII.
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
const CAPACITY = 4;
const TIMEZONE = 'America/Bogota';

// ---------- HTTP handlers ----------

function doGet(e) {
  try {
    const counts = getCurrentCounts_();
    return jsonOut_({ ok: true, bookings: counts, capacity: CAPACITY });
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

    const slot    = (body && body.slot)    ? String(body.slot).trim()    : '';
    const school  = (body && body.school)  ? String(body.school).trim()  : '';
    const grade   = (body && body.grade)   ? String(body.grade).trim()   : '';
    const contact = (body && body.contact) ? String(body.contact).trim() : '';
    const phone   = (body && body.phone)   ? String(body.phone).trim()   : '';

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
    const counts = getCurrentCounts_();
    if ((counts[slot] || 0) >= CAPACITY) {
      return jsonOut_({ ok: false, error: 'slot_full' });
    }

    const sheet = getSheet_();
    const newRow = sheet.getLastRow() + 1;

    // Force the Slot column to plain text so Sheets doesn't auto-parse
    // "2026-05-06 06:00" into a date in some other timezone.
    sheet.getRange(newRow, 2).setNumberFormat('@');
    sheet.getRange(newRow, 6).setNumberFormat('@');

    sheet.appendRow([new Date(), slot, school, grade, contact, phone]);

    return jsonOut_({ ok: true });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

// ---------- Helpers ----------

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, 6)
      .setValues([['Timestamp', 'Slot', 'Colegio', 'Grado', 'Contacto', 'Teléfono']])
      .setFontWeight('bold');
  }
  return sheet;
}

function getCurrentCounts_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return {};
  const values = sheet.getRange(2, 2, lastRow - 1, 1).getValues(); // column B = Slot
  const counts = {};
  for (let i = 0; i < values.length; i++) {
    const v = values[i][0];
    if (v === '' || v == null) continue;
    let key;
    if (Object.prototype.toString.call(v) === '[object Date]') {
      // If Sheets coerced the cell to a date, format it back in Bogota TZ.
      key = Utilities.formatDate(v, TIMEZONE, 'yyyy-MM-dd HH:mm');
    } else {
      key = String(v).trim();
    }
    if (!key) continue;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
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

  const header = ['Timestamp', 'Slot', 'Colegio', 'Grado', 'Contacto', 'Teléfono'];
  sheet.getRange(1, 1, 1, header.length)
    .setValues([header])
    .setFontWeight('bold')
    .setBackground('#f3f4f6');
  sheet.setFrozenRows(1);

  sheet.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm:ss');
  sheet.getRange('B:B').setNumberFormat('@'); // Slot as plain text
  sheet.getRange('D:D').setNumberFormat('@'); // Grado as plain text
  sheet.getRange('F:F').setNumberFormat('@'); // Teléfono as plain text

  sheet.setColumnWidth(1, 170);
  sheet.setColumnWidth(2, 140);
  sheet.setColumnWidth(3, 180);
  sheet.setColumnWidth(4, 80);
  sheet.setColumnWidth(5, 220);
  sheet.setColumnWidth(6, 130);

  Logger.log('Setup complete. Sheet "%s" is ready.', SHEET_NAME);
}
