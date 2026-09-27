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
3. **Organizations** — open **Glow Events** (banned): red banner shows the fraud reason + audit
   entry. Click **Restore**, then **Suspend** Riya Studio *without* a reason → error
   "reason is required". With a reason → audit-logged.
4. **Subscription Plans** — edit a plan's price/device/event limits, then add a new plan.
5. **Team & Roles** — existing teammates have no Edit action; the Owner can only deactivate
   or re-activate them. New Platform Admin / Support Manager accounts can still be created.
6. **Organization Support** — use **New requests** to accept one into a numbered ticket or deny
   it with a reason visible to the organization.

> Talking point: statuses are *computed* (trial / active / expiring soon / expired / suspended /
> banned), while the Owner controls the plan catalogue and account activation.

### 2 · Platform Admin — same console, less power (20 s) → `priya@happypix.com`

- Sidebar has **no Revenue**; Audit is visible but read-only, and the Suspend/Ban buttons are
  gone from Organizations. On **Templates & Frames** the *New frame / Remove* buttons are
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
     **Paused** chip; resume. There is no passkey; layout prices are edited inside the event editor.
   - Devices tab: booths with UUIDs, online dots and compact hardware-health tiles — camera,
     printer and external kiosk screen each show a green tick or red cross from the latest heartbeat.
   - Assignments tab: move a booth from the wedding to the 24 Sep event.
   - **Create event** — four sections:
     ① *General*: name, client/host, location, start, end, digital-copy toggle on.
     ② *Customisation*: tick filters (*Warm*, *B&W*) and pick templates from the platform
     library — each shown as a mini print preview.
     ③ *Event print pricing*: prices begin with Organization Defaults; override one value.
     ④ *Branding*: upload optional sponsor/host logos and set the tagline.
     Create → it appears as *Upcoming* with its own saved price snapshot.
3. **Org Revenue** (Admin-only) — per-event and per-booth earnings, payment donut.
4. **HappyPix Support** — raise an organization-level issue and attach a screenshot. Open the
   denied seed request to see its reason and the text-required **Re-apply** action.
5. **Guest Support** — open *Printer jammed during wedding* → reply → **Mark resolved**.
6. **Coupon Management** — VIP50 is *exhausted* (0 left, red bar). Create
   `ANNIVERSARY25` — 25 % off, 40 uses, 30 days, tied to one event. Pause it → chip flips.
7. **Organization Defaults** — the baseline layout-price map plus booth/payment settings.
   Change a default and set the idle timeout 600 → 120 s. Existing event snapshots remain
   unchanged; newly created events begin from the new default.

> Talking point: coupons are private (the booth shows only an "Enter Coupon" field), and
> event-specific layout prices are always validated and saved server-side.

### 4 · Org Manager — the constrained seat (20 s) → `rohit@sunsetweddings.com`

- Sidebar includes Dashboard, Events & Devices, Team (read-only), HappyPix Support,
  Guest Support, Defaults (read-only), and Profile. **No** Revenue or Coupons.
- **Events & Devices** — full operational access: can create events, pause/resume, assign booths.
- **Organization Defaults** — every input disabled (frame price fields, booth toggles,
  timeout), no Save button, read-only banner.
- Type `#/org/revenue` → bounced to dashboard (API would 403 anyway).

### 5 · Support Manager — platform eyes, no platform hands (10 s) → `support@happypix.com`

- Platform Dashboard + Organizations (read) + Organization Support. No Revenue, Plans,
  Templates, Team, or Audit.
- Accept/deny organization requests, chat with images, resolve and reopen tickets.

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

> "Five fixed roles, one permission matrix enforced in the sidebar, router and API; booths are
> UUID devices, event prices inherit defaults but can be safely overridden, and every plan,
> support workflow, coupon and suspend/ban decision is enforced server-side."
