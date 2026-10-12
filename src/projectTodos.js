export function berlinDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-')
}
export const projectTeamNames = value => [...new Set(String(value || '').split(/[,;/&+\s]+/).filter(Boolean))]
export const projectHasEmployee = (project, name) => [project.lead, ...projectTeamNames(project.mitarbeiter)].some(value => String(value || '').trim().toLowerCase() === name.toLowerCase())
export function compareProjectUrgency(a, b) {
  // Actual due date wins over creation date; undated work remains below scheduled work.
  const date = (a.termin || '9999-12-31').localeCompare(b.termin || '9999-12-31')
  if (date) return date
  const time = (a.uhrzeit || '23:59:59').localeCompare(b.uhrzeit || '23:59:59')
  if (time) return time
  const priority = { Hoch: 0, Mittel: 1, Niedrig: 2 }
  return (priority[a.prioritaet] ?? 1) - (priority[b.prioritaet] ?? 1) || (Date.parse(a.created_at) || 0) - (Date.parse(b.created_at) || 0) || Number(a.id) - Number(b.id)
}

export function projectTodoList(items, { filter = 'open', team = 'ALLE', search = '', today = berlinDay() } = {}) {
  const sunday = new Date(`${today}T12:00:00Z`)
  sunday.setUTCDate(sunday.getUTCDate() + (7 - sunday.getUTCDay()) % 7)
  const weekEnd = sunday.toISOString().slice(0, 10)
  return items.filter(item => {
    const done = item.status === 'ERLEDIGT'
    if (filter === 'done' ? !done : done) return false
    // No status whitelist: older IN_ARBEIT entries and undated projects must remain visible.
    if (team !== 'ALLE' && !projectHasEmployee(item, team)) return false
    if (search && ![item.projekt, item.kunde, item.ort, item.adresse, item.lead, item.mitarbeiter, item.notiz].join(' ').toLowerCase().includes(search.trim().toLowerCase())) return false
    if (filter === 'today' && item.termin !== today) return false
    if (filter === 'week' && (!item.termin || item.termin < today || item.termin > weekEnd)) return false
    if (filter === 'overdue' && (!item.termin || item.termin >= today)) return false
    if (filter === 'undated' && item.termin) return false
    return true
  }).sort(compareProjectUrgency)
}

export async function appendProjectComment(client, id, text, author, now = new Date()) {
  const comment = text.trim()
  if (!comment || !author.trim()) throw new Error('Bitte Namen und Kommentar angeben.')
  if (comment.length > 2000) throw new Error('Ein Kommentar darf höchstens 2.000 Zeichen enthalten.')
  const stamp = now.toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short' })
  const entry = `[${stamp} · ${author.trim()}]\n${comment}`
  // Compare-and-swap preserves comments added by another device between read and write.
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await client.from('projects').select('id,notiz').eq('id', id).single()
    if (current.error) throw new Error(current.error.message)
    const previous = current.data.notiz
    let update = client.from('projects').update({ notiz: previous?.trim() ? `${previous}\n\n${entry}` : entry }).eq('id', id)
    update = previous === null ? update.is('notiz', null) : update.eq('notiz', previous)
    const result = await update.select('*').maybeSingle()
    if (result.error) throw new Error(result.error.message)
    if (result.data) return result.data
  }
  throw new Error('Das Projekt wurde gleichzeitig geändert. Dein Kommentar ist noch im Eingabefeld – bitte erneut speichern.')
}

export async function completeProject(client, project, nextStatus = 'ERLEDIGT') {
  let update = client.from('projects').update({ status: nextStatus }).eq('id', project.id)
  update = project.status === null ? update.is('status', null) : update.eq('status', project.status)
  const result = await update.select('*').maybeSingle()
  if (result.error) throw new Error(result.error.message)
  if (!result.data) throw new Error('Der Projektstatus wurde inzwischen geändert. Bitte die Liste aktualisieren.')
  return result.data
}
