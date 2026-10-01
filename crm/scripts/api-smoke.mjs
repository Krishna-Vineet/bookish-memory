// API smoke test for the v2 mock server (in-memory, no HTTP needed).
// Run: node scripts/api-smoke.mjs
//
// Covers the redefined surfaces:
//   • Event create/update — General/Customisation/Branding + event-specific
//     layout-price snapshots/overrides, with NO passkey
//   • Organization Defaults — idle timeout in SECONDS + default layoutPrices
//     (per layout iteration: family × image-slot count)
//   • Templates — platform Template Library: 17 seeds (14 designer + 2 AI +
//     1 playground), layout-anchored CRUD + AI draft + publish gating

import { handle } from '../src/api/mock/server.js'

let pass = 0
let fail = 0
const results = []

function check(label, cond, extra = '') {
  if (cond) {
    pass++
    results.push(`  ok   ${label}`)
  } else {
    fail++
    results.push(`  FAIL ${label}${extra ? ` — ${extra}` : ''}`)
  }
}

function call(method, path, body, token) {
  try {
    const r = handle(method, path, body, token)
    return { status: r.status, data: r.data, error: null }
  } catch (e) {
    return { status: e.status || 500, data: null, error: e.message }
  }
}

async function login(email) {
  const r = call('POST', '/api/auth/login', { email, password: 'demo123' })
  return r.data?.token
}

// ---------------- Auth ----------------
const owner = await login('owner@happypix.com')
const pa = await login('priya@happypix.com')
const supportManager = await login('support@happypix.com')
const sana = await login('sana@sunsetweddings.com')
const rohit = await login('rohit@sunsetweddings.com')

check('login owner → token', !!owner)
check('login org admin → token', !!sana)
check('login org manager → token', !!rohit)
check('wrong password → 401', call('POST', '/api/auth/login', { email: 'owner@happypix.com', password: 'nope' }).status === 401)
check('no token → 401', call('GET', '/api/platform/dashboard', null, null).status === 401)

// ---------------- Platform templates (Template Library) ----------------
let r = call('GET', '/api/platform/templates', null, owner)
check('GET templates (owner) → 200 with 17 seeds', r.status === 200 && r.data.templates.length === 17)
const royal = r.data.templates.find((t) => t.id === 'hp-royal-57v3')
check('designer template shape: layout-anchored with meta', royal && royal.componentId === 'RoyalWedding' && royal.layoutId === '57-v3' && royal.layout?.slots === 3 && royal.layout?.orientation === 'portrait' && royal.layout?.code === '57')
check('AI seed has data-URI background + design config', (() => { const t = r.data.templates.find((x) => x.id === 'hp-ai-royal-46v3'); return t && t.source === 'ai_generated' && typeof t.design?.bg?.url === 'string' && t.design.bg.url.startsWith('data:image/svg') })())
check('org admin may READ templates (use perm)', call('GET', '/api/platform/templates', null, sana).status === 200)
check('org admin may not CREATE templates', call('POST', '/api/platform/templates', { name: 'X', layoutId: '46-v1' }, sana).status === 403)

check('POST template without layoutId → 400', call('POST', '/api/platform/templates', { name: 'Bad' }, owner).status === 400)
check('POST template unknown layoutId → 400', call('POST', '/api/platform/templates', { name: 'Bad', layoutId: 'nope' }, owner).status === 400)
r = call('POST', '/api/platform/templates', { name: 'Playground Test', description: 'smoke', category: 'Party', layoutId: '810-210-v4', design: { bg: { type: 'solid', colors: ['#112233'] }, accent: '#D9B44A', textColor: '#FFFFFF', ornament: 'dots', font: 'sans', slotShape: 'round' } }, owner)
check('POST playground template → 201, source playground, published', r.status === 201 && r.data?.template?.id && r.data.template.source === 'playground' && r.data.template.active === true && r.data.template.layoutId === '810-210-v4')
const pgTestId = r.data?.template?.id

r = call('POST', '/api/platform/templates/ai-generate', { prompt: 'A luxury black and gold birthday template with balloons', layoutId: '46-v4' }, owner)
check('POST ai-generate → design draft for the layout', r.status === 200 && r.data?.draft?.layoutId === '46-v4' && typeof r.data.draft?.design?.bg?.url === 'string' && r.data.draft.design.bg.url.startsWith('data:image/svg'))
check('…draft NOT persisted', call('GET', '/api/platform/templates', null, owner).data.templates.length === 18) // 17 + 1 playground

r = call('POST', '/api/platform/templates', { ...r.data.draft, name: r.data.draft.name, category: 'Birthday' }, owner)
check('save AI draft → published ai_generated template', r.status === 201 && r.data?.template?.source === 'ai_generated' && r.data.template.active === true && r.data.template.design?.bg?.url?.startsWith('data:image/svg'))
const aiTestId = r.data?.template?.id

r = call('PUT', `/api/platform/templates/${pgTestId}`, { name: 'Playground Test Renamed' }, owner)
check('PUT rename template → 200', r.status === 200 && r.data?.template?.name === 'Playground Test Renamed')
check('PUT by org admin → 403', call('PUT', `/api/platform/templates/${pgTestId}`, { name: 'Hax' }, sana).status === 403)
check('PUT layout change on event-used template → 409', call('PUT', '/api/platform/templates/hp-classic-46v1', { layoutId: '57-v1' }, owner).status === 409)
r = call('PUT', `/api/platform/templates/${pgTestId}`, { layoutId: '810-210-h4' }, owner)
check('PUT layout change on unused template → 200', r.status === 200 && r.data?.template?.layoutId === '810-210-h4')
r = call('PUT', `/api/platform/templates/${pgTestId}`, { active: false }, owner)
check('PUT unpublish → 200, hidden', r.status === 200 && r.data?.template?.active === false)
check('unpublished template rejected on event create', call('POST', '/api/org/events', { name: 'X', startDate: '2026-09-24T10:00:00+05:30', endDate: '2026-09-24T12:00:00+05:30', templateIds: [pgTestId] }, sana).status === 400)
r = call('PUT', `/api/platform/templates/${pgTestId}`, { active: true }, owner)
check('PUT republish → 200', r.status === 200 && r.data?.template?.active === true)

check('DELETE designer component template → 409', call('DELETE', '/api/platform/templates/hp-classic-46v1', null, owner).status === 409)
check('DELETE event-used playground template → 409', call('DELETE', '/api/platform/templates/hp-royal-57v3', null, owner).status === 409)
r = call('DELETE', `/api/platform/templates/${aiTestId}`, null, owner)
check('DELETE unused AI template → 200', r.status === 200)
r = call('DELETE', `/api/platform/templates/${pgTestId}`, null, owner)
check('DELETE unused playground template → 200', r.status === 200)
check('DELETE missing template → 404', call('DELETE', '/api/platform/templates/hp-nope', null, owner).status === 404)

// ---------------- Org events (new shape) ----------------
r = call('GET', '/api/org/events', null, sana)
check('GET events (org admin) → 200', r.status === 200 && Array.isArray(r.data.events))
check('seed events have no price/passkey fields', r.data.events.every((e) => e.printPrice === undefined && e.passkey === undefined))
check('seed event has new shape', (() => { const e = r.data.events.find((x) => x.id === 'evt-sun-1'); return e && Array.isArray(e.templateIds) && e.templateIds.every((t) => typeof t === 'string' && t.startsWith('hp-')) && Array.isArray(e.filters) && typeof e.digitalCopy === 'boolean' && Array.isArray(e.branding?.logos) })())

// Mock clock is 24 Sep 2026 11:30 +05:30 — pick an event that is ACTIVE then.
const start = '2026-09-24T10:00:00+05:30'
const end = '2026-09-24T20:00:00+05:30'
r = call('POST', '/api/org/events', {
  name: 'Smoke Wedding', clientName: 'A & B', location: 'Delhi',
  startDate: start, endDate: end, digitalCopy: true,
  filters: ['warm', 'bw'], templateIds: ['hp-classic-46v1', 'hp-sunset-4626v3'],
  layoutPrices: { '46:1': 321, '46-26:3': 111 },
  branding: { logos: ['data:image/svg+xml;utf8,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22/%3E', 'data:image/png;base64,iVBORw0KGgo='], tagline: 'Smoke tagline' },
}, sana)
check('POST event (new shape) → 201', r.status === 201)
const ev = r.data?.event
check('event has no price, no passkey', !!ev && ev.printPrice === undefined && ev.passkey === undefined && ev.frameIds === undefined)
check('event echoes branding logos + digitalCopy', !!ev && ev.digitalCopy === true && ev.branding?.tagline === 'Smoke tagline' && ev.branding?.logos?.length === 2 && ev.filters.length === 2)
check('event saves full effective pricing with creation overrides', !!ev && Object.keys(ev.layoutPrices || {}).length >= 38 && ev.layoutPrices['46:1'] === 321 && ev.layoutPrices['46-26:3'] === 111)
const smokeEventId = ev?.id

check('POST event unknown filter → 400', call('POST', '/api/org/events', { name: 'X', startDate: start, endDate: end, filters: ['sparkly'] }, sana).status === 400)
check('POST event unknown template → 400', call('POST', '/api/org/events', { name: 'X', startDate: start, endDate: end, templateIds: ['tpl-nope'] }, sana).status === 400)
check('POST event end before start → 400', call('POST', '/api/org/events', { name: 'X', startDate: end, endDate: start }, sana).status === 400)
check('POST event with 16 logos → 400', call('POST', '/api/org/events', { name: 'X', startDate: start, endDate: end, branding: { logos: Array.from({ length: 16 }, (_, i) => `logo-${i}`) } }, sana).status === 400)
check('POST event by org manager → 201 (can create)', call('POST', '/api/org/events', { name: 'Manager Event', startDate: start, endDate: end }, rohit).status === 201)

r = call('PUT', `/api/org/events/${smokeEventId}`, { digitalCopy: false, filters: ['warm'], layoutPrices: { '46:1': 299 }, branding: { logos: ['solo'], tagline: 'New tagline' } }, sana)
check('PUT event → 200 with updates', r.status === 200 && r.data?.event?.digitalCopy === false && r.data?.event?.branding?.tagline === 'New tagline' && r.data?.event?.branding?.logos?.length === 1 && r.data?.event?.filters.length === 1)
check('PUT event saves price override without losing its snapshot', r.data?.event?.layoutPrices?.['46:1'] === 299 && r.data?.event?.layoutPrices?.['46-26:3'] === 111)
check('PUT event unknown price key → 400', call('PUT', `/api/org/events/${smokeEventId}`, { layoutPrices: { 'bad:2': 10 } }, sana).status === 400)

check('DELETE active event → 409', call('DELETE', `/api/org/events/${smokeEventId}`, null, sana).status === 409)
check('pause event → 200', call('POST', `/api/org/events/${smokeEventId}/pause`, {}, sana).status === 200)
check('DELETE paused event → 200', call('DELETE', `/api/org/events/${smokeEventId}`, null, sana).status === 200)

// ---------------- Org defaults (new shape) ----------------
r = call('GET', '/api/org/defaults', null, sana)
check('GET defaults (org admin) → 200', r.status === 200)
check('defaults have boothTimeoutSec, NO pricing fields', !!r.data && Number.isFinite(r.data.boothTimeoutSec) && r.data.printPrice === undefined && r.data.downloadPrice === undefined && r.data.boothTimeoutMin === undefined)
check('defaults expose layoutPrices over the full suggested map', r.data?.layoutPrices && Object.keys(r.data.layoutPrices).length >= 38 && Object.keys(r.data.layoutPrices).every((k) => /^[-0-9a-z]+:\d+$/.test(k) && Number.isFinite(r.data.layoutPrices[k])))
check('sunset 5×7 3-image iteration keeps its custom ₹90 price', r.data?.layoutPrices?.['57:3'] === 90)
check('GET defaults (org manager, read-only) → 200', call('GET', '/api/org/defaults', null, rohit).status === 200)
check('PUT defaults (org manager) → 403', call('PUT', '/api/org/defaults', { boothTimeoutSec: 100 }, rohit).status === 403)
check('PUT defaults by platform owner → 403 (org scope)', call('PUT', '/api/org/defaults', { boothTimeoutSec: 100 }, owner).status === 403)

r = call('PUT', '/api/org/defaults', { boothTimeoutSec: 120, layoutPrices: { '68:4': 120, '810-210:5': 55 } }, sana)
check('PUT defaults: timeout 120s + two layout prices → 200', r.status === 200 && r.data?.boothTimeoutSec === 120 && r.data?.layoutPrices?.['68:4'] === 120 && r.data?.layoutPrices?.['810-210:5'] === 55)
check('…partial PUT keeps sunset\'s other custom prices', r.data?.layoutPrices?.['57:3'] === 90 && r.data?.layoutPrices?.['46:1'] > 0)
check('PUT boothTimeoutSec 5 → 400', call('PUT', '/api/org/defaults', { boothTimeoutSec: 5 }, sana).status === 400)
check('PUT unknown layout key → 400', call('PUT', '/api/org/defaults', { layoutPrices: { 'frame-nope:2': 10 } }, sana).status === 400)
check('PUT negative price → 400', call('PUT', '/api/org/defaults', { layoutPrices: { '68:4': -5 } }, sana).status === 400)

// ---------------- Cross-role guards ----------------
check('org admin on platform orgs → 403', call('GET', '/api/platform/organizations', null, sana).status === 403)
check('platform admin on org events → 403 (org scope)', call('GET', '/api/org/events', null, pa).status === 403)

// ---------------- Devices: rename + booth operator (v2.1) ----------------
r = call('GET', '/api/org/devices', null, rohit)
const devId = r.data?.devices?.[0]?.id
check('GET devices (org manager) → 200 with operator, telemetry + connection health', r.status === 200 && r.data.devices.every((d) => 'operatorName' in d && 'telemetry' in d && typeof d.connections?.camera === 'boolean' && typeof d.connections?.printer === 'boolean' && typeof d.connections?.kioskScreen === 'boolean'))

r = call('PUT', `/api/org/devices/${devId}`, { deviceName: 'Booth 01 — Renamed', operatorName: 'Ramesh Test', operatorPhone: '+91 90000 00000' }, rohit)
check('PUT device rename + operator (org manager) → 200', r.status === 200 && r.data?.device?.deviceName === 'Booth 01 — Renamed' && r.data?.device?.operatorName === 'Ramesh Test')
check('PUT device empty name → 400', call('PUT', `/api/org/devices/${devId}`, { deviceName: '  ' }, rohit).status === 400)
check('PUT device (platform owner) → 403 org scope', call('PUT', `/api/org/devices/${devId}`, { deviceName: 'X' }, owner).status === 403)
r = call('PUT', `/api/org/devices/${devId}`, { deviceName: 'Booth 01 — Main Hall', operatorName: null, operatorPhone: null }, sana)
check('PUT device operator cleared by org admin → 200', r.status === 200 && r.data?.device?.operatorName === null)

// ---------------- Booth telemetry push (v2.1) ----------------
const dev = call('GET', '/api/org/devices', null, sana).data.devices[0]
r = call('POST', `/api/booth/devices/${dev.deviceUuid}/telemetry`, {
  printsTotal: 999, shutterCount: 2001, batteryPct: 55,
  connections: { camera: true, printer: false, kioskScreen: true },
}, null)
check('POST booth telemetry (public, uuid) → 200 with peripheral health', r.status === 200 && r.data?.telemetry?.prints === 999 && r.data?.telemetry?.batteryPct === 55 && r.data?.connections?.camera === true && r.data?.connections?.printer === false && r.data?.connections?.kioskScreen === true)
check('POST booth telemetry rejects non-boolean connection state', call('POST', `/api/booth/devices/${dev.deviceUuid}/telemetry`, { connections: { camera: 'yes' } }, null).status === 400)
check('POST booth telemetry unknown uuid → 404', call('POST', '/api/booth/devices/nope/telemetry', { printsTotal: 1 }, null).status === 404)
r = call('GET', '/api/org/devices', null, sana)
const reportedDevice = r.data?.devices?.find((d) => d.id === dev.id)
check('telemetry + connection health visible to CRM via org devices', reportedDevice?.telemetry?.prints === 999 && reportedDevice?.connections?.camera === true && reportedDevice?.connections?.printer === false && reportedDevice?.connections?.kioskScreen === true)

// ---------------- Forgot / reset password (OTP-style, v2.1) ----------------
r = call('POST', '/api/auth/forgot-password', { email: 'rohit@sunsetweddings.com' }, null)
const fpCode = r.data?.code
check('forgot-password → 200 with 6-digit demo code', r.status === 200 && /^\d{6}$/.test(fpCode || ''))
check('forgot-password unknown email → 200 (no leak)', call('POST', '/api/auth/forgot-password', { email: 'ghost@nowhere.io' }, null).status === 200)
check('reset-password wrong code → 400', call('POST', '/api/auth/reset-password', { email: 'rohit@sunsetweddings.com', code: '000000', newPassword: 'newpass1' }, null).status === 400)
check('reset-password short password → 400', call('POST', '/api/auth/reset-password', { email: 'rohit@sunsetweddings.com', code: fpCode, newPassword: '123' }, null).status === 400)
r = call('POST', '/api/auth/reset-password', { email: 'rohit@sunsetweddings.com', code: fpCode, newPassword: 'newpass1' }, null)
check('reset-password with correct code → 200', r.status === 200)
check('login with new password → 200', call('POST', '/api/auth/login', { email: 'rohit@sunsetweddings.com', password: 'newpass1' }).status === 200)
check('code is single-use → 400 on repeat', call('POST', '/api/auth/reset-password', { email: 'rohit@sunsetweddings.com', code: fpCode, newPassword: 'again12' }, null).status === 400)

// ---------------- Booth-created ticket with session context (v2.1) ----------------
r = call('POST', '/api/booth/tickets', {
  organizationId: 'org-sunset', eventId: 'evt-sun-1', deviceId: dev.id,
  subject: 'Print came out blank', category: 'payment', priority: 'high',
  guestName: 'Test Guest', message: 'Paid but print is blank.',
  session: {
    id: 'SES-TEST', phone: '+91 90000 11111',
    slot: { label: 'Slot T', start: '2026-09-24T10:00:00+05:30', end: '2026-09-24T10:30:00+05:30' },
    package: { templateId: 'hp-classic-46v1', layout: '4×6 · 1', prints: 2, digitalCopy: true },
    cameraClicks: 5, filtersUsed: ['warm'],
    payment: { utr: '417TEST999', amount: 100, status: 'paid', method: 'UPI', at: '2026-09-24T10:25:00+05:30' },
    startedAt: '2026-09-24T10:00:00+05:30', endedAt: '2026-09-24T10:28:00+05:30',
  },
}, null)
const btId = r.data?.ticket?.id
check('POST booth ticket → 201 with resolved session refs', r.status === 201 && r.data?.ticket?.session?.package?.templateName === 'Classic White' && r.data?.ticket?.session?.package?.layout === '4×6 · 1' && r.data?.ticket?.session?.phone === '+91 90000 11111')
check('POST booth ticket without session → 400', call('POST', '/api/booth/tickets', { organizationId: 'org-sunset', subject: 'x' }, null).status === 400)
r = call('GET', `/api/org/tickets/${btId}`, null, sana)
check('org can read booth ticket with session', r.status === 200 && r.data?.ticket?.session?.payment?.utr === '417TEST999')

// ---------------- Security round (v2.2) ----------------
// forged token
check('forged token → 401', call('GET', '/api/auth/me', null, 'mock:usr-owner:deadbeef').status === 401)
check('legacy bare token format → 401', call('GET', '/api/auth/me', null, 'mock:usr-owner').status === 401)
// logout revokes
const tmpTok = await login('priya@happypix.com')
check('logout → 200', call('POST', '/api/auth/logout', {}, tmpTok).status === 200)
check('revoked token → 401', call('GET', '/api/auth/me', null, tmpTok).status === 401)
// login lockout
for (let i = 0; i < 5; i++) call('POST', '/api/auth/login', { email: 'support@happypix.com', password: 'wrong-pass' })
r = call('POST', '/api/auth/login', { email: 'support@happypix.com', password: 'demo123' })
check('5 failed logins → 429 lockout even with correct password', r.status === 429)
// wrong password rejected (was: any 6+ chars accepted!)
check('wrong password → 401', call('POST', '/api/auth/login', { email: 'priya@happypix.com', password: 'definitely-wrong' }).status === 401)
// change password: current must match + policy
check('change password wrong current → 400', call('POST', '/api/auth/password', { currentPassword: 'nope', newPassword: 'Strong123' }, sana).status === 400)
check('change password weak new → 400', call('POST', '/api/auth/password', { currentPassword: 'demo123', newPassword: 'abcdefgh' }, sana).status === 400)
// email change: password + OTP
check('email change wrong password → 400', call('POST', '/api/auth/email/change-request', { newEmail: 'sana.new@sunsetweddings.com', currentPassword: 'x' }, sana).status === 400)
check('email change to taken email → 409', call('POST', '/api/auth/email/change-request', { newEmail: 'rohit@sunsetweddings.com', currentPassword: 'demo123' }, sana).status === 409)
check('email change bad format → 400', call('POST', '/api/auth/email/change-request', { newEmail: 'not-an-email', currentPassword: 'demo123' }, sana).status === 400)
r = call('POST', '/api/auth/email/change-request', { newEmail: 'sana.new@sunsetweddings.com', currentPassword: 'demo123' }, sana)
const ecCode = r.data?.code
check('email change request → 200 with demo code', r.status === 200 && /^\d{6}$/.test(ecCode || ''))
check('email change confirm wrong code → 400', call('POST', '/api/auth/email/change-confirm', { code: '000000' }, sana).status === 400)
r = call('POST', '/api/auth/email/change-confirm', { code: ecCode }, sana)
check('email change confirm → 200, email swapped', r.status === 200 && r.data?.user?.email === 'sana.new@sunsetweddings.com')
check('login with new email → 200', call('POST', '/api/auth/login', { email: 'sana.new@sunsetweddings.com', password: 'demo123' }).status === 200)
// reset-password routes are gone
check('platform reset-password route removed → 404', call('POST', '/api/platform/users/usr-priya/reset-password', {}, owner).status === 404)
check('org reset-password route removed → 404', call('POST', '/api/org/team/usr-rohit/reset-password', {}, sana).status === 404)
// media URL guard
check('profile photo javascript: URL → 400', call('PUT', '/api/auth/profile', { photoUrl: 'javascript:alert(1)' }, sana).status === 400)
check('profile photo data:text/html → 400', call('PUT', '/api/auth/profile', { photoUrl: 'data:text/html,<script>1</script>' }, sana).status === 400)
check('profile photo data:image/png → 200', call('PUT', '/api/auth/profile', { photoUrl: 'data:image/png;base64,iVBORw0KGgo=' }, sana).status === 200)

// ---------------- Org Team & Roles (v2.2) ----------------
// rohit's earlier session was (correctly) revoked by his password reset — sign in again
check('password reset revoked old session → 401', call('GET', '/api/auth/me', null, rohit).status === 401)
const rohit2 = call('POST', '/api/auth/login', { email: 'rohit@sunsetweddings.com', password: 'newpass1' }).data?.token
r = call('GET', '/api/org/team', null, rohit2)
check('manager can VIEW org team (read-only)', r.status === 200 && r.data?.canManage === false)
check('manager cannot add members → 403', call('POST', '/api/org/team', { name: 'X', email: 'x@sunsetweddings.com', password: 'Strong123', role: 'ORG_MANAGER' }, rohit2).status === 403)
r = call('POST', '/api/org/team', { name: 'Meera Iyer', email: 'meera@sunsetweddings.com', password: 'Strong123', role: 'ORG_ADMIN' }, sana)
const meeraId = r.data?.user?.id
check('admin adds another ORG_ADMIN → 201', r.status === 201 && r.data?.user?.role === 'ORG_ADMIN')
check('add member weak password → 400', call('POST', '/api/org/team', { name: 'Y', email: 'y@sunsetweddings.com', password: 'short', role: 'ORG_MANAGER' }, sana).status === 400)
check('add member bogus role → 400', call('POST', '/api/org/team', { name: 'Z', email: 'z@sunsetweddings.com', password: 'Strong123', role: 'OWNER' }, sana).status === 400)
check('admin cannot edit member role', call('PUT', `/api/org/team/usr-rohit`, { role: 'ORG_ADMIN' }, sana).status === 403)
check('admin cannot edit member name/email', call('PUT', `/api/org/team/usr-rohit`, { name: 'Changed', email: 'changed@example.com' }, sana).status === 403)
check('admin cannot deactivate self → 400', call('POST', `/api/org/team/${r.data ? 'usr-sana' : ''}/deactivate`, {}, sana).status === 400)
check('deactivate new admin (still ≥1 left) → 200', call('POST', `/api/org/team/${meeraId}/deactivate`, {}, sana).status === 200)
check('admin cannot demote even their own account', call('PUT', `/api/org/team/usr-sana`, { role: 'ORG_MANAGER' }, sana).status === 403)
const gallerySettings = call('GET', '/api/platform/gallery-settings', null, owner)
check('Owner reads gallery settings', gallerySettings.status === 200 && gallerySettings.data.galleryEnabled === true)
check('Platform Admin updates gallery policy', call('PUT', '/api/platform/gallery-settings', { requireGuestConsent: true }, pa).status === 200)
const consentGallery = call('GET', '/api/org/gallery', null, sana)
check('Org Admin gallery only returns consented finals', consentGallery.status === 200 && consentGallery.data.photos.length > 0 && consentGallery.data.photos.every((p) => p.guestConsent === true))
check('Org Manager can view gallery', call('GET', '/api/org/gallery?boothId=dev-sun-1', null, rohit2).status === 200)
call('PUT', '/api/platform/gallery-settings', { requireGuestConsent: false }, owner)
const allGallery = call('GET', '/api/org/gallery?eventId=evt-sun-1', null, sana)
check('Consent-off policy includes all final photos', allGallery.data.photos.some((p) => p.guestConsent === false))
call('PUT', '/api/platform/gallery-settings', { galleryEnabled: false }, owner)
const disabledGallery = call('GET', '/api/org/gallery', null, sana)
check('Platform switch disables organization gallery', disabledGallery.status === 200 && disabledGallery.data.enabled === false && disabledGallery.data.photos.length === 0)
check('org-detail returns full object (not paginated list)', (() => { const d = call('GET', '/api/platform/organizations/org-sunset', null, owner).data; return Array.isArray(d?.devices) && Array.isArray(d?.events) && d?.plan?.planName && d?.revenue && !('items' in d) })())

// ---- Round 5: UPI payouts, wallet, withdrawals, event×booth matrix ----
r = call('GET', '/api/org/revenue', null, sana)
check('revenue has payout/wallet/settlement/matrix/monthSplit', r.status === 200 && r.data.payout && r.data.wallet && typeof r.data.settlement?.upi === 'number' && Array.isArray(r.data.matrix) && Array.isArray(r.data.monthSplit))
check('matrix rows carry eventName+deviceName+viaUpi+viaWallet', r.data.matrix.length > 0 && r.data.matrix.every((c) => c.eventName && c.deviceName && c.viaUpi + c.viaWallet === c.total))
check('matrix total == paid settlement total (pending excluded)', r.data.matrix.reduce((s, c) => s + c.total, 0) === r.data.settlement.upi + r.data.settlement.wallet)
check('settlement upi+wallet == wallet.credited + wallet.viaUpi', r.data.settlement.upi + r.data.settlement.wallet === r.data.wallet.credited + r.data.wallet.viaUpi)
const bal0 = r.data.wallet.balance
check('wallet balance = credited − withdrawn − processing', bal0 === r.data.wallet.credited - r.data.wallet.withdrawn - r.data.wallet.processing)
check('GET /org/wallet is admin-only (manager → 403)', call('GET', '/api/org/wallet', null, rohit2).status === 403 && call('GET', '/api/org/wallet', null, sana).status === 200)
check('withdraw below ₹500 → 400', call('POST', '/api/org/wallet/withdraw', { amount: 499 }, sana).status === 400)
check('withdraw above balance → 400', call('POST', '/api/org/wallet/withdraw', { amount: bal0 + 1 }, sana).status === 400)
check('withdraw NaN → 400', call('POST', '/api/org/wallet/withdraw', { amount: 'abc' }, sana).status === 400)
check('manager cannot withdraw → 403', call('POST', '/api/org/wallet/withdraw', { amount: 500 }, rohit2).status === 403)
r = call('POST', '/api/org/wallet/withdraw', { amount: 500 }, sana)
check('admin withdraw ₹500 → 201 processing to org UPI', r.status === 201 && r.data.withdrawal.status === 'processing' && r.data.withdrawal.upiId === 'sunsetweddings@okaxis' && r.data.wallet.balance === bal0 - 500)
check('platform owner cannot hit org wallet → 403', call('POST', '/api/org/wallet/withdraw', { amount: 500 }, owner).status === 403)
r = call('GET', '/api/org/defaults', null, sana)
check('defaults expose upiId + payoutMode + wallet', r.data.upiId === 'sunsetweddings@okaxis' && r.data.payoutMode === 'wallet' && typeof r.data.wallet?.balance === 'number')
check('invalid UPI id → 400', call('PUT', '/api/org/defaults', { upiId: 'not a upi' }, sana).status === 400)
check('bogus payoutMode → 400', call('PUT', '/api/org/defaults', { payoutMode: 'cash' }, sana).status === 400)
check('turn UPI on → 200 mode=upi', call('PUT', '/api/org/defaults', { payoutMode: 'upi' }, sana).data?.payoutMode === 'upi')
check('dashboard revenue carries payout+wallet for admin', (() => { const d = call('GET', '/api/org/dashboard', null, sana).data; return d.revenue?.payout?.payoutMode === 'upi' && typeof d.revenue?.wallet?.balance === 'number' })())
check('clear UPI id while mode=upi still allowed (mode kept)', call('PUT', '/api/org/defaults', { upiId: '' }, sana).status === 200)
check('turn UPI on without UPI id → 400', call('PUT', '/api/org/defaults', { upiId: '', payoutMode: 'upi' }, sana).status === 400)
check('withdraw with no UPI id → 400', call('POST', '/api/org/wallet/withdraw', { amount: 500 }, sana).status === 400)
call('PUT', '/api/org/defaults', { upiId: 'sunsetweddings@okaxis', payoutMode: 'wallet' }, sana)
check('booth ticket payment gets settlement stamped from org mode', (() => {
  const t = call('POST', '/api/booth/tickets', { organizationId: 'org-sunset', eventId: 'evt-sun-1', deviceId: 'dev-sun-1', subject: 'Print faded', session: { id: 'SES-T', phone: '+91 90000 00000', payment: { utr: '1', amount: 100, status: 'paid', method: 'UPI' } } })
  const pay = t.data?.session?.payment || t.data?.ticket?.session?.payment
  return t.status === 201 && pay?.settlement === 'wallet'
})())

// ---- Round 6: protected platform identities, plans, and org↔platform support ----
r = call('GET', '/api/platform/users', null, owner)
check('Owner can list internal team', r.status === 200 && r.data.users.some((u) => u.id === 'usr-pa'))
check('Owner cannot edit a team member name/email', call('PUT', '/api/platform/users/usr-pa', { name: 'Changed', email: 'changed@happypix.com' }, owner).status === 403)
check('Owner can deactivate team member', call('PUT', '/api/platform/users/usr-pa', { status: 'inactive' }, owner).data?.user?.status === 'inactive')
check('Owner can re-activate team member', call('PUT', '/api/platform/users/usr-pa', { status: 'active' }, owner).data?.user?.status === 'active')
const pa2 = await login('priya@happypix.com')
check('Owner cannot deactivate self', call('PUT', '/api/platform/users/usr-owner', { status: 'inactive' }, owner).status === 400)

r = call('GET', '/api/platform/plans', null, owner)
check('Owner sees all subscription plans', r.status === 200 && r.data.plans.length >= 6 && r.data.plans.some((p) => p.key === 'business'))
check('Platform Admin cannot manage plans', call('GET', '/api/platform/plans', null, pa2).status === 403)
r = call('POST', '/api/platform/plans', { key: 'growth-plus', name: 'Growth Plus', description: 'Smoke plan', price: 14999, durationMonths: 12, durationLabel: '12 months', devices: 20, events: 15, active: true }, owner)
const growthPlanId = r.data?.plan?.id
check('Owner adds subscription plan', r.status === 201 && r.data?.plan?.key === 'growth-plus')
r = call('PUT', `/api/platform/plans/${growthPlanId}`, { name: 'Growth Plus 2', price: 15999, devices: 22 }, owner)
check('Owner edits subscription plan', r.status === 200 && r.data?.plan?.name === 'Growth Plus 2' && r.data?.plan?.price === 15999 && r.data?.plan?.devices === 22)
check('Plan key is immutable', call('PUT', `/api/platform/plans/${growthPlanId}`, { key: 'different' }, owner).status === 400)

check('all platform roles can view organization support', call('GET', '/api/platform/support', null, owner).status === 200 && call('GET', '/api/platform/support', null, pa2).status === 200 && call('GET', '/api/platform/support', null, supportManager).status === 200)
check('all organization roles can view platform support', call('GET', '/api/org/platform-support', null, sana).status === 200 && call('GET', '/api/org/platform-support', null, rohit2).status === 200)
const tinyImage = 'data:image/png;base64,iVBORw0KGgo='
r = call('POST', '/api/org/platform-support', { subject: 'Smoke platform help', category: 'technical', priority: 'urgent', message: 'Please inspect this screenshot and help us.', images: [tinyImage] }, rohit2)
const supportId = r.data?.request?.id
check('Organization Manager raises support request with image', r.status === 201 && r.data?.request?.status === 'new' && r.data?.request?.messages?.[0]?.images?.length === 1)
check('Organization cannot chat before request acceptance', call('POST', `/api/org/platform-support/${supportId}/reply`, { message: 'extra' }, sana).status === 409)
check('Platform denial requires visible reason', call('POST', `/api/platform/support/${supportId}/deny`, { reason: '' }, pa2).status === 400)
r = call('POST', `/api/platform/support/${supportId}/deny`, { reason: 'Please include the affected booth UUID before we create a ticket.' }, pa2)
check('Platform can deny request with reason', r.status === 200 && r.data?.request?.status === 'denied' && r.data?.request?.decision?.reason.includes('booth UUID'))
check('Organization sees platform denial reason', call('GET', `/api/org/platform-support/${supportId}`, null, sana).data?.request?.decision?.reason.includes('booth UUID'))
check('Denied request re-apply requires text', call('POST', `/api/org/platform-support/${supportId}/reapply`, { message: '' }, sana).status === 400)
r = call('POST', `/api/org/platform-support/${supportId}/reapply`, { message: 'Affected booth UUID is f47ac10b-58cc-4372-a567-0e02b2c3d471.' }, sana)
check('Organization can re-apply denied request', r.status === 200 && r.data?.request?.status === 'new' && r.data?.request?.reapplyCount === 1)
check('Re-application reason is explicit for platform review', r.data?.request?.lastReapplication?.text.includes('f47ac10b') && call('GET', `/api/platform/support/${supportId}`, null, owner).data?.request?.lastReapplication?.text.includes('f47ac10b'))
r = call('POST', `/api/platform/support/${supportId}/accept`, { message: 'Accepted after receiving the booth UUID.' }, owner)
check('Platform accepts request and creates ticket number', r.status === 200 && r.data?.request?.status === 'open' && /^HPX-\d{4}-\d{4}$/.test(r.data?.request?.ticketNo || ''))
r = call('POST', `/api/org/platform-support/${supportId}/reply`, { message: 'Here is another screenshot.', images: [tinyImage] }, rohit2)
check('Organization and platform share image-enabled chat', r.status === 200 && r.data?.request?.status === 'in_progress' && r.data?.request?.messages?.at(-1)?.images?.length === 1)
check('Organization cannot resolve via platform API', call('POST', `/api/platform/support/${supportId}/resolve`, { resolution: 'not allowed' }, sana).status === 403)
r = call('POST', `/api/platform/support/${supportId}/resolve`, { resolution: 'Sync cursor reset and both booths confirmed updated.' }, supportManager)
check('Platform resolves ticket with decision', r.status === 200 && r.data?.request?.status === 'resolved' && r.data?.request?.resolution.includes('Sync cursor'))
check('Organization cannot reopen or reply to resolved ticket', call('POST', `/api/org/platform-support/${supportId}/reapply`, { message: 'reopen' }, sana).status === 409 && call('POST', `/api/org/platform-support/${supportId}/reply`, { message: 'reopen' }, sana).status === 409)
r = call('POST', `/api/platform/support/${supportId}/reopen`, { message: 'Reopening for a final device verification.' }, pa2)
check('Only platform can reopen resolved ticket', r.status === 200 && r.data?.request?.status === 'in_progress')
check('Organization chat resumes after platform reopens', call('POST', `/api/org/platform-support/${supportId}/reply`, { message: 'Both devices verified.' }, sana).status === 200)

console.log('\n' + results.join('\n'))
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
