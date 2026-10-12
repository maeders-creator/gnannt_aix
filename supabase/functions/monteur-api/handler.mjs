const STAFF = ['Jonathan', 'Ruben', 'Gerold', 'Samuel', 'Edmund', 'Waldemar']
const STATUSES = ['AUFMASS', 'KONSTRUKTION', 'PRODUKTION', 'MONTAGE', 'IN_ARBEIT', 'ERLEDIGT']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
class ApiError extends Error { constructor(message, status = 400) { super(message); this.status = status } }
const text = (value, max = 300) => {
  if (value == null) return ''
  if (typeof value !== 'string' || value.trim().length > max) throw new ApiError(`Bitte Eingabe prüfen (maximal ${max} Zeichen).`)
  return value.trim()
}
export function newProjectPayload(input, actor) {
  if (!UUID.test(input.requestId || '')) throw new ApiError('Ungültige Auftragskennung. Bitte neu öffnen.')
  const projekt = text(input.projekt)
  const kunde = text(input.kunde)
  const adresse = text(input.adresse, 500)
  const ort = text(input.ort)
  if (!projekt || !kunde || (!ort && !adresse)) throw new ApiError('Bitte Auftrag, Kunde und Einsatzort eintragen.')
  const lead = text(input.lead) || actor.name
  if (!STAFF.includes(lead)) throw new ApiError('Bitte einen Verantwortlichen auswählen.')
  const termin = text(input.termin, 10) || null
  if (termin && (!/^\d{4}-\d{2}-\d{2}$/.test(termin) || !Number.isFinite(Date.parse(`${termin}T12:00:00Z`)) || new Date(`${termin}T12:00:00Z`).toISOString().slice(0, 10) !== termin)) throw new ApiError('Bitte ein gültiges Datum wählen.')
  const uhrzeit = text(input.uhrzeit, 5) || null
  if (uhrzeit && (!termin || !/^([01]\d|2[0-3]):[0-5]\d$/.test(uhrzeit))) throw new ApiError('Bitte Datum und gültige Uhrzeit wählen.')
  const team = Array.isArray(input.team) ? input.team : []
  if (team.some(name => !STAFF.includes(name))) throw new ApiError('Bitte Team prüfen.')
  const prioritaet = text(input.prioritaet) || 'Mittel'
  if (!['Niedrig', 'Mittel', 'Hoch'].includes(prioritaet)) throw new ApiError('Bitte Priorität prüfen.')
  return { projekt, kunde, adresse, ort, telefon: text(input.telefon, 80), lead, mitarbeiter: [...new Set(team)].join(', '), termin, uhrzeit, prioritaet,
    notiz: text(input.notiz, 4000), status: 'AUFMASS', push_enabled: false,
    created_by: actor.id, created_by_name: actor.name, client_request_id: input.requestId }
}
const EDIT_FIELDS = { projekt: 300, kunde: 300, ort: 300, adresse: 500, telefon: 80, email_kunde: 320, lead: 300, mitarbeiter: 500, prioritaet: 20, termin: 10, uhrzeit: 8 }
export function editProjectPayload(input, current, actor) {
  if (!Number.isSafeInteger(input.version) || input.version < 0) throw new ApiError('Bitte den Auftrag neu öffnen.')
  if (!input.changes || typeof input.changes !== 'object' || Array.isArray(input.changes)) throw new ApiError('Bitte Änderungen prüfen.')
  const patch = {}
  for (const [key, value] of Object.entries(input.changes)) {
    if (!Object.hasOwn(EDIT_FIELDS, key)) throw new ApiError('Dieses Feld kann hier nicht geändert werden.')
    patch[key] = text(value, EDIT_FIELDS[key])
    if (['termin', 'uhrzeit'].includes(key)) patch[key] ||= null
  }
  if (!Object.keys(patch).length) throw new ApiError('Es wurden keine Daten geändert.')
  for (const key of ['projekt', 'kunde']) if (key in patch && !patch[key]) throw new ApiError('Auftrag und Kunde dürfen nicht leer sein.')
  const merged = { ...current, ...patch }
  if (('ort' in patch || 'adresse' in patch) && !merged.ort && !merged.adresse) throw new ApiError('Bitte einen Einsatzort eintragen.')
  if ('lead' in patch && patch.lead && !STAFF.includes(patch.lead)) throw new ApiError('Bitte Verantwortlichen prüfen.')
  if ('mitarbeiter' in patch) {
    const team = patch.mitarbeiter.split(',').map(x => x.trim()).filter(Boolean)
    if (team.some(x => !STAFF.includes(x))) throw new ApiError('Bitte Team prüfen.')
    patch.mitarbeiter = [...new Set(team)].join(', ')
  }
  if ('prioritaet' in patch && !['Niedrig', 'Mittel', 'Hoch'].includes(patch.prioritaet)) throw new ApiError('Bitte Priorität prüfen.')
  if ('email_kunde' in patch && patch.email_kunde && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email_kunde)) throw new ApiError('Bitte E-Mail-Adresse prüfen.')
  if ('termin' in patch || 'uhrzeit' in patch) {
    const { termin, uhrzeit } = merged
    if (termin && (!/^\d{4}-\d{2}-\d{2}$/.test(termin) || !Number.isFinite(Date.parse(`${termin}T12:00:00Z`)) || new Date(`${termin}T12:00:00Z`).toISOString().slice(0, 10) !== termin)) throw new ApiError('Bitte ein gültiges Datum wählen.')
    if (uhrzeit && (!termin || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(uhrzeit))) throw new ApiError('Bitte Datum und gültige Uhrzeit wählen.')
  }
  return { ...patch, details_updated_by: actor.name }
}
export function createHandler(db) {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, apikey, x-monteur-token', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers })
  return async req => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (req.method !== 'POST') return reply({ error: 'Diese Aktion ist nicht verfügbar.' }, 405)
    try {
      const token = req.headers.get('x-monteur-token') || ''
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ApiError('Bitte deinen persönlichen Zugangslink öffnen.', 401)
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
      const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
      const account = await db.from('monteur_access').select('id,name').eq('token_hash', hash).eq('active', true).maybeSingle()
      if (account.error) throw new Error('access lookup')
      if (!account.data) throw new ApiError('Dieser Zugang ist nicht gültig oder wurde deaktiviert. Bitte Samuel kontaktieren.', 401)
      const actor = account.data
      if (Number(req.headers.get('content-length') || 0) > 20000) throw new ApiError('Die Eingabe ist zu groß.', 413)
      const raw = await req.text()
      if (raw.length > 20000) throw new ApiError('Die Eingabe ist zu groß.', 413)
      let input
      try { input = JSON.parse(raw) } catch { throw new ApiError('Die Eingabe konnte nicht gelesen werden.') }
      if (!input || typeof input !== 'object') throw new ApiError('Bitte Eingabe prüfen.')
      if (input.action === 'list') {
        const result = await db.from('projects').select('*').order('created_at', { ascending: false }).limit(1000)
        if (result.error) throw new Error('list')
        return reply({ actor, projects: result.data })
      }
      if (input.action === 'hub') {
        const result = await db.from('knowledge_docs').select('id,title,category,type,file_name,url,created_at').order('created_at', { ascending: false }).limit(1000)
        if (result.error) throw new Error('hub')
        return reply({ documents: result.data })
      }
      if (input.action === 'create') {
        const payload = newProjectPayload(input, actor)
        const result = await db.from('projects').insert(payload).select('*').single()
        if (result.error?.code === '23505') {
          const existing = await db.from('projects').select('*').eq('created_by', actor.id).eq('client_request_id', payload.client_request_id).single()
          if (existing.error) throw new Error('duplicate lookup')
          return reply({ project: existing.data })
        }
        if (result.error) throw new Error('create')
        return reply({ project: result.data }, 201)
      }
      if (!Number.isSafeInteger(input.id) || input.id <= 0) throw new ApiError('Bitte einen gültigen Auftrag öffnen.')
      if (input.action === 'update') {
        const current = await db.from('projects').select('*').eq('id', input.id).maybeSingle()
        if (current.error) throw new Error('read details')
        if (!current.data) throw new ApiError('Auftrag nicht gefunden.', 404)
        const payload = editProjectPayload(input, current.data, actor)
        const result = await db.from('projects').update(payload).eq('id', input.id).eq('details_version', input.version).select('*').maybeSingle()
        if (result.error) throw new Error('update details')
        if (!result.data) throw new ApiError('Die Auftragsdaten wurden inzwischen geändert. Deine Eingabe bleibt erhalten. Bitte aktuelle Daten laden und erneut prüfen.', 409)
        return reply({ project: result.data })
      }
      if (input.action === 'comment') {
        const comment = text(input.comment, 2000)
        if (!comment) throw new ApiError('Bitte Kommentar eintragen.')
        const result = await db.rpc('monteur_append_comment', { p_project_id: input.id, p_actor_id: actor.id, p_comment: comment }).maybeSingle()
        if (result.error) throw new Error('comment')
        if (!result.data) throw new ApiError('Auftrag nicht gefunden.', 404)
        return reply({ project: result.data })
      }
      if (['complete', 'undo', 'reopen'].includes(input.action)) {
        const previous = input.action === 'complete' ? input.previousStatus : 'ERLEDIGT'
        let next = 'ERLEDIGT'
        if (input.action !== 'complete') {
          const current = await db.from('projects').select('status_before_done').eq('id', input.id).maybeSingle()
          if (current.error) throw new Error('read status')
          if (!current.data) throw new ApiError('Auftrag nicht gefunden.', 404)
          next = current.data.status_before_done || 'AUFMASS'
        }
        if ((previous !== null && !STATUSES.includes(previous)) || !STATUSES.includes(next)) throw new ApiError('Bitte Projektstatus prüfen.')
        let update = db.from('projects').update({ status: next }).eq('id', input.id)
        update = previous === null ? update.is('status', null) : update.eq('status', previous)
        const result = await update.select('*').maybeSingle()
        if (result.error) throw new Error('status')
        if (!result.data) throw new ApiError('Der Status hat sich geändert. Bitte die Liste aktualisieren.', 409)
        return reply({ project: result.data })
      }
      throw new ApiError('Diese Aktion ist nicht verfügbar.')
    } catch (error) {
      return reply({ error: error instanceof ApiError ? error.message : 'Speichern oder Laden fehlgeschlagen. Bitte erneut versuchen.' }, error instanceof ApiError ? error.status : 500)
    }
  }
}
