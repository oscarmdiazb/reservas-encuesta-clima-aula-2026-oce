# Setup guide

Step-by-step instructions to get the OCE-SED reservation site running. End state: a static HTML page on GitHub Pages, backed by a Google Sheet via Apps Script.

You'll do this once. Total time: ~15 minutes.

---

## 1. Create the Google Sheet

1. Go to [sheets.new](https://sheets.new) and create a new spreadsheet.
2. Rename it to something like `OCE-SED Reservas`.
3. Rename the first tab to `Reservas` (exactly that, capitalized).
4. In row 1, add these column headers (left to right):

   | A | B | C | D | E | F | G | H | I | J |
   |---|---|---|---|---|---|---|---|---|---|
   | Timestamp | Slot | Localidad | Colegio | Jornada | Clase | Sede | DANE | Contacto | Teléfono |

   (The Apps Script `setup` function in step 2 will also do this for you, so you can skip this if you'd rather run that.)

---

## 2. Paste the Apps Script

1. In the spreadsheet, click **Extensions → Apps Script**. A new tab opens.
2. Delete whatever placeholder code is in `Code.gs`.
3. Open `apps-script.gs` from this repo, copy its entire contents, and paste them into the editor.
4. Click the disk icon (or **Cmd/Ctrl + S**) to save. Name the project something like `reservas-encuesta-clima-aula-backend`.
5. In the Apps Script editor, in the function dropdown at the top, choose `setup` and click **Run**.
   - The first run will ask for permissions (read/write to your Sheet). Approve them — it's your own script accessing your own Sheet.
   - This creates the `Reservas` tab if missing, writes the header row, freezes it, sets column widths, and forces the `Slot` / `Clase` / `DANE` / `Teléfono` columns to plain text so Sheets doesn't auto-parse `"2026-05-06 06:00"` as a date in the wrong timezone or strip leading zeros from class/DANE codes.

---

## 3. Deploy the Web App

1. In the Apps Script editor, click **Deploy → New deployment**.
2. Click the gear icon next to "Select type" → **Web app**.
3. Fill in:
   - **Description:** `oce-sed reservas v1`
   - **Execute as:** *Me* (`oscarmdiazb@gmail.com`)
   - **Who has access:** *Anyone* — yes, "Anyone", not "Anyone with Google account". The static page must be able to call this without forcing schools to log in.
4. Click **Deploy**.
5. Copy the **Web app URL** that's shown. It looks like:

   ```
   https://script.google.com/macros/s/AKfycb.../exec
   ```

   Save this URL — you need it in the next step.

> **If you ever change `apps-script.gs`,** you must create a new version of the deployment for the changes to take effect. Either:
> - **Deploy → Manage deployments** → pencil icon → Version: *New version* → **Deploy**, which keeps the same URL, **or**
> - **Deploy → New deployment**, which gives you a new URL (you'd then need to update `index.html`).
>
> Option A (manage deployments → new version) is easier because the URL stays the same.

---

## 4. Plug the URL into `index.html`

1. Open `index.html` in your editor.
2. Find this line near the top of the `<script>` block:

   ```js
   const APPS_SCRIPT_URL = "PASTE_DEPLOYMENT_URL_HERE";
   ```

3. Replace `PASTE_DEPLOYMENT_URL_HERE` with the URL you copied. Keep the quotes.
4. Save.

While you're in there: the `SCHOOLS_BY_LOCALIDAD` object right below already has the 80 colegios from `Final Treatment Assignment Round 3.csv` (16 localidades, one aula per colegio). If the sample changes, edit that object directly — each entry has `colegio`, `sede`, `jornada`, `clase`, `grado`, and `dane`.

---

## 5. Push to GitHub

Assuming the repo will live at `github.com/oscarmdiazb/reservas-encuesta-clima-aula-2026-oce`:

```bash
cd "/path/to/reservas-encuesta-clima-aula-2026-oce"
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/oscarmdiazb/reservas-encuesta-clima-aula-2026-oce.git
git push -u origin main
```

If you'd rather create the repo first via the GitHub web UI, do that, then run the four lines from `git init` to `git push`.

---

## 6. Enable GitHub Pages

1. Go to `github.com/oscarmdiazb/reservas-encuesta-clima-aula-2026-oce/settings/pages`.
2. Under **Source**, choose **Deploy from a branch**.
3. **Branch:** `main`, **Folder:** `/ (root)`. Click **Save**.
4. Wait ~1 minute for the first build.
5. The live site will be at:

   ```
   https://oscarmdiazb.github.io/reservas-encuesta-clima-aula-2026-oce/
   ```

---

## 7. Updating things later

**Editing the school list or text on the page**
Edit `index.html` locally → `git add . && git commit -m "..." && git push`. GitHub Pages republishes within a minute.

**Editing the backend (`apps-script.gs`)**
After saving in the Apps Script editor, the changes don't go live until you push a new version of the deployment:

1. **Deploy → Manage deployments**.
2. Click the pencil ✏️ next to your active deployment.
3. **Version → New version** (write a short note like "fix capacity check").
4. Click **Deploy**.

The URL stays the same, so you don't need to update `index.html`.

**Viewing bookings**
Just open the Google Sheet — every booking is appended as a row with timestamp, slot, localidad, colegio, jornada, clase, sede, DANE, contacto, and teléfono. Sort by Slot (column B) to see who's booked when.

**Backing up bookings**
File → Download → CSV / Excel from the Sheet whenever you want a snapshot.

---

## Troubleshooting

**"La URL de Apps Script no está configurada"** in a yellow banner
You forgot step 4. The page still renders the calendar but every slot will show as empty.

**Calendar loads but nothing appears when I click a slot**
Open browser DevTools (F12) → Console. Most likely the deployment URL is wrong, or the deployment is set to "Only myself" instead of "Anyone".

**"No se pudo conectar con el servidor: Failed to fetch"**
Almost always one of:
- The Apps Script web app deployment was deleted or the URL is stale.
- The deployment's access level isn't "Anyone".
- You changed `apps-script.gs` but didn't push a new version (see step 7).

**Bookings show as duplicates / capacity check seems wrong**
Check the spreadsheet timezone: `File → Settings → Time zone` should be `(GMT-05:00) Bogota`. The `setup` function sets this automatically, so re-run it if needed.

**Slots in column B got auto-parsed as dates**
Run `setup` again from the Apps Script editor. It re-applies plain-text formatting to column B. Existing rows are fine — `getCurrentData_` handles both string and Date values.
