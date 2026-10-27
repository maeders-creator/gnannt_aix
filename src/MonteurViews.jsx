import {hubEntryCategories,groupedHubDocuments} from './hubCategories.mjs'
import { useEffect, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Pencil } from 'lucide-react'
import { berlinDay, compareProjectUrgency, projectHasEmployee, projectTeamNames } from './projectTodos'

export const EMPLOYEES = ['Jonathan', 'Ruben', 'Gerold', 'Samuel', 'Edmund', 'Waldemar']
const STATUSES = { AUFMASS: 'Aufmaß', KONSTRUKTION: 'Konstruktion', PRODUKTION: 'Produktion', MONTAGE: 'Montage', IN_ARBEIT: 'In Arbeit', ERLEDIGT: 'Erledigt' }
const dayLabel = day => day ? new Date(`${day}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Termin offen'
const fields = ['projekt', 'kunde', 'ort', 'adresse', 'telefon', 'email_kunde', 'lead', 'mitarbeiter', 'prioritaet', 'termin', 'uhrzeit']
const values = project => Object.fromEntries(fields.map(key => [key, key === 'uhrzeit' ? (project[key] || '').slice(0, 5) : project[key] || '']))
const safeUrl = url => { try { const parsed = new URL(url); return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : null } catch { return null } }

function ProjectEditor({ project, api, online, onSaved, onRefreshed, onCancel }) {
  // Freeze the version the user started editing; background refreshes must not silently rebase edits.
  const [original, setOriginal] = useState(project)
  const [form, setForm] = useState(() => values(project))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState(false)
  const teamOptions = [...new Set([...EMPLOYEES, ...projectTeamNames(original.mitarbeiter)])]
  const formerTeam = projectTeamNames(form.mitarbeiter).filter(name => !EMPLOYEES.includes(name))
  const invalidTeam = form.mitarbeiter !== (original.mitarbeiter || '') && formerTeam.length > 0
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const changes = Object.fromEntries(fields.filter(key => form[key] !== values(original)[key]).map(key => [key, form[key]]))
  const submit = async e => {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError(''); setConflict(false)
    try { const result = await api('update', { id: project.id, version: original.details_version, changes }); onSaved(result.project) }
    catch (e) { setError(e.message); setConflict(e.status === 409) }
    finally { setBusy(false) }
  }
  const reload = async () => {
    setBusy(true)
    try {
      const result = await api('list')
      const latest = result.projects.find(item => item.id === project.id)
      if (!latest) throw new Error('Auftrag nicht mehr gefunden.')
      setOriginal(latest); setForm(values(latest)); onRefreshed(latest); setConflict(false); setError('')
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  return <form onSubmit={submit} className="monteur-editor"><h2>Auftragsdaten bearbeiten</h2><p className="monteur-subtitle">Korrigiere die gewünschten Angaben und speichere sie für das ganze Team.</p><fieldset disabled={busy} className="monteur-edit-fieldset"><div className="monteur-fields">
    {[['projekt', 'Auftrag *', 300], ['kunde', 'Kunde *', 300], ['ort', 'Ort', 300], ['adresse', 'Straße und Hausnummer', 500], ['telefon', 'Telefonnummer', 80], ['email_kunde', 'E-Mail', 320]].map(([key, label, max]) => <label key={key}>{label}<input type={key === 'telefon' ? 'tel' : key === 'email_kunde' ? 'email' : 'text'} required={['projekt', 'kunde'].includes(key)} maxLength={max} value={form[key]} onChange={e => set(key, e.target.value)}/></label>)}
    <div className="monteur-field-pair"><label>Termin<input type="date" value={form.termin} onChange={e => setForm(current => ({ ...current, termin: e.target.value, uhrzeit: e.target.value ? current.uhrzeit : '' }))}/></label><label>Uhrzeit<input type="time" value={form.uhrzeit} disabled={!form.termin} onChange={e => set('uhrzeit', e.target.value)}/></label></div>
    <label>Verantwortlich<select value={form.lead} onChange={e => set('lead', e.target.value)}><option value="">Noch offen</option>{!EMPLOYEES.includes(form.lead) && form.lead && <option>{form.lead}</option>}{EMPLOYEES.map(name => <option key={name}>{name}</option>)}</select></label>
    <fieldset><legend>Mitarbeiterteam</legend><p className="monteur-subtitle">Ausgewählte Kollegen sehen den Auftrag unter „Meine Jobs“.</p><div className="monteur-team-options">{teamOptions.map(name => { const team = projectTeamNames(form.mitarbeiter); return <label key={name}><input type="checkbox" checked={team.includes(name)} onChange={e => set('mitarbeiter', (e.target.checked ? [...team, name] : team.filter(x => x !== name)).join(', '))}/>{name}</label> })}</div></fieldset>
    <label>Priorität<select value={form.prioritaet} onChange={e => set('prioritaet', e.target.value)}>{!['Niedrig', 'Mittel', 'Hoch'].includes(form.prioritaet) && <option value={form.prioritaet}>Noch offen</option>}<option>Niedrig</option><option>Mittel</option><option>Hoch</option></select></label>
  </div></fieldset>
  {invalidTeam && <p className="monteur-error" role="alert">Bei einer neuen Teamzuordnung bitte frühere Teamnamen abwählen: {formerTeam.join(', ')}. Wähle die aktuellen Kollegen aus.</p>}
  {error && <p className="monteur-error" role="alert">{error}</p>}
  {conflict && <button type="button" className="monteur-secondary" disabled={busy || !online} onClick={reload}>Aktuelle Daten laden · eigene Eingaben verwerfen</button>}
  <div className="monteur-wizard-actions"><button type="button" className="monteur-secondary" disabled={busy} onClick={onCancel}>Abbrechen</button><button className="monteur-primary" disabled={busy || !online || invalidTeam || !Object.keys(changes).length}>{busy ? 'Speichert…' : 'Änderungen speichern'}</button></div>
  </form>
}

export function ProjectDetail({ project, api, online, onSaved, onClose }) {
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const attachment = safeUrl(project.attachment_url)
  useEffect(() => { window.scrollTo(0, 0) }, [])
  return <section className="monteur-detail" aria-label="Auftragsdetails">
    {editing ? <ProjectEditor project={project} api={api} online={online} onRefreshed={onSaved} onCancel={() => setEditing(false)} onSaved={updated => { onSaved(updated); setEditing(false); setSaved(true); window.scrollTo(0, 0) }}/> : <>
      <button className="monteur-back" onClick={onClose}><ArrowLeft size={18}/> Zur Übersicht</button>
      {saved && <p className="monteur-saved" role="status">Änderungen gespeichert.</p>}
      <h1>{project.projekt}</h1><p>{project.kunde}<br/>{[project.adresse, project.ort].filter(Boolean).join(', ')}</p>
      <div className="monteur-review"><dl><dt>Termin</dt><dd>{dayLabel(project.termin)}{project.uhrzeit && ` · ${project.uhrzeit.slice(0, 5)} Uhr`}</dd><dt>Telefon</dt><dd>{project.telefon ? <a href={`tel:${project.telefon.replace(/[^+\d]/g, '')}`}>{project.telefon}</a> : 'Noch nicht erfasst'}</dd><dt>E-Mail</dt><dd>{project.email_kunde ? <a href={`mailto:${project.email_kunde}`}>{project.email_kunde}</a> : 'Noch nicht erfasst'}</dd><dt>Verantwortlich</dt><dd>{project.lead || 'Noch offen'}</dd><dt>Team</dt><dd>{project.mitarbeiter || 'Noch offen'}</dd><dt>Status</dt><dd>{STATUSES[project.status] || project.status || 'Offen'}</dd><dt>Priorität</dt><dd>{project.prioritaet || 'Noch offen'}</dd><dt>Eingestellt von</dt><dd>{project.created_by_name || 'Bestand · nicht erfasst'}</dd></dl></div>
      <button className="monteur-primary monteur-edit-button" disabled={!online} onClick={() => { setSaved(false); setEditing(true) }}><Pencil size={18}/> Bearbeiten</button>
      {project.details_updated_at && <p className="monteur-subtitle">Daten geändert von {project.details_updated_by || 'Büro / Planer'} · {new Date(project.details_updated_at).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short' })}</p>}
      <h2>Notizen & Kommentare</h2><p className="monteur-note">{project.notiz || 'Noch keine Notizen.'}</p>{attachment && <a href={attachment} target="_blank" rel="noreferrer">Projekt-PDF öffnen</a>}
    </>}
  </section>
}

export function MonteurHub({ api }) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [category, setCategory] = useState('Alle')
  const [search, setSearch] = useState('')
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    api('hub').then(result => { if (active) setDocs(result.documents) }).catch(e => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [api, retry])
  const categories=hubEntryCategories(docs)
  const groups=groupedHubDocuments(docs,category==='Alle'?'ALLE':category,search)
  return <section className="monteur-panel"><h1>Hub</h1><p className="monteur-subtitle">Anleitungen, Unterweisungen, Dokumente und Videos für unterwegs.</p><div className="monteur-fields"><label>Hub durchsuchen<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Titel oder Dokument suchen"/></label><label>Bereich<select value={category} onChange={e => setCategory(e.target.value)}><option>Alle</option>{categories.map(name => <option key={name}>{name}</option>)}</select></label></div>
    {loading && <p role="status">Hub wird geladen…</p>}{error && <div className="monteur-error" role="alert">{error}<button className="monteur-secondary" onClick={() => setRetry(n => n + 1)}>Erneut laden</button></div>}
    {!loading && !error && <div className="monteur-doc-list">{groups.map(group=><section className="monteur-hub-group" key={group.title}><h2>{group.title.replace('Dokumente & Videos / ','')}</h2>{group.documents.map(doc => { const url = safeUrl(doc.url); return <article key={doc.id}><span>{doc.category || 'Dokumente'}</span><h2>{doc.title}</h2>{doc.file_name && <p>{doc.file_name}</p>}{url ? <a className="monteur-secondary" href={url} target="_blank" rel="noreferrer">Öffnen <ExternalLink size={16}/></a> : <p>Kein gültiger Link hinterlegt. Bitte im Büro ergänzen lassen.</p>}</article> })}</section>)}{!groups.length && <p>{docs.length ? 'Keine passenden Dokumente.' : 'Im Hub sind noch keine Dokumente hinterlegt.'}</p>}</div>}
  </section>
}

function ProjectLink({ project, onOpen }) {
  return <button className="monteur-project-link" onClick={() => onOpen(project)}><span><strong>{project.projekt}</strong><small>{[project.kunde, project.ort, project.lead].filter(Boolean).join(' · ')}</small><small>{project.termin ? `${dayLabel(project.termin)}${project.uhrzeit ? ` · ${project.uhrzeit.slice(0, 5)} Uhr` : ''}` : 'Termin offen'} · {STATUSES[project.status] || project.status || 'Offen'}</small></span><ChevronRight size={18}/></button>
}

export function MonteurDashboard({ items, actor, onOpen }) {
  const open = items.filter(p => p.status !== 'ERLEDIGT')
  const today = berlinDay()
  const mine = open.filter(p => projectHasEmployee(p, actor.name))
  const personal = EMPLOYEES.includes(actor.name)
  const [selection, setSelection] = useState(() => personal ? 'mine' : 'all')
  const groups = { mine, all: open, today: open.filter(p => p.termin === today), overdue: open.filter(p => p.termin && p.termin < today), undated: open.filter(p => !p.termin), done: items.filter(p => p.status === 'ERLEDIGT') }
  const cards = [...(personal ? [['mine', 'Meine offenen Aufträge']] : []), ['all', 'Alle offenen Aufträge'], ['today', 'Heute'], ['overdue', 'Überfällig'], ['undated', 'Ohne Termin'], ['done', 'Erledigt']]
  const shown = [...groups[selection]].sort(compareProjectUrgency)
  return <section className="monteur-panel"><h1>Dashboard</h1><p className="monteur-subtitle">Der aktuelle Stand für {actor.name} und das ganze Team.</p><div className="monteur-stat-grid">{cards.map(([key, label]) => <button key={key} aria-pressed={selection === key} onClick={() => setSelection(key)}><strong>{groups[key].length}</strong><span>{label}</span></button>)}</div><h2>Offene Aufträge nach Status</h2><div className="monteur-status-list">{Object.entries(STATUSES).filter(([key]) => key !== 'ERLEDIGT').map(([key, label]) => <span key={key}>{label}<strong>{open.filter(p => p.status === key).length}</strong></span>)}</div><h2>{cards.find(([key]) => key === selection)[1]}</h2><div className="monteur-agenda">{shown.map(project => <ProjectLink key={project.id} project={project} onOpen={onOpen}/>)}</div>{!shown.length && <p>Keine Aufträge in dieser Auswahl.</p>}</section>
}

export function MonteurCalendar({ items, onOpen }) {
  const today = berlinDay()
  const [month, setMonth] = useState(today.slice(0, 7))
  const [day, setDay] = useState('')
  const [all, setAll] = useState(false)
  const [team, setTeam] = useState('Alle')
  const [done, setDone] = useState(false)
  const relevant = items.filter(p => (done || p.status !== 'ERLEDIGT') && (team === 'Alle' || projectHasEmployee(p, team)))
  const dated = relevant.filter(p => p.termin).sort((a, b) => `${a.termin} ${a.uhrzeit || ''}`.localeCompare(`${b.termin} ${b.uhrzeit || ''}`))
  const shown = dated.filter(p => all || (day ? p.termin === day : p.termin.startsWith(month)))
  const undated = relevant.filter(p => !p.termin)
  const first = new Date(`${month}-01T12:00:00Z`)
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  const offset = (first.getUTCDay() + 6) % 7
  const shift = n => { const next = new Date(first); next.setUTCMonth(next.getUTCMonth() + n); setMonth(next.toISOString().slice(0, 7)); setDay(''); setAll(false) }
  return <section className="monteur-panel"><h1>Kalender</h1><p className="monteur-subtitle">Termine öffnen, prüfen und direkt im Auftrag bearbeiten.</p><div className="monteur-fields"><label>Team filtern<select value={team} onChange={e => setTeam(e.target.value)}><option>Alle</option>{EMPLOYEES.map(name => <option key={name}>{name}</option>)}</select></label></div>
    <div className="monteur-calendar-head"><button aria-label="Vorheriger Monat" onClick={() => shift(-1)}><ChevronLeft size={22}/></button><strong>{first.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</strong><button aria-label="Nächster Monat" onClick={() => shift(1)}><ChevronRight size={22}/></button></div>
    <div className="monteur-calendar-grid">{['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(label => <span key={label}>{label}</span>)}{Array.from({ length: offset }, (_, index) => <span key={`empty${index}`}/>)}{Array.from({ length: count }, (_, index) => { const date = `${month}-${String(index + 1).padStart(2, '0')}`; const appointments = dated.filter(p => p.termin === date).length; return <button key={date} className={date === today ? 'is-today' : ''} aria-pressed={day === date && !all} aria-label={`${dayLabel(date)}, ${appointments} Termine`} onClick={() => { setDay(day === date ? '' : date); setAll(false) }}>{index + 1}<small>{appointments || '\u00a0'}</small></button> })}</div>
    <div className="monteur-calendar-actions"><button className="monteur-secondary" onClick={() => { setMonth(today.slice(0, 7)); setDay(today); setAll(false) }}>Heute</button><button className="monteur-secondary" aria-pressed={all} onClick={() => { setAll(!all); setDay('') }}>{all ? 'Monatsansicht' : 'Alle Termine'}</button></div><label className="monteur-check-label"><input type="checkbox" checked={done} onChange={e => setDone(e.target.checked)}/> Erledigte einblenden</label>
    <h2>{all ? 'Alle Termine' : day ? dayLabel(day) : 'Termine im Monat'}</h2><div className="monteur-agenda">{shown.map(project => <ProjectLink key={project.id} project={project} onOpen={onOpen}/>)}</div>{!shown.length && <p>Keine Termine für diese Auswahl.</p>}
    <details className="monteur-undated"><summary>Ohne Termin ({undated.length})</summary>{undated.map(project => <ProjectLink key={project.id} project={project} onOpen={onOpen}/>)}</details>
  </section>
}
