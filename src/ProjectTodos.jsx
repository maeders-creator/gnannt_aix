import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, MessageSquare, Plus, RotateCcw, Search } from 'lucide-react'
import { berlinDay, projectTodoList } from './projectTodos'
import './projectTodos.css'

function TodoRow({ item, today, author, onComment, onComplete, onReopen, onEdit, disabled }) {
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const done = item.status === 'ERLEDIGT'
  const createdDay = item.created_at ? berlinDay(new Date(item.created_at)) : ''
  const recent = createdDay && createdDay <= today && (Date.parse(`${today}T12:00Z`) - Date.parse(`${createdDay}T12:00Z`)) <= 7 * 86400000
  const overdue = !done && item.termin && item.termin < today
  const lastNote = (item.notiz || '').trim().split('\n').filter(Boolean).slice(-1)[0]
  const act = async fn => {
    setBusy(true); setError('')
    try { await fn() } catch (e) { setError(e.message || 'Speichern fehlgeschlagen. Bitte erneut versuchen.') }
    finally { setBusy(false) }
  }
  return <article className={`todo-row ${done ? 'todo-done' : ''}`}>
    <div className="todo-summary">
      <button className="todo-check" role="checkbox" aria-checked={done} aria-label={`${item.projekt}: ${done ? 'wieder öffnen' : 'als erledigt markieren'}`} disabled={busy || disabled} onClick={() => act(() => done ? onReopen(item) : onComplete(item))} title={done ? 'Projekt wieder öffnen' : 'Projekt als erledigt markieren'}>{done && <Check size={19}/>}</button>
      <div className="todo-project">
        <div className="todo-title"><button onClick={() => onEdit(item)}>{item.projekt || 'Ohne Projektname'}</button>{recent && !done && <span className="todo-new">Neu</span>}</div>
        <span>{[item.kunde, item.ort || item.adresse].filter(Boolean).join(' · ') || 'Kunde / Ort noch offen'}</span>
        <span className="todo-creator">Eingestellt von: {item.created_by_name || 'Bestand · nicht erfasst'}</span>
        <div className="todo-row-actions"><button onClick={() => onEdit(item)}>Details / Bearbeiten</button>{done && <button disabled={busy || disabled} onClick={() => act(() => onReopen(item))}><RotateCcw size={13}/> Wieder öffnen</button>}</div>
        {lastNote && <button className="todo-note-preview" onClick={() => setExpanded(!expanded)}><MessageSquare size={13}/>{lastNote}</button>}
      </div>
      <div className={`todo-date ${overdue ? 'todo-overdue' : ''}`}><strong>{item.termin ? new Date(`${item.termin}T12:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : 'Ohne Termin'}</strong><small>{overdue ? 'Überfällig' : item.uhrzeit?.slice(0, 5) || (createdDay ? `Angelegt: ${new Date(`${createdDay}T12:00:00`).toLocaleDateString('de-DE')}` : 'Termin offen')}</small></div>
      <div className="todo-team"><strong>{item.lead || 'Noch nicht zugeteilt'}</strong><small>{item.mitarbeiter || 'Team noch offen'}</small></div>
      <span className={`badge ${String(item.status || 'AUFMASS').toLowerCase()}`}>{(item.status || 'OFFEN').replaceAll('_', ' ')}</span>
      <button className="todo-expand" aria-expanded={expanded} aria-label={`Kommentare zu ${item.projekt}`} onClick={() => setExpanded(!expanded)}><MessageSquare size={17}/><ChevronDown size={15} className={expanded ? 'todo-rotated' : ''}/></button>
    </div>
    {error && <p className="todo-error" role="alert">{error}</p>}
    {expanded && <div className="todo-detail">
      <div className="todo-history"><strong>Notizen & Kommentare</strong><p>{item.notiz || 'Noch keine Kommentare. Ergänze den nächsten Schritt oder eine Rückmeldung zur Montage.'}</p>{item.attachment_url && <a href={item.attachment_url} target="_blank" rel="noreferrer">Projekt-PDF öffnen</a>}</div>
      <form onSubmit={e => { e.preventDefault(); act(async () => { await onComment(item.id, draft, author); setDraft('') }) }}>
        <label htmlFor={`todo-comment-${item.id}`}>Kommentar hinzufügen{author ? ` · ${author}` : ''}</label>
        <textarea id={`todo-comment-${item.id}`} value={draft} onChange={e => setDraft(e.target.value)} maxLength={2000} placeholder="Was ist zu tun? Was fehlt? Was wurde erledigt?" rows={3}/>
        <button className="btn primary small" disabled={busy || disabled || !draft.trim() || !author}>{busy ? 'Speichert…' : 'Kommentar speichern'}</button>
        {!author && <small>Bitte oben deinen Namen unter „Kommentar von“ wählen.</small>}
      </form>
    </div>}
  </article>
}

export default function ProjectTodos({ items, employees, online, onComment, onComplete, onReopen, onUndo, onEdit, onAdd, fixedAuthor }) {
  const [filter, setFilter] = useState('open')
  const [team, setTeam] = useState(() => fixedAuthor || 'ALLE')
  const [search, setSearch] = useState('')
  const [selectedAuthor, setAuthor] = useState(() => { try { return localStorage.getItem('gnannt_todo_author') || '' } catch { return '' } })
  const author = fixedAuthor || selectedAuthor
  const [lastDone, setLastDone] = useState(null)
  const [undoError, setUndoError] = useState('')
  const [undoing, setUndoing] = useState(false)
  const knownProjects = useRef(null)
  const [newProjects, setNewProjects] = useState([])
  useEffect(() => {
    const current = new Set(items.map(item => String(item.id)))
    if (knownProjects.current) {
      const incoming = items.filter(item => item.status !== 'ERLEDIGT' && !knownProjects.current.has(String(item.id))).map(item => String(item.id))
      setNewProjects(previous => [...new Set([...previous, ...incoming])].filter(id => items.some(item => String(item.id) === id && item.status !== 'ERLEDIGT')))
    }
    knownProjects.current = current
  }, [items])
  const today = berlinDay()
  const open = items.filter(item => item.status !== 'ERLEDIGT')
  const shown = useMemo(() => projectTodoList(items, { filter, team, search, today }).filter(item => filter !== 'new' || newProjects.includes(String(item.id))), [items, filter, team, search, today, newProjects])
  const scopedOpen = projectTodoList(items, { team, today })
  const filters = [['open', 'Alle offen', scopedOpen.length], ['today', 'Heute'], ['week', 'Diese Woche'], ['overdue', 'Überfällig', scopedOpen.filter(p => p.termin && p.termin < today).length], ['undated', 'Ohne Termin', scopedOpen.filter(p => !p.termin).length], ['done', 'Erledigt']]
  const showAll = () => { setFilter('open'); setTeam('ALLE'); setSearch(''); setNewProjects([]) }
  return <section className="project-todos" aria-label="Projekt-To-do-Liste">
    <div className="todo-heading"><div><h2>{fixedAuthor && team === fixedAuthor ? 'Meine Jobs' : 'Projekt-To-dos'}</h2><p>{fixedAuthor && team === fixedAuthor ? 'Deine Aufträge als Verantwortlicher oder im Mitarbeiterteam. Was zuerst fällig ist, steht oben.' : 'Überfälliges zuerst, danach Termin und Uhrzeit. Bei gleichem Termin zählt die Priorität.'}</p></div><button className="btn primary" onClick={onAdd}><Plus size={16}/> Projekt hinzufügen</button></div>
    {fixedAuthor && <div className="todo-personal-tabs" aria-label="Auftragsansicht"><button aria-pressed={team === fixedAuthor} onClick={() => { setTeam(fixedAuthor); setFilter('open'); setSearch('') }}>Meine Jobs</button><button aria-pressed={team === 'ALLE'} onClick={showAll}>Alle Projekte</button></div>}
    <div className="todo-controls">
      <div className="todo-filters">{filters.map(([value, label, count]) => <button key={value} className={filter === value ? 'selected' : ''} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}{count !== undefined && <span>{count}</span>}</button>)}</div>
      <div className="todo-inputs"><label className="todo-search"><Search size={17}/><input aria-label="To-dos durchsuchen" placeholder="Projekt, Kunde, Ort, Kommentar…" value={search} onChange={e => setSearch(e.target.value)}/></label><label>Team<select aria-label="Team filtern" value={team} onChange={e => setTeam(e.target.value)}><option value="ALLE">Alle Mitarbeiter</option>{employees.map(name => <option key={name}>{name}</option>)}</select></label>{fixedAuthor ? <div className="todo-author-fixed">Kommentar von<strong>{fixedAuthor}</strong></div> : <label>Kommentar von<select aria-label="Kommentar von" value={author} onChange={e => { setAuthor(e.target.value); try { localStorage.setItem('gnannt_todo_author', e.target.value) } catch {} }}><option value="">Namen wählen</option>{employees.map(name => <option key={name}>{name}</option>)}</select></label>}</div>
    </div>
    <div className="todo-list-info"><span>{shown.length} Projekte · Fälliges zuerst</span>{(filter !== 'open' || team !== 'ALLE' || search) && <button onClick={showAll}>Alle {open.length} offenen Projekte anzeigen</button>}</div>
    {newProjects.length > 0 && <div className="todo-success" role="status"><span>{newProjects.length === 1 ? 'Ein neues Projekt wurde hinzugefügt.' : `${newProjects.length} neue Projekte wurden hinzugefügt.`}</span><button onClick={() => { setFilter('new'); setTeam('ALLE'); setSearch('') }}>Neue Projekte anzeigen</button></div>}
    {!online && <p className="todo-error" role="status">Keine Verbindung. Zum Kommentieren und Abhaken bitte wieder online gehen.</p>}
    {lastDone && <div className="todo-success" role="status"><span><Check size={16}/> {lastDone.projekt} erledigt</span><button disabled={undoing || !online} onClick={async () => { setUndoing(true); setUndoError(''); try { await onUndo(lastDone); setLastDone(null) } catch(e) { setUndoError(e.message) } finally { setUndoing(false) } }}><RotateCcw size={15}/> Rückgängig</button></div>}
    {undoError && <p className="todo-error" role="alert">{undoError}</p>}
    <div className="todo-list">{shown.map(item => <TodoRow key={item.id} item={item} today={today} author={author} disabled={!online} onEdit={onEdit} onComment={onComment} onReopen={async project => { await onReopen(project); setLastDone(null); setUndoError('') }} onComplete={async project => { await onComplete(project); setLastDone(project); setUndoError('') }}/>)}</div>
    {!shown.length && <div className="todo-empty">{filter === 'open' && !search && team === 'ALLE' ? 'Alles erledigt. Neue Projekte erscheinen hier automatisch.' : 'Keine Projekte für diese Auswahl.'}{(filter !== 'open' || search || team !== 'ALLE') && <button className="btn outline small" onClick={showAll}>Alle offenen Projekte</button>}</div>}
  </section>
}
