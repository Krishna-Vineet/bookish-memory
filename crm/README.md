# HappyPix CRM — v2

The complete role-aware CRM for the HappyPix photobooth platform, built from scratch against
`03-role-and-permission-spec.md`, `04-crm-screen-spec.md` and `05-crm-flow-spec.md` from the
HappyPix repo. React 18 + Vite, zero runtime dependencies beyond React itself — all icons,
charts and layout are hand-rolled SVG/CSS so the app works in fully offline previews.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production bundle in dist/
node scripts/api-smoke.mjs    # API contract test (107 assertions)
node scripts/render-test.mjs  # role × screen render test (32 cases)
```

### Configuration

Copy `.env.example` → `.env`. `VITE_MOCK=true` (default) runs the in-browser demo
backend; `VITE_MOCK=false` + `VITE_API_URL` talks to the real API and ships **no**
mock/demo code. Every variable is documented in `.env.example`; security posture
and required hosting headers are in `SECURITY.md`.

### Demo mode (default)

With no `VITE_API_URL` set, the app runs against an **in-app API**
(`src/api/mock/`) — a full implementation of the v2 contract with deterministic seeded data
(world clock fixed at 2026-09-24 11:30 IST) persisted in `localStorage`.
Any password of 6+ chars signs a demo user in (the quick-login chips use `demo123`).

| Role | Email | What it can do |
|---|---|---|
| Owner | `owner@happypix.com` | Everything: platform revenue, suspend/ban/restore organisations, internal team |
| Platform Admin | `priya@happypix.com` | Platform console **minus** revenue & user management; can manage templates (frame catalogue changes are Owner-only) |
| Support Manager | `support@happypix.com` | Platform dashboard, organisations (read) — templates/revenue/team-audit not visible |
| Organisation Admin | `sana@sunsetweddings.com` | Full org workspace: revenue, events & devices, support, defaults, coupons, team |
| Organisation Manager | `rohit@sunsetweddings.com` | Operational org workspace: events & devices, support — **no** revenue/defaults/coupons/audit |

Other seeded orgs worth exploring (login as their admin, e.g. `arpita@pika.in`):
Pika (professional, **expiring in 11 days**), Nova Occasions (fresh **trial**),
Tech Closet (trial, extended once), Alpha Booths (**expired**),
Riya Studio (**suspended** — billing dispute), Glow Events (**banned** — fraud).

"Reset demo data" in the user menu reseeds everything.

### Real backend

```bash
VITE_API_URL=https://api.happypix.example npm run dev
```

The client (`src/api/client.js`) switches from the mock to real `fetch` calls against
`{VITE_API_URL}/api/…` with `Authorization: Bearer <token>`. **The required backend changes
are itemised in `BACKEND-CHANGES.md`** — until those land, the real backend serves the old
v1 shape and this CRM will not work against it.

## The 13 screens

| Screen | Owner | Platform Admin | Support Manager | Org Admin | Org Manager |
|---|---|---|---|---|---|
| Login / Profile | ✔ | ✔ | ✔ | ✔ | ✔ |
| Platform Dashboard | ✔ | ✔ | ✔ | — | — |
| Platform Revenue | ✔ | — | — | — | — |
| Organisations (suspend/ban/restore = Owner) | ✔ | read | read | — | — |
| Templates & Frames | manage | manage (frames read-only) | — | — | — |
| Team & Roles | manage | read | — | — | — |
| Audit & Logs (platform) | ✔ | ✔ | — | — | — |
| Org Dashboard | — | — | — | ✔ | ✔ |
| Org Revenue | — | — | — | ✔ | — |
| Events & Devices | — | — | — | ✔ | ✔ |
| Support (guest tickets) | — | — | — | ✔ | ✔ |
| Organisation Defaults | — | — | — | manage | read-only |
| Coupon Management | — | — | — | ✔ | — |
| Org Audit & Logs | — | — | — | ✔ | — |

The matrix is fixed in `src/lib/roles.js` (single source of truth). It is enforced three
times: the sidebar only renders what a role may see, the router redirects on forbidden paths,
and the API layer rejects forbidden calls with 403 (mock enforces the same matrix server-side).
There is **no permission editor anywhere** and **no BOOTH_OPERATOR role** — booths are
UUID-paired devices, never users.

## Domain rules implemented

- **Plan status is computed, never stored**: trial / active / expiring_soon / expired /
  not_subscribed / suspended / banned — from plan + org status + trial-extension flags.
- **Plan limits block creation server-side**: parallel *active* events only (finished events
  never count); device registration is capped; expired/suspended/banned orgs cannot create
  events or register devices.
- **Suspend/ban with mandatory reason**, full restore path, every action audit-logged.
- **Coupons**: org-owned, quantity-limited, expiry-checked, pausable, event-scoped or
  global; the booth only ever shows an "Enter Coupon" field.
- **Events have no price and no passkey.** Creation asks exactly: *General* (event name,
  client/host, location, start, end, digital-copy toggle), *Customisation* (photo filters
  from the available options + templates from all available platform templates) and
  *Branding* (client logo — default none, added to the print footer — plus a default
  tagline, editable later).
- **A frame is the canvas a print is made on** — its background design carries the
  template's photo slots, and the complete output print (photos + 15% branding footer)
  is printed on the frame. The catalogue is a platform asset: the **Owner** adds and
  removes frames (remove is blocked while a frame is enabled at any organisation).
- **Defaults** are the only org config surface — and the only place print pricing
  exists: name, logo, booth idle timeout **in seconds**, and for *every* platform frame a
  price + a "available on booth" toggle, each rendered with the same consistent
  `FramePreview` the Owner sees. Events inherit them.
- **Templates** use the original HappyPix creation flow verbatim: Direct Upload or
  AI Generate, Design Scope *Universal Background* or *Specific Layout* (photo slots
  1/2/3/4/6 × portrait/landscape/strip/square), AI output previewed before saving.
  Photo-slot coordinates are always computed by the Architecture V1 engine
  (`src/lib/templates.js`; bottom 15% of every canvas reserved for branding). Orgs select
  from the active library when creating events; disabled templates cannot be selected.
- **Team**: org admins create *Organisation Manager* accounts only (role is server-selected);
  owners create *Platform Admin* / *Support Manager* only. Password reset returns a
  one-time temporary password.
- **Audit** is written on every mutating action and read is permission-gated.

## Project map

```
src/
  lib/            roles.js (the fixed matrix), plans.js (plans/limits/filters/statuses),
                  templates.js (Architecture V1: slot engine + 33 layouts),
                  frames.js (the 12-frame catalogue), format.js, router.jsx, icons.jsx
  api/
    client.js     token/session + fetch wrapper (mock ⇄ real via VITE_API_URL)
    index.js      typed endpoint surface (one function per route)
    mock/db.js    deterministic seed + localStorage persistence
    mock/server.js  the v2 API contract: routing, RBAC, tenancy, limits, audit
  context/        AppContext (auth + toasts)
  components/     Logo, ui (design system), charts (pure SVG), FramePreview
                  (the consistent frame renderer), layout/AppShell
  pages/
    Login.jsx
    platform/     Dashboard, Revenue, Organisations, Templates & Frames, TeamAndRoles, AuditLogs
    org/          Dashboard, Revenue, EventsDevices, Support, OrgDefaults, Coupons
    Profile.jsx
scripts/
  api-smoke.mjs   62-assertion API test (node scripts/api-smoke.mjs)
  render-test.mjs 30-case role×screen render test (node scripts/render-test.mjs)
```
