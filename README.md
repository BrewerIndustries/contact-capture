# Contact Capture

Multi-user contact capture. Everyone signs in, captures contacts on a configurable form,
and sees one shared report. Every entry records who captured it and who last edited it.

- **Prod:** https://contacts.dabrewer.dev/ · API `https://contacts-api.dabrewer.dev`
- **Dev:** https://contacts.dabrewer.dev/dev/ · API `https://contacts-api-dev.dabrewer.dev`

> **Status (2026-10-29):** prod and dev are both live (sites + APIs, events included). Promote with a `dev → main` PR.

## Tabs

| Tab | Who | What |
|-----|-----|------|
| **Contact Capture** | everyone | Event dropdown, the form (built from Settings), a duplicate-email warning, and "My captures" with edit/delete |
| **Settings** | everyone / admins | Admins: events (default + list), fields (add, edit, reorder, hide, delete), and users (invite, role, per-user event, deactivate). Everyone: name + password |
| **Report** | everyone | Every contact, with search, event, captured-by and date-range filters, plus CSV export (Excel-friendly UTF-8) |

## Rules worth knowing

- **Fields.** Base fields are Name, Email, Role, Organization. Types: text, email, phone, long text, dropdown,
  checkbox, date, number. **Hiding** a field drops it from the form but keeps its data, which the report
  shows as "(retired)". A field can only be **deleted** while it holds no data.
- **Events.** Admins add, rename, archive or delete events and pick the **default**. Each user has a current event:
  their own pick from the Capture tab, or one an admin sets from the Users list. With none set, it follows the default.
  Every new contact is stamped with that event and can be changed in the edit dialog. The first event created becomes
  the default. Archiving an event drops it from the pickers (users on it fall back to the default) but keeps it on
  existing contacts. Only events with no contacts can be deleted.
- **Contacts.** Users edit/delete their own; admins edit/delete any. Deletes are soft (`deleted_at`, `deleted_by`).
  Duplicate emails warn but don't block.
- **Accounts are invite-only.** An admin enters an email under Settings → Users. The Worker emails a one-time link
  (72h) and also returns it to the admin, so it can be shared by hand if the email doesn't land. The invitee sets
  their name and password. Forgot-password sends a 1-hour reset link. Users who have captured anything can be
  **deactivated** but not removed, so the captured-by trail stays intact.
- **Security.** PBKDF2 passwords, HMAC-hashed session and link tokens, HttpOnly same-site cookie, per-IP and
  per-email lockout (8 failures / 15 min) on login and on reset requests.

## Stack

GitHub Pages SPA (`web/`, React 19 + Vite + Tailwind v4) + Cloudflare Worker (`api/`, Hono) + D1.
Email goes out through the Worker's `send_email` binding (Cloudflare Email Sending, `contacts@dabrewer.dev`;
dabrewer.dev is already onboarded). It's the same stack as Brookeslist and Voice Studio.

| | Prod | Dev |
|-|------|-----|
| Worker | `contact-capture-api` | `contact-capture-api-dev` |
| D1 | `contact-capture-prod` | `contact-capture-dev` |
| Secret | `SESSION_SECRET` | `SESSION_SECRET` |

## Local dev

```bash
cd api && npm install && npm run migrate:local
echo "SESSION_SECRET=$(openssl rand -hex 32)" > .dev.vars && echo "APP_URL=http://localhost:5173/" >> .dev.vars
npm run invite -- --local --email you@example.com          # prints a link to set your password
npx wrangler dev --port 8787                                # local email sends are simulated and logged
cd ../web && npm install && npx vite                        # http://localhost:5173
```

## Deploy

- **Web:** push to `dev` → the Pages workflow builds `main` → `/` and `dev` → `/dev/`
  (if `main` doesn't exist yet, `/` is a redirect to `/dev/`). The `github-pages` environment allows the `dev` branch.
  Promote to prod with a PR `dev → main`, then re-run the workflow (or push to dev).
- **API:** `cd api && npm run deploy:dev` / `npm run deploy` (OAuth wrangler, so unset a DNS-only `CLOUDFLARE_API_TOKEN` first).
- **Schema:** add `api/migrations/000N_*.sql`, then `npm run migrate:dev` / `npm run migrate:prod`.
- **First admin on a fresh DB:** `SESSION_SECRET=<that env's secret> npm run invite -- --env dev --email you@example.com`.
  The secret must match the Worker's, because link tokens are stored as HMACs.
