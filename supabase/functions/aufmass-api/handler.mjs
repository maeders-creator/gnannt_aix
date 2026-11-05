const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_BODY = 6 * 1024 * 1024
export class ApiError extends Error { constructor(message, status = 400) { super(message); this.status = status } }
const fail = (message = 'Bitte Aufmaß-Eingaben prüfen.') => { throw new ApiError(message) }
const object = value => value && typeof value === 'object' && !Array.isArray(value)
const text = (value, max = 1000) => { if (value == null) return ''; if (typeof value !== 'string' || value.length > max) fail(); return value.trim() }
const numericKeys = ['breite','hoehe','rahmenSeitlich','rahmenOben','rahmenUnten','nutmass','leibungAussenBreite','leibungAussenHoehe','leibungInnenBreite','leibungInnenHoehe','schraegmass','versatz']
const textKeys = ['bezeichnung','rollladenLeisten','fensterbankInnen','fensterbankAussen','glasart','randverbundFarbe','zusatztext']
function numeric(value, key) {
  if (value == null || value === '') return ''
  if (!['string','number'].includes(typeof value)) fail()
  const source = String(value).trim().replace(',', '.')
  if (!/^-?\d+(\.\d{1,3})?$/.test(source)) fail('Maße bitte als Zahl mit höchstens drei Nachkommastellen eingeben.')
  const number = Number(source)
  if (!Number.isFinite(number) || Math.abs(number) > 100000 || (key !== 'versatz' && number < 0) || (['breite','hoehe'].includes(key) && number === 0)) fail('Bitte Maße prüfen: Breite und Höhe müssen positiv sein.')
  return source
}
function photo(input) {
  if (!object(input) || !UUID.test(input.id || '') || typeof input.dataUrl !== 'string' || input.dataUrl.length > 700000) fail('Foto ist ungültig oder zu groß.')
  const match = input.dataUrl.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/)
  if (!match || match[2].length % 4 !== 0) fail('Nur JPEG-, PNG- oder WebP-Fotos sind erlaubt.')
  let binary
  try { binary = atob(match[2].slice(0, 32)) } catch { fail('Foto konnte nicht gelesen werden.') }
  const valid = match[1] === 'jpeg' ? binary.startsWith('\xff\xd8\xff') : match[1] === 'png' ? binary.startsWith('\x89PNG\r\n\x1a\n') : binary.startsWith('RIFF') && binary.slice(8, 12) === 'WEBP'
  if (!valid) fail('Fotoformat stimmt nicht mit der Datei überein.')
  return { id: input.id, name: text(input.name, 200), dataUrl: input.dataUrl }
}
export function validatePayload(input) {
  if (!object(input) || !object(input.header) || !Array.isArray(input.positions) || input.positions.length < 1 || input.positions.length > 50) fail('Bitte 1 bis 50 Positionen pro Aufmaß anlegen.')
  const header = { kunde: text(input.header.kunde, 300), ausfuehrung: text(input.header.ausfuehrung, 30), farbe: text(input.header.farbe, 300), glasBemerkungen: text(input.header.glasBemerkungen, 4000) }
  if (!header.kunde) fail('Bitte Kunde eintragen.')
  if (!['Holz', 'Kunststoff'].includes(header.ausfuehrung)) fail('Bitte Holz oder Kunststoff auswählen.')
  const ids = new Set()
  const positions = input.positions.map(p => {
    if (!object(p) || !UUID.test(p.id || '') || ids.has(p.id)) fail('Positionskennungen müssen eindeutig sein.')
    ids.add(p.id)
    if (typeof p.rollladen !== 'boolean') fail('Bitte Rollladen ja/nein wählen.')
    const position = { id: p.id, rollladen: p.rollladen }
    for (const key of textKeys) position[key] = text(p[key], key === 'zusatztext' ? 4000 : 1000)
    for (const key of numericKeys) position[key] = numeric(p[key], key)
    position.stueckzahl = p.stueckzahl == null || p.stueckzahl === '' ? '' : Number(p.stueckzahl)
    if (position.stueckzahl === '' || (!['number','string'].includes(typeof p.stueckzahl) || !Number.isSafeInteger(position.stueckzahl) || position.stueckzahl < 1 || position.stueckzahl > 10000)) fail('Stückzahl muss eine positive ganze Zahl sein.')
    const sketch = p.sketch ?? []
    let points = 0
    if (!Array.isArray(sketch) || sketch.length > 500) fail('Skizze ist zu groß.')
    position.sketch = sketch.map(stroke => {
      if (!Array.isArray(stroke) || (points += stroke.length) > 20000) fail('Skizze ist zu groß.')
      return stroke.map(point => {
        if (!object(point) || ![point.x, point.y].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1)) fail('Skizzenkoordinaten sind ungültig.')
        return { x: point.x, y: point.y }
      })
    })
    if (!Array.isArray(p.photos ?? []) || (p.photos ?? []).length > 3) fail('Maximal drei Fotos pro Position.')
    position.photos = (p.photos ?? []).map(photo)
    if (new Set(position.photos.map(p => p.id)).size !== position.photos.length) fail('Fotokennungen müssen eindeutig sein.')
    return position
  })
  return { header, positions }
}
const sha256 = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('')
export function createAuthenticator(db, fetcher = fetch) {
  return async req => {
    const token = req.headers.get('x-monteur-token') || ''
    const session = req.headers.get('x-planer-session') || ''
    if (token && session) throw new ApiError('Bitte nur einen Zugang verwenden.', 401)
    if (token) {
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ApiError('Persönlicher Zugang ungültig.', 401)
      const result = await db.from('monteur_access').select('id,name').eq('token_hash', await sha256(token)).eq('active', true).maybeSingle()
      if (result.error) throw new Error('access lookup')
      if (!result.data) throw new ApiError('Persönlicher Zugang ungültig oder deaktiviert.', 401)
      return { id: `monteur:${result.data.id}`, name: result.data.name }
    }
    if (!session || session.length > 4096) throw new ApiError('Bitte im Portal anmelden.', 401)
    // Existing trusted service verifies the planner signature and expiry before planner-projects.
    // The impossible positive project ID avoids retrieving any customer records for this check.
    const response = await fetcher('https://xhpwmebwvjpdhsjeyrug.supabase.co/functions/v1/gnannt-calculator', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-planer-session': session },
      body: JSON.stringify({ action: 'planner-projects', op: 'select', selection: 'id,notiz', filters: [{ method: 'eq', column: 'id', value: -1 }] }),
      signal: AbortSignal.timeout(10000), redirect: 'error'
    })
    let result
    try { result = await response.json() } catch { throw new ApiError('Planer-Zugang konnte nicht geprüft werden.', 503) }
    if (!response.ok || result.error || !Array.isArray(result.data)) throw new ApiError('Planer-Zugang ungültig oder abgelaufen.', 401)
    return { id: 'planner', name: 'Planer' }
  }
}
const sheet = row => ({ id: row.id, projectId: row.project_id, version: row.version, payload: row.payload || { header: row.header, positions: [] }, updatedAt: row.updated_at, updatedBy: row.updated_by_name, positionCount: row.position_count })
export function createHandler(db, options = {}) {
  const authenticate = options.authenticate || createAuthenticator(db, options.fetcher)
  const allowedOrigins = options.allowedOrigins || []
  return async req => {
    const origin = req.headers.get('origin') || ''
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin', 'Access-Control-Allow-Headers': 'content-type, apikey, x-monteur-token, x-planer-session', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
    if (allowedOrigins.includes(origin)) headers['Access-Control-Allow-Origin'] = origin
    const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers })
    if (origin && !allowedOrigins.includes(origin)) return reply({ error: 'Diese Portal-Adresse ist nicht freigegeben.' }, 403)
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (req.method !== 'POST') return reply({ error: 'Aktion nicht verfügbar.' }, 405)
    try {
      const actor = await authenticate(req)
      if (Number(req.headers.get('content-length') || 0) > MAX_BODY) throw new ApiError('Aufmaß ist zu groß. Bitte weniger oder kleinere Fotos verwenden.', 413)
      // Read incrementally to enforce the limit even without Content-Length.
      const reader = req.body?.getReader(); const chunks = []; let length = 0
      if (!reader) fail()
      for (;;) { const { value, done } = await reader.read(); if (done) break; length += value.byteLength; if (length > MAX_BODY) { await reader.cancel(); throw new ApiError('Aufmaß ist zu groß. Bitte weniger oder kleinere Fotos verwenden.', 413) }; chunks.push(value) }
      const bytes = new Uint8Array(length); let offset = 0; for (const c of chunks) { bytes.set(c, offset); offset += c.byteLength }
      let input
      try { input = JSON.parse(new TextDecoder().decode(bytes)) } catch { fail('Eingabe konnte nicht gelesen werden.') }
      if (!object(input)) fail()
      if (input.action === 'list') {
        let query = db.from('aufmass_sheets').select('id,project_id,version,header:payload->header,position_count,updated_at,updated_by_name')
        if (input.projectId != null) { if (!Number.isSafeInteger(input.projectId) || input.projectId < 1) fail(); query = query.eq('project_id', input.projectId) }
        const result = await query.order('updated_at', { ascending: false }).limit(1000)
        if (result.error) throw new Error('list')
        return reply({ data: result.data.map(sheet) })
      }
      if (!UUID.test(input.id || '')) fail('Ungültige Aufmaß-Kennung.')
      if (!['get','save'].includes(input.action)) fail('Aktion nicht verfügbar.')
      const existing = await db.from('aufmass_sheets').select('*').eq('id', input.id).maybeSingle()
      if (existing.error) throw new Error('read')
      if (input.action === 'get') {
        if (!existing.data) throw new ApiError('Aufmaß nicht gefunden.', 404)
        return reply({ data: sheet(existing.data) })
      }
      if (!Number.isSafeInteger(input.projectId) || input.projectId < 1 || !Number.isSafeInteger(input.version) || input.version < 0 || !UUID.test(input.requestId || '')) fail('Bitte Auftrag und Aufmaß-Version prüfen.')
      const payload = validatePayload(input.payload)
      const hash = await sha256(JSON.stringify({ projectId: input.projectId, payload }))
      if (existing.data?.last_request_id === input.requestId) {
        if (existing.data.payload_hash !== hash || existing.data.updated_by !== actor.id) throw new ApiError('Diese Speicherkennung wurde bereits verwendet. Bitte erneut speichern.', 409)
        return reply({ data: sheet(existing.data) })
      }
      if (existing.data && (existing.data.version !== input.version || existing.data.project_id !== input.projectId)) throw new ApiError('Aufmaß wurde inzwischen geändert. Bitte aktuelle Version laden; deine Eingabe bleibt erhalten.', 409)
      if (!existing.data && input.version !== 0) throw new ApiError('Aufmaß nicht gefunden. Bitte neu laden.', 409)
      const project = await db.from('projects').select('id').eq('id', input.projectId).maybeSingle()
      if (project.error) throw new Error('project lookup')
      if (!project.data) throw new ApiError('Auftrag nicht gefunden. Bitte zuerst Auftrag speichern.', 404)
      const row = { project_id: input.projectId, payload, position_count: payload.positions.length, version: input.version + 1, last_request_id: input.requestId, payload_hash: hash, updated_by: actor.id, updated_by_name: actor.name, updated_at: new Date().toISOString() }
      const result = existing.data
        ? await db.from('aufmass_sheets').update(row).eq('id', input.id).eq('version', input.version).select('*').maybeSingle()
        : await db.from('aufmass_sheets').insert({ ...row, id: input.id, created_by: actor.id }).select('*').single()
      if (result.error?.code === '23505' || (!result.error && !result.data)) {
        const latest = await db.from('aufmass_sheets').select('*').eq('id', input.id).maybeSingle()
        if (!latest.error && latest.data?.last_request_id === input.requestId && latest.data.payload_hash === hash && latest.data.updated_by === actor.id) return reply({ data: sheet(latest.data) })
        throw new ApiError('Aufmaß wurde parallel gespeichert. Bitte aktuelle Version laden.', 409)
      }
      if (result.error) throw new Error('save')
      return reply({ data: sheet(result.data) }, existing.data ? 200 : 201)
    } catch (error) {
      return reply({ error: error instanceof ApiError ? error.message : 'Aufmaß konnte nicht geladen oder gespeichert werden. Bitte erneut versuchen.' }, error instanceof ApiError ? error.status : 500)
    }
  }
}
