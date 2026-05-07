# OCE-SED · Reservas de encuesta

Self-hosted Calendly-style reservation page for the OCE-SED classroom-climate survey. Schools pick a 2-hour slot to apply the instrument; a Google Sheet keeps the bookings.

**Live site:** https://oscarmdiazb.github.io/reservas-encuesta-clima-aula-2026-oce/ *(after GitHub Pages is enabled)*

## Stack

- **Frontend:** a single static `index.html` (vanilla JS, no build step), hosted on GitHub Pages.
- **Backend:** a Google Apps Script Web App that reads/writes a Google Sheet.
- No servers, no databases, no auth — schools just pick a slot.

## How it works

1. Page loads → `GET` to Apps Script → returns per-slot counts AND per-slot booking details (`localidad`, `colegio`, `jornada`, `clase`).
2. Calendar renders the window **1 ago – 15 sep 2026** (Mon–Fri) with half-hourly start times from 6:00 AM to 5:00 PM, capacity 4 per slot. Each slot shows remaining cupos and a chip per existing reservation (`Colegio · Aula`).
3. School picks a slot, picks its localidad → its colegio (showing jornada + aula from the sample), fills contact + phone, clicks confirm.
4. `POST` to Apps Script → server re-checks capacity inside a `LockService` lock → appends a row to the `Reservas` sheet → returns success.
5. Page refreshes the availability map.

All times are in `America/Bogota`.

## Files

| File | What it is |
|---|---|
| `index.html` | The whole frontend. Self-contained: HTML + CSS + JS in one file. |
| `apps-script.gs` | The backend code you paste into the Sheet's Apps Script editor. |
| `SETUP.md` | Step-by-step deploy instructions. Start here. |
| `README.md` | This file. |

## First-time setup

See [`SETUP.md`](./SETUP.md) — it walks through creating the Sheet, pasting the script, deploying the web app, plugging the URL into `index.html`, and pushing to GitHub Pages.

## Editing the school list

Open `index.html`, find the `SCHOOLS_BY_LOCALIDAD` object near the top of the `<script>` block. It was generated from `Final Treatment Assignment Round 3.csv` and groups the 80 colegios of the sample by localidad; each colegio has exactly one assigned aula:

```js
const SCHOOLS_BY_LOCALIDAD = {
  "SANTAFE": [
    { colegio: "COLEGIO EL VERJON (IED)", sede: "EL VERJON ALTO", jornada: "ÚNICA", clase: "702", grado: "7", dane: "21100102748501" },
    // ...
  ],
  // ...
};
```

After saving, `git commit && git push` — GitHub Pages republishes in about a minute.

## Viewing bookings

Open the Google Sheet. Every reservation is appended as a row:

```
Timestamp           | Slot             | Localidad | Colegio                | Jornada | Clase | Sede           | DANE           | Contacto    | Teléfono
2026-05-06 14:32:11 | 2026-08-10 08:00 | SANTAFE   | COLEGIO EL VERJON (IED)| ÚNICA   | 702   | EL VERJON ALTO | 21100102748501 | María Pérez | 3001234567
```

Sort by **Slot** (column B) to see the booking calendar in chronological order. To grab a snapshot for analysis: **File → Download → CSV**.

## Privacy

The public page **does** show colegio + aula on already-booked slots (so schools see who's there at the same time), but never the contact name or phone — those live only in the private Sheet.

## Limits / things this doesn't try to do

- No cancellation / reschedule UI. To cancel, delete the row from the Sheet manually.
- No email confirmation to the contact (yet — easy to add: `MailApp.sendEmail(...)` inside `doPost`).
- No protection against someone deliberately spamming the form. Volume is low (~28 schools, one slot each) so this hasn't been an issue, but if it ever is, swap the deployment to "Anyone with a Google account" — schools log in with their personal Google to book.
- The reservation window (`WINDOW_START` / `WINDOW_END` in `index.html`) and the 4-spot capacity (in both `index.html` and `apps-script.gs`) are hard-coded constants near the top of each file. Change both if you change either.

## License / use

Internal project tool — no external license. Built for the OCE-SED classroom climate survey.
