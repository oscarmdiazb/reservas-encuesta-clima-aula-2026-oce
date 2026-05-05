# OCE-SED · Reservas de encuesta

Self-hosted Calendly-style reservation page for the OCE-SED classroom-climate survey. Schools pick a 2-hour slot to apply the instrument; a Google Sheet keeps the bookings.

**Live site:** https://oscarmdiazb.github.io/reservas-encuesta-clima-aula-2026-oce/ *(after GitHub Pages is enabled)*

## Stack

- **Frontend:** a single static `index.html` (vanilla JS, no build step), hosted on GitHub Pages.
- **Backend:** a Google Apps Script Web App that reads/writes a Google Sheet.
- No servers, no databases, no auth — schools just pick a slot.

## How it works

1. Page loads → `GET` to Apps Script → returns `{ "YYYY-MM-DD HH:mm": count }`.
2. Calendar renders 8 weeks (Mon–Fri) with 23 half-hourly start times from 6:00 AM to 5:00 PM, capacity 4 per slot. Only the count is shown — never which school booked.
3. School picks a slot, fills out the form (school + grade + contact + phone), clicks confirm.
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

Open `index.html`, find the `SCHOOLS` array near the top of the `<script>` block, and edit the names directly. Each entry has its own grades array, so you can customize per-school:

```js
const SCHOOLS = [
  { name: "IED Mi Colegio", grades: [6, 7, 8, 9, 10, 11] },
  { name: "Colegio Tal",    grades: [9, 10, 11] }, // only secundaria alta
  // ...
];
```

After saving, `git commit && git push` — GitHub Pages republishes in about a minute.

## Viewing bookings

Open the Google Sheet. Every reservation is appended as a row:

```
Timestamp | Slot               | Colegio    | Grado | Contacto       | Teléfono
2026-05-06 14:32:11 | 2026-05-12 08:00 | Colegio 5  | 9     | María Pérez    | 3001234567
```

Sort by **Slot** (column B) to see the booking calendar in chronological order. To grab a snapshot for analysis: **File → Download → CSV**.

## Privacy

The public page never exposes school or contact information for already-booked slots — it only shows `"X cupos"`. The Sheet itself is private to whoever you share it with.

## Limits / things this doesn't try to do

- No cancellation / reschedule UI. To cancel, delete the row from the Sheet manually.
- No email confirmation to the contact (yet — easy to add: `MailApp.sendEmail(...)` inside `doPost`).
- No protection against someone deliberately spamming the form. Volume is low (~28 schools, one slot each) so this hasn't been an issue, but if it ever is, swap the deployment to "Anyone with a Google account" — schools log in with their personal Google to book.
- The 8-week horizon and 4-spot capacity are hard-coded constants at the top of `index.html` and `apps-script.gs`. Change both if you change either.

## License / use

Internal project tool — no external license. Built for the OCE-SED classroom climate survey.
