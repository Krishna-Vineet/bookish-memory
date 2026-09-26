// Render-level smoke test: boots the real app (via Vite SSR module loading) inside jsdom,
// signs in as each demo role and renders every screen it is allowed to see.
// Run: node scripts/render-test.mjs

import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

const ROOT = new URL('..', import.meta.url).pathname
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost:5173/',
  pretendToBeVisual: true,
})
const { window } = dom

// Mirror the browser globals Node doesn't have.
for (const key of Object.getOwnPropertyNames(window)) {
  if (!(key in globalThis)) {
    try { globalThis[key] = window[key] } catch { /* read-only */ }
  }
}
globalThis.window = window
globalThis.document = window.document

const errors = []
const origErr = console.error
console.error = (...a) => {
  errors.push(a.map((x) => (typeof x === 'string' ? x : x?.message || String(x))).join(' '))
  origErr(...a)
}
window.addEventListener('error', (e) => errors.push(e.message || 'window error'))
process.on('unhandledRejection', (e) => errors.push('unhandledRejection: ' + (e?.message || e)))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const vite = await createServer({
  root: ROOT,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

const { default: React } = await import('react')
const { createElement } = React
const { createRoot } = await import('react-dom/client')
const { default: App } = await vite.ssrLoadModule('/src/App.jsx')
const { AppProvider } = await vite.ssrLoadModule('/src/context/AppContext.jsx')
const { handle } = await vite.ssrLoadModule('/src/api/mock/server.js')

const MARKERS = {
  '/platform/dashboard': ['Platform Dashboard', 'Expiring plans & trials'],
  '/platform/revenue': ['Platform Revenue', 'Organisation revenue'],
  '/platform/organisations': ['Organisations', 'Sunset Weddings'],
  '/platform/templates': ['Template Library', 'Royal Wedding', 'Classic White', 'New template'],
  '/platform/team': ['Team & Roles', 'Internal team', 'Fixed role model'],
  '/platform/audit': ['Audit & Logs'],
  '/org/dashboard': ['Sunset Weddings', 'Booths online', 'Plan usage'],
  '/org/revenue': ['Organisation Revenue', 'Revenue by event'],
  '/org/events': ['Events & Devices', 'Create event', 'Customisation'],
  '/org/support': ['Support', 'Printer jammed'],
  '/org/team': ['Team & Roles', 'Organisation team', 'Sana Kapoor', 'Rohit Das', 'Fixed role model'],
  '/org/defaults': ['Organisation Defaults', 'Booth behaviour', 'Layouts & print pricing', 'Pocket Polaroid'],
  '/org/coupons': ['Coupon Management', 'VIP50'],
  '/profile': ['Profile', 'Change password'],
}

const CASES = [
  { email: 'owner@happypix.com', routes: ['/platform/dashboard', '/platform/revenue', '/platform/organisations', '/platform/templates', '/platform/team', '/platform/audit', '/profile'] },
  { email: 'priya@happypix.com', routes: ['/platform/dashboard', '/platform/organisations', '/platform/templates', '/platform/team', '/profile'], forbidden: { path: '/platform/revenue', to: '/platform/dashboard' } },
  { email: 'support@happypix.com', routes: ['/platform/dashboard', '/platform/organisations', '/profile'], forbidden: { path: '/platform/templates', to: '/platform/dashboard' } },
  { email: 'sana@sunsetweddings.com', routes: ['/org/dashboard', '/org/revenue', '/org/events', '/org/team', '/org/support', '/org/defaults', '/org/coupons', '/profile'] },
  { email: 'rohit@sunsetweddings.com', routes: ['/org/dashboard', '/org/events', '/org/team', '/org/support', '/org/defaults', '/profile'], forbidden: { path: '/org/revenue', to: '/org/dashboard' } },
]

let pass = 0
let fail = 0
const results = []

async function renderCase(email, hash) {
  window.localStorage.clear()
  const login = handle('POST', '/api/auth/login', { email, password: 'demo123' }, null)
  if (!login.data?.token) throw new Error(`login failed for ${email}`)
  window.localStorage.setItem('hp_v2_token', login.data.token)
  window.localStorage.setItem('hp_v2_user', JSON.stringify(login.data.user))
  window.location.hash = hash
  const el = document.createElement('div')
  document.body.appendChild(el)
  errors.length = 0
  const root = createRoot(el)
  root.render(createElement(AppProvider, null, createElement(App)))
  await sleep(1200)
  const text = document.body.textContent || ''
  root.unmount()
  el.remove()
  await sleep(30)
  return { text, hash: window.location.hash, errors: [...errors] }
}

for (const c of CASES) {
  for (const route of c.routes) {
    const r = await renderCase(c.email, '#' + route)
    const missing = (MARKERS[route] || []).filter((m) => !r.text.includes(m))
    const ok = missing.length === 0 && r.errors.length === 0
    const label = `${c.email.split('@')[0]} → ${route}`
    if (ok) { pass++; results.push(`  ok   ${label}`) }
    else {
      fail++
      const why = [...missing.map((m) => `missing “${m}”`), ...r.errors.slice(0, 3).map((e) => `error: ${e.slice(0, 140)}`)]
      results.push(`  FAIL ${label}\n         ${why.join('\n         ')}`)
    }
  }
  if (c.forbidden) {
    const r = await renderCase(c.email, '#' + c.forbidden.path)
    const ok = r.hash === '#' + c.forbidden.to && r.errors.length === 0
    const label = `${c.email.split('@')[0]} → ${c.forbidden.path} (redirect)`
    if (ok) { pass++; results.push(`  ok   ${label}`) }
    else { fail++; results.push(`  FAIL ${label}\n         hash=${r.hash} errors=${r.errors.slice(0, 2).join(' | ')}`) }
  }
}

console.log('\n' + results.join('\n'))
console.log(`\n${pass} passed, ${fail} failed`)
await vite.close()
process.exit(fail ? 1 : 0)
