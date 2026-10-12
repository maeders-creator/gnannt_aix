import { useEffect, useRef, useState } from 'react'
import { projectTeamNames } from './projectTodos'
import { screenDate } from './productionWeek'
import './productionWeek.css'

const STATUS_LABELS = { AUFMASS: 'Aufmaß', KONSTRUKTION: 'Konstruktion', PRODUKTION: 'Produktion', MONTAGE: 'Montage', IN_ARBEIT: 'In Arbeit' }

export function PlannerTeamPicker({ value, onChange, employees, disabled }) {
  const selected = projectTeamNames(value)
  // Keep older names visible and selected until the planner deliberately removes them.
  const options = [...new Set([...employees, ...selected])]
  return <fieldset className="planner-team-picker" disabled={disabled}>
    <legend>Mitarbeiterteam auswählen</legend>
    <p>Mehrere Kollegen möglich. Verantwortlicher und Team sehen den Auftrag unter „Meine Jobs“.</p>
    <div>{options.map(name => <label key={name}>
      <input type="checkbox" checked={selected.includes(name)} onChange={e => onChange((e.target.checked ? [...selected, name] : selected.filter(person => person !== name)).join(', '))} />
      <span>{name}</span>
    </label>)}</div>
  </fieldset>
}

export function useScreenAutoScroll(ref, enabled, weekStart) {
  useEffect(() => {
    const el = ref.current
    if (!enabled || !el) return
    el.scrollTop = 0
    let resumeAt = Date.now() + 12000
    let atEnd = false
    const pause = () => { resumeAt = Date.now() + 180000; atEnd = false }
    const events = ['pointerdown', 'touchstart', 'wheel', 'keydown']
    events.forEach(event => window.addEventListener(event, pause, { passive: true }))
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible' || Date.now() < resumeAt) return
      const max = el.scrollHeight - el.clientHeight
      if (max <= 2) return
      if (atEnd) { el.scrollTop = 0; atEnd = false; resumeAt = Date.now() + 12000 }
      else if (el.scrollTop >= max - 2) { atEnd = true; resumeAt = Date.now() + 12000 }
      else el.scrollTop += 1
    }, 80)
    return () => { clearInterval(timer); events.forEach(event => window.removeEventListener(event, pause)) }
  }, [ref, enabled, weekStart])
}

export default function ProductionWeek({ items, week, online, onComplete, onUndo, onStart }) {
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [error, setError] = useState('')
  const [undo, setUndo] = useState(null)
  const days = [...new Set(items.map(item => item.termin))]
  const run = async action => {
    if (busyRef.current) return
    busyRef.current = true; setBusy(true); setError('')
    try { await action() } catch (err) { setError(err.message || 'Speichern fehlgeschlagen. Bitte erneut versuchen.') }
    finally { busyRef.current = false; setBusy(false) }
  }
  return <div className="production-week">
    <div className="week-summary">
      <h2>To-dos · KW {week.number} · {screenDate(week.start)} – {screenDate(week.end)}</h2>
      <span>{items.length} offene {items.length === 1 ? 'Auftrag' : 'Aufträge'} · Fälliges zuerst</span>
    </div>
    {error && <div className="week-feedback error" role="alert">{error}</div>}
    {undo && <div className="week-feedback" role="status">
      <span>„{undo.projekt}“ erledigt.</span>
      <button disabled={busy || !online} onClick={() => run(async () => { await onUndo(undo); setUndo(null) })}>Rückgängig machen</button>
    </div>}
    {!items.length && <div className="screen-empty">Keine offenen Aufträge mit Termin in dieser Woche.</div>}
    {days.map(day => <section className="week-day" key={day} aria-label={screenDate(day, true)}>
      <h3>{screenDate(day, true)}{day === week.today && <span>Heute</span>}</h3>
      <ul className="week-jobs">{items.filter(item => item.termin === day).map(item => {
        const team = [...new Set([item.lead, ...projectTeamNames(item.mitarbeiter)].filter(Boolean))]
        const note = String(item.notiz || '').trim().split(/\n\s*\n/).at(-1)?.replace(/^\[[^\]]+\]\s*/, '')
        return <li className="week-job" key={item.id}>
          <input className="week-check" type="checkbox" checked={false} disabled={busy || !online} aria-label={`${item.projekt}: als erledigt markieren`} onChange={() => run(async () => { await onComplete(item); setUndo(item) })} />
          <div className="week-time">{item.uhrzeit ? <><strong>{item.uhrzeit.slice(0, 5)}</strong><span>Uhr</span></> : <span>Zeit offen</span>}</div>
          <div className="week-project"><h4>{item.projekt || 'Ohne Projektname'}</h4><p>{item.kunde}</p>{note && <p className="week-note">{note}</p>}</div>
          <div className="week-location"><span className="week-label">Einsatzort</span><strong>{item.ort || item.adresse || 'Ort noch offen'}</strong>{item.adresse && item.adresse !== item.ort && <p>{item.adresse}</p>}</div>
          <div className="week-team"><span className="week-label">Wer ist vor Ort?</span><strong>{team.join(', ') || 'Team noch offen'}</strong>{item.lead && <p>Verantwortlich: {item.lead}</p>}</div>
          <div className="week-state"><span className={`week-status ${item.status === 'IN_ARBEIT' ? 'working' : ''}`}>{STATUS_LABELS[item.status] || item.status || 'Offen'}</span>{item.status !== 'IN_ARBEIT' && <button disabled={busy || !online} onClick={() => run(() => onStart(item))}>Starten</button>}</div>
        </li>
      })}</ul>
    </section>)}
  </div>
}
