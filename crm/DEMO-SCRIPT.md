# HappyPix CRM v2 — 2-minute demo script

One story, five logins (password `demo123`, or use the quick-login chips). The world clock is
fixed at **24 Sep 2026**, so every number is stable across runs. "Reset demo data" (user menu)
restores the seed at any point.

---

### 1 · Owner — the money view + the frame catalogue (25 s) → `owner@happypix.com`

1. **Platform Dashboard** — note the revenue strip (Owner-only), 9 orgs, 14 devices, 3 expiring
   within 14 days.
2. **Platform Revenue** — net / FY / month, monthly + quarterly charts, per-org table.
   Filter: plan = *business*, sort = *This month*.
3. **Organisations** — open **Glow Events** (banned): red banner shows the fraud reason + audit
   entry. Click **Restore**, then **Suspend** Riya Studio *without* a reason → error
   "reason is required". With a reason → audit-logged.
4. **Templates & Frames** — Frames section: click **Remove** on *Emerald Luxe* (disabled at
   every org → succeeds). Click **Remove** on *Mono Studio* → **409 "enabled at 1
   organisation — disable it in their defaults first"**. That's the guard.

> Talking point: statuses are *computed* (trial / active / expiring soon / expired / suspended /
> banned) — nobody edits a status field. Only the Owner may add/remove frames.

### 2 · Platform Admin — same console, less power (20 s) → `priya@happypix.com`

- Sidebar has **no Revenue**; Audit is visible but read-only, and the Suspend/Ban buttons are
  gone from Organisations. On **Templates & Frames** the *New frame / Remove* buttons are
  gone too — the admin manages templates, the Owner manages the catalogue.
- **Templates & Frames** — run the exact original creation flow: **New template** →
  *AI Generate* tab → *Specific Layout*, 2 slots, *Portrait* → prompt → **Generate Template**
  → preview → **Save to Templates**. The new card shows *2 slots · Portrait* + *published*
  chip + *AI* badge. (Direct Upload tab: scope + slots + orientation + background image file.)
- **Team & Roles** — read-only list of the internal team; the "New internal user" button
  doesn't exist (Owner-only).
- Try to type `#/platform/revenue` in the URL → bounced to the dashboard. The matrix is
  enforced by sidebar, router **and** API (403).

### 3 · Sunset Weddings — run the business (45 s) → `sana@sunsetweddings.com`

1. **Org Dashboard** — business plan, 2 booths online, live *Kapoor–Verma Wedding*, 2 open
   guest tickets, usage bars 2/10 devices.
2. **Events & Devices**
   - Events tab: the live wedding (customisation chips: 2 filters · 2 templates), pause it →
     **Paused** chip; resume. **No price column, no passkey anywhere on the screen.**
   - Devices tab: 2 booths with UUIDs, online dots, last seen.
   - Assignments tab: move a booth from the wedding to the 24 Sep event.
   - **Create event** — three sections, zero prices:
     ① *General*: name, client/host, location, start, end, digital-copy toggle on.
     ② *Customisation*: tick filters (*Warm*, *B&W*) and pick templates (*4x6 Grid 6* +
     *Strip 3*) from all available platform templates — each shown as a mini print preview.
     ③ *Branding*: leave the logo as *none* (or upload one — it lands in the print footer)
     and set the tagline. A live output preview shows the frame + footer.
     Create → it appears as *Upcoming*.
3. **Org Revenue** (Admin-only) — per-event and per-booth earnings, payment donut.
4. **Support** — open *Printer jammed during wedding* → reply → **Mark resolved (with note)**.
   Open the payment ticket → **Reopen**.
5. **Coupon Management** — VIP50 is *exhausted* (0 left, red bar). Create
   `ANNIVERSARY25` — 25 % off, 40 uses, 30 days, tied to one event. Pause it → chip flips.
6. **Organisation Defaults** — the *only* pricing surface in the CRM: every platform frame
   rendered as a real print preview, each with a price input and an *Available on booth*
   toggle. Bump *Royal Black* ₹60 → ₹80, switch *Festive Maroon* off at the booths; set the
   idle timeout 600 → 120 s (the "≈ 2 min" hint updates). Save → persisted.

> Talking point: coupons are private (booth shows only an "Enter Coupon" field). A frame is
> the canvas a print is made on — the complete output print is on the frame — and frame
> prices + booth availability live **only** here, never on events.

### 4 · Org Manager — the constrained seat (20 s) → `rohit@sunsetweddings.com`

- Sidebar: Dashboard, Events & Devices, Support, Defaults (read-only), Profile. **No** Revenue,
  Coupons, Org Audit, Team.
- **Events & Devices** — full operational access: can create events, pause/resume, assign booths.
- **Organisation Defaults** — every input disabled (frame price fields, booth toggles,
  timeout), no Save button, read-only banner.
- Type `#/org/revenue` → bounced to dashboard (API would 403 anyway).

### 5 · Support Manager — platform eyes, no platform hands (10 s) → `support@happypix.com`

- Platform Dashboard + Organisations (read) only. No Revenue, no Templates, no Team, no Audit.
- Demonstrates the third platform role exists but is intentionally narrow.

---

### Failure modes worth showing (10 s each, all already seeded)

| What | Where | What you see |
|---|---|---|
| Expired plan blocks work | log in `aakash@alphabooths.in` | warning banner, **Create event** disabled, API 403 |
| Suspended org | `riya@riyastudio.com` | limited view + reason, no event creation |
| Banned org | `glow@glowevents.com` | login rejected with ban reason |
| Expiring plan | `arpita@pika.in` | dashboard warning "11 days left", renewal chip |
| Trial lifecycle | `nova@novaoccasions.com` | trial banner, day count, "one extension allowed" note |

### One-liner for the room

> "Five fixed roles, thirteen screens, one matrix enforced in the sidebar, the router and the
> API — booths are UUID devices, not users, events carry no price (the frame is the print
> canvas and only Organisation Defaults hold prices), and every plan limit, coupon and
> suspend/ban is decided server-side."
