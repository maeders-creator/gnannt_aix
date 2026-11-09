// Credential-free OCI foundation. No network calls and no ordering API.
export const WUERTH_OCI_ENDPOINT = 'https://eshop.wuerth.de/is-bin/INTERSHOP.enfinity/WFS/1401-B1-Site/de_DE/-/EUR/OCICatalogService-Inbound'
export const MAX_BODY_BYTES = 262144
const MAX_ITEMS = 200
const LIMITS = { DESCRIPTION: 40, MATNR: 40, VENDORMAT: 40, QUANTITY: 15, UNIT: 3, PRICE: 15, CURRENCY: 5, PRICEUNIT: 5 }
export class OciError extends Error {
  constructor(code) { super(code); this.name = 'OciError'; this.code = code }
}
const fail = code => { throw new OciError(code) }
const clean = (value, max) => {
  if (typeof value !== 'string' || value.length > max || /[\x00-\x1f\x7f]/.test(value)) fail('INVALID_FIELD')
  return value.trim()
}
const decimal = (value, positive = false) => {
  if (!/^\d{1,11}(?:\.\d{1,3})?$/.test(value) || (positive && !/[1-9]/.test(value))) fail('INVALID_NUMBER')
  return value
}

// Intentionally limited to simple merchandise lines. Keep decimal values as
// strings; never mistake price per 100 units for the price of one unit.
// Browser return data is untrusted and is never proof of supplier acceptance.
export function parseOciCart(body) {
  if (typeof body !== 'string' || new TextEncoder().encode(body).length > MAX_BODY_BYTES) fail('BODY_TOO_LARGE')
  if (/%(?![0-9a-f]{2})/i.test(body)) fail('INVALID_ENCODING')
  const form = new URLSearchParams(body)
  const rows = new Map()
  const seen = new Set()
  let fieldCount = 0
  for (const [key, value] of form) {
    if (++fieldCount > 8000 || key.length > 100 || value.length > 16384 || /\ufffd/.test(key + value)) fail('INVALID_FIELD')
    if (seen.has(key)) fail('DUPLICATE_FIELD')
    seen.add(key)
    const match = /^NEW_ITEM-([A-Z0-9_]+)\[([1-9]\d*)\]$/.exec(key)
    if (!match) {
      // These are never needed in a cart return. Do not retain leaked secrets.
      if (/PASSWORD|TOKEN|SECRET|AUTHORIZATION/i.test(key)) fail('UNEXPECTED_CREDENTIAL')
      if (key.startsWith('NEW_ITEM-')) fail('UNSUPPORTED_FIELD')
      continue
    }
    const [, field, rawIndex] = match
    const index = Number(rawIndex)
    if (!Number.isSafeInteger(index) || index > MAX_ITEMS) fail('TOO_MANY_ITEMS')
    if (['ITEM_TYPE', 'PARENT_ID', 'SERVICE'].includes(field) && value.trim()) fail('UNSUPPORTED_ITEM_TYPE')
    if (!(field in LIMITS)) continue // Do not import URLs, HTML, attachments or extension fields.
    if (!rows.has(index)) rows.set(index, Object.create(null))
    rows.get(index)[field] = clean(value, LIMITS[field])
  }
  if (!rows.size) fail('EMPTY_CART')
  const items = [...rows.entries()].sort((a,b) => a[0]-b[0]).map(([index, r], offset) => {
    if (index !== offset + 1) fail('NONCONTIGUOUS_ITEMS')
    if (!r.DESCRIPTION && !r.MATNR) fail('MISSING_DESCRIPTION')
    if (!r.UNIT || !/^[A-Za-z0-9]{1,3}$/.test(r.UNIT)) fail('INVALID_UNIT')
    const quantity = decimal(r.QUANTITY || '', true)
    const price = r.PRICE ? decimal(r.PRICE) : null
    const currency = r.CURRENCY || null
    if (price !== null && (!currency || !/^[A-Z]{3}$/.test(currency))) fail('INVALID_CURRENCY')
    if (currency !== null && !/^[A-Z]{3}$/.test(currency)) fail('INVALID_CURRENCY')
    const priceUnit = r.PRICEUNIT || '1'
    if (!/^[1-9]\d{0,4}$/.test(priceUnit)) fail('INVALID_PRICE_UNIT')
    return { index, description: r.DESCRIPTION || r.MATNR, supplierArticle: r.VENDORMAT || null,
      materialNumber: r.MATNR || null, quantity, unit: r.UNIT, price, priceUnit, currency }
  })
  return { supplier: 'wuerth-de', status: 'catalog_preview', priceSource: 'unverified_browser_return',
    ordered: false, items }
}

function httpsUrl(value) {
  let url
  try { url = new URL(value) } catch { fail('INVALID_URL') }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) fail('INVALID_URL')
  return url
}

// Construct a POST descriptor only. Caller must render escaped hidden inputs
// in a protected no-store page. Never put these fields in URLs or analytics.
export function buildCatalogLaunch({ configuration, credentials, callbackUrl }) {
  if (configuration?.enabled !== true || configuration?.catalogOnlyConfirmed !== true || configuration?.credentialUseApproved !== true) fail('LIVE_SETUP_REQUIRED')
  if (configuration.endpoint !== WUERTH_OCI_ENDPOINT) fail('UNAPPROVED_ENDPOINT')
  const callback = httpsUrl(callbackUrl)
  const base = httpsUrl(configuration.callbackBase)
  const prefix = base.pathname.replace(/\/$/, '') + '/'
  if (callback.origin !== base.origin || !callback.pathname.startsWith(prefix) || !/^[A-Za-z0-9_-]{43}$/.test(callback.pathname.slice(prefix.length))) fail('INVALID_CALLBACK')
  const organization = clean(credentials?.organization, 80)
  const name = clean(credentials?.name, 80)
  // Password whitespace may be significant: validate but do not normalize.
  const password = credentials?.password
  if (!organization || !name || typeof password !== 'string' || !password || password.length > 1024 || /[\x00-\x1f\x7f]/.test(password)) fail('MISSING_CREDENTIALS')
  return { method: 'POST', action: WUERTH_OCI_ENDPOINT,
    fields: { ORGANIZATION: organization, NAME: name, PASSWORD: password, HOOK_URL: callback.href },
    headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } }
}

export async function hashState(state, cryptoApi = globalThis.crypto) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(state || '')) fail('INVALID_SESSION')
  return [...new Uint8Array(await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(state)))].map(x => x.toString(16).padStart(2, '0')).join('')
}

// Framework-neutral callback logic. Production adapter MUST bound the request
// stream before decoding, authenticate launch/result routes, and implement
// commitReturn atomically with expiry and pending-status checks in the database.
export async function receiveCatalogReturn({ method, contentType, state, body, store, now = Date.now(), cryptoApi }) {
  if (method !== 'POST') fail('METHOD_NOT_ALLOWED')
  if (!/^application\/x-www-form-urlencoded(?:\s*;\s*charset\s*=\s*(?:UTF-8|"UTF-8"))?\s*$/i.test(contentType || '')) fail('UNSUPPORTED_CONTENT_TYPE')
  const stateHash = await hashState(state, cryptoApi)
  const cart = parseOciCart(body)
  // A boolean true means one pending, nonexpired row was updated transactionally.
  // State hash is the only callback selector; caller cannot supply owner/project.
  if (await store.commitReturn({ stateHash, cart, now }) !== true) fail('SESSION_EXPIRED_OR_USED')
  return { accepted: true, ordered: false, status: 'catalog_preview' }
}
