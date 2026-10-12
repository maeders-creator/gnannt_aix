import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, ChevronRight, LogOut, RefreshCw, Smartphone, X, ListTodo, BookOpen, LayoutDashboard, CalendarDays } from 'lucide-react'
import ProjectTodos from './ProjectTodos'
import { createMonteurApi, MONTEUR_SESSION, readMonteurToken } from './monteurApi'
import { EMPLOYEES, ProjectDetail, MonteurHub, MonteurDashboard, MonteurCalendar } from './MonteurViews'
import './monteur.css'

const blank = actor => ({ requestId: crypto.randomUUID(), projekt: '', kunde: '', ort: '', adresse: '', telefon: '', lead: EMPLOYEES.includes(actor.name) ? actor.name : '', team: EMPLOYEES.includes(actor.name) ? [actor.name] : [], termin: '', uhrzeit: '', prioritaet: 'Mittel', notiz: '' })

function OrderWizard({ actor, api, onSaved, onClose }) {
  const key = `gnannt_monteur_draft_${actor.id}`
  const [form, setForm] = useState(() => { try { const saved = JSON.parse(localStorage.getItem(key)); if (saved?.requestId) return { ...blank(actor), ...saved } } catch {} return blank(actor) })
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const top = useRef(null)
  const set = (field, value) => setForm(current => ({ ...current, [field]: value }))
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(form)) } catch {} }, [form, key])
  useEffect(() => { top.current?.focus(); window.scrollTo(0, 0) }, [step])
  const submit = async e => {
    e.preventDefault(); setError('')
    if (step < 2) { setStep(step + 1); return }
    if (submitting.current) return
    submitting.current = true; setBusy(true)
    try {
      const result = await api('create', form)
      try { localStorage.removeItem(key) } catch {}
      onSaved(result.project)
    } catch (e) { setError(e.message) }
    finally { submitting.current = false; setBusy(false) }
  }
  const date = form.termin ? new Date(`${form.termin}T12:00:00`).toLocaleDateString('de-DE') : 'Termin noch offen'
  return <section className="monteur-wizard">
    <div className="monteur-wizard-top"><button onClick={onClose} disabled={busy}><X size={19}/> Schließen</button><span>Entwurf bleibt gespeichert</span></div>
    <ol className="monteur-steps" aria-label="Auftragserfassung">{['Auftrag', 'Einsatz', 'Prüfen'].map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined} className={index <= step ? 'current' : ''}><span>{index < step ? <Check size={15}/> : index + 1}</span>{label}</li>)}</ol>
    <h1 ref={top} tabIndex={-1}>{['Was ist zu tun?', 'Einsatz planen', 'Alles richtig?'][step]}</h1>
    <p className="monteur-subtitle">{['Kunde und Baustelle eintragen. Die Details kannst du danach ergänzen.', 'Zuständigkeit und Termin festlegen. Ein offener Termin ist möglich.', 'Nach dem Speichern sehen alle den Auftrag sofort in der gemeinsamen Liste.'][step]}</p>
    <form onSubmit={submit}>
      {step === 0 && <div className="monteur-fields">
        <label>Auftrag / kurze Beschreibung *<input required maxLength={300} autoComplete="off" value={form.projekt} onChange={e => set('projekt', e.target.value)} placeholder="z. B. Haustür einstellen"/></label>
        <label>Kunde *<input required maxLength={300} autoComplete="organization" value={form.kunde} onChange={e => set('kunde', e.target.value)} placeholder="Name oder Firma"/></label>
        <label>Ort *<input required maxLength={300} autoComplete="address-level2" value={form.ort} onChange={e => set('ort', e.target.value)} placeholder="z. B. Ehingen"/></label>
        <label>Straße und Hausnummer<input maxLength={500} autoComplete="street-address" value={form.adresse} onChange={e => set('adresse', e.target.value)} placeholder="Optional"/></label>
        <label>Telefon für Rückfragen<input type="tel" maxLength={80} autoComplete="tel" value={form.telefon} onChange={e => set('telefon', e.target.value)} placeholder="Optional"/></label>
      </div>}
      {step === 1 && <div className="monteur-fields">
        <label>Verantwortlich<select required value={form.lead} onChange={e => set('lead', e.target.value)}><option value="" disabled>Bitte Kollegen auswählen</option>{EMPLOYEES.map(name => <option key={name}>{name}</option>)}</select></label>
        <fieldset><legend>Mitarbeiterteam · Wer hilft mit?</legend><p className="monteur-subtitle">Ausgewählte Kollegen sehen den Auftrag unter „Meine Jobs“ in ihrer App.</p><div className="monteur-team-options">{EMPLOYEES.map(name => <label key={name}><input type="checkbox" checked={form.team.includes(name)} onChange={e => set('team', e.target.checked ? [...form.team, name] : form.team.filter(x => x !== name))}/>{name}</label>)}</div></fieldset>
        <div className="monteur-field-pair"><label>Termin<input type="date" value={form.termin} onChange={e => { setForm(current => ({ ...current, termin: e.target.value, uhrzeit: e.target.value ? current.uhrzeit : '' })) }}/></label><label>Uhrzeit<input type="time" disabled={!form.termin} value={form.uhrzeit} onChange={e => set('uhrzeit', e.target.value)}/></label></div>
        <label>Priorität<select value={form.prioritaet} onChange={e => set('prioritaet', e.target.value)}><option>Niedrig</option><option>Mittel</option><option>Hoch</option></select></label>
        <label>Was ist wichtig?<textarea rows={4} maxLength={4000} value={form.notiz} onChange={e => set('notiz', e.target.value)} placeholder="Arbeiten, Material, Besonderheiten, Zugang zur Baustelle…"/></label>
      </div>}
      {step === 2 && <div className="monteur-review"><h2>{form.projekt}</h2><dl><dt>Kunde</dt><dd>{form.kunde}</dd><dt>Einsatzort</dt><dd>{[form.adresse, form.ort].filter(Boolean).join(', ')}</dd>{form.telefon && <><dt>Telefon</dt><dd>{form.telefon}</dd></>}<dt>Verantwortlich</dt><dd>{form.lead}</dd><dt>Team</dt><dd>{form.team.join(', ') || 'Noch offen'}</dd><dt>Termin</dt><dd>{date}{form.uhrzeit && ` · ${form.uhrzeit} Uhr`}</dd><dt>Priorität</dt><dd>{form.prioritaet}</dd><dt>Eingestellt von</dt><dd><strong>{actor.name}</strong></dd></dl>{form.notiz && <p className="monteur-note">{form.notiz}</p>}</div>}
      {error && <p className="monteur-error" role="alert">{error}</p>}
      <div className="monteur-wizard-actions">{step > 0 && <button type="button" className="monteur-secondary" disabled={busy} onClick={() => setStep(step - 1)}><ArrowLeft size={17}/> Zurück</button>}<button className="monteur-primary" disabled={busy}>{busy ? 'Wird gespeichert…' : step === 2 ? 'Auftrag einstellen' : 'Weiter'}{!busy && (step === 2 ? <Check size={18}/> : <ChevronRight size={18}/>)}</button></div>
    </form>
  </section>
}

function InstallHelp({ onClose }) {
  return <section className="monteur-help"><button className="monteur-back" onClick={onClose}><ArrowLeft size={18}/> Zur Liste</button><Smartphone size={32}/><h1>Einmal speichern.<br/>Direkt starten.</h1><p>Öffne zuerst deinen persönlichen Link im Browser. Speichere die App auf deinem eigenen Handy.</p><h2>iPhone · Safari</h2><ol><li>Unten oder oben auf <strong>Teilen</strong> tippen. Je nach Ansicht zuerst das Menü öffnen.</li><li><strong>Zum Home-Bildschirm</strong> auswählen.</li><li>Falls vorhanden, <strong>Als Web-App öffnen</strong> aktivieren und <strong>Hinzufügen</strong> tippen.</li></ol><h2>Android · Chrome</h2><ol><li>Oben rechts das <strong>Dreipunkt-Menü</strong> öffnen.</li><li><strong>Zum Startbildschirm hinzufügen</strong> oder <strong>Installieren und Verknüpfung erstellen</strong> wählen.</li><li><strong>Installieren</strong> bzw. <strong>Hinzufügen</strong> bestätigen.</li></ol><p className="monteur-tip">Danach auf das Gnannt-Symbol tippen. Dein Name steht oben; Aufträge und Kommentare werden dir automatisch zugeordnet.</p><p>Wenn du den Link in WhatsApp geöffnet hast: über das Menü in Safari oder Chrome öffnen.</p><small>Menübezeichnungen können je nach Handy und Browser abweichen. Den persönlichen Link bitte aufbewahren und nicht weitergeben.</small></section>
}

export default function MonteurApp() {
  const [token, setToken] = useState(readMonteurToken)
  const api = useMemo(() => createMonteurApi(token), [token])
  const [actor, setActor] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(Boolean(token))
  const [error, setError] = useState('')
  const [online, setOnline] = useState(navigator.onLine)
  const [view, setView] = useState('list')
  const [saved, setSaved] = useState(null)
  const [detailId, setDetailId] = useState(null)
  const detail = items.find(item => item.id === detailId)
  const openDetail = project => { setDetailId(project.id); window.scrollTo(0, 0) }
  const version = useRef(0)
  const load = useCallback(async () => {
    if (!token || !navigator.onLine) { setLoading(false); return }
    const request = ++version.current
    try {
      const result = await api('list')
      if (request !== version.current) return
      setActor(result.actor); setItems(result.projects); setError('')
    } catch (e) { if (request === version.current) { setError(e.message); if (e.status === 401) { setActor(null); setItems([]) } } }
    finally { if (request === version.current) setLoading(false) }
  }, [api, token])
  useEffect(() => {
    load()
    const refresh = () => { if (document.visibilityState === 'visible') load() }
    const reconnect = () => { setOnline(true); load() }
    const offline = () => setOnline(false)
    const timer = setInterval(refresh, 30000)
    window.addEventListener('online', reconnect); window.addEventListener('offline', offline); window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh)
    return () => { clearInterval(timer); window.removeEventListener('online', reconnect); window.removeEventListener('offline', offline); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [load])
  const apply = project => { version.current += 1; setItems(current => [project, ...current.filter(item => item.id !== project.id)]) }
  const action = async (name, input) => { const result = await api(name, input); apply(result.project); return result.project }
  const logout = () => { version.current += 1; try { localStorage.removeItem(MONTEUR_SESSION) } catch {} location.hash = '#monteur'; setToken(''); setActor(null); setItems([]); setView('list'); setError('') }
  return <main className="monteur-app"><div className="monteur-shell">
    <header className="monteur-header"><img src="/gnannt-logo.png" alt="Gnannt"/><div><strong>Monteurzugang</strong><span>{actor ? `Angemeldet als ${actor.name}` : 'Aufträge · Team · Rückmeldungen'}</span></div>{actor && <button aria-label="Abmelden" title="Abmelden" onClick={logout}><LogOut size={20}/></button>}</header>
    {!token ? <section className="monteur-welcome"><Smartphone size={36}/><h1>Dein direkter Zugang</h1><p>Öffne deinen persönlichen Zugangslink von Samuel. Dann kannst du Aufträge einstellen, kommentieren und abhaken.</p></section> : !actor ? <section className="monteur-welcome"><h1>{loading ? 'Zugang wird geöffnet…' : 'Zugang prüfen'}</h1>{error && <p role="alert">{error}</p>}{!loading && <button className="monteur-primary" onClick={load}>Erneut versuchen</button>}</section> : <>
      {view === 'new' ? <OrderWizard actor={actor} api={api} onClose={() => setView('list')} onSaved={project => { apply(project); setSaved(project); setView('list'); window.scrollTo(0, 0) }}/> : view === 'help' ? <InstallHelp onClose={() => setView('list')}/> : <>
        <div className="monteur-tools"><button onClick={() => { setDetailId(null); setView('help') }}><Smartphone size={17}/> Als App speichern</button><button onClick={load} aria-label="Liste aktualisieren"><RefreshCw size={17}/></button></div>
        {!online && <p className="monteur-error" role="status">Offline. Zum Speichern bitte mit dem Internet verbinden.</p>}
        {error && <p className="monteur-error" role="alert">{error}</p>}
        {saved && <div className="monteur-saved" role="status"><Check size={20}/><div><strong>Auftrag eingestellt</strong><span>{saved.projekt} · von {saved.created_by_name}</span></div><button onClick={() => setSaved(null)} aria-label="Bestätigung schließen"><X size={18}/></button></div>}
        {detail ? <ProjectDetail key={detail.id} project={detail} api={api} online={online} onSaved={apply} onClose={() => setDetailId(null)}/> : <>
          <nav className="monteur-nav" aria-label="Monteur-Bereiche">{[['list', 'To-dos', ListTodo], ['hub', 'Hub', BookOpen], ['dashboard', 'Dashboard', LayoutDashboard], ['calendar', 'Kalender', CalendarDays]].map(([key, label, Icon]) => <button key={key} aria-current={view === key ? 'page' : undefined} onClick={() => { setView(key); setSaved(null) }}><Icon size={21}/>{label}</button>)}</nav>
          {view === 'hub' ? <MonteurHub api={api}/> : view === 'dashboard' ? <MonteurDashboard items={items} actor={actor} onOpen={openDetail}/> : view === 'calendar' ? <MonteurCalendar items={items} onOpen={openDetail}/> : <ProjectTodos items={items} employees={EMPLOYEES} online={online} fixedAuthor={actor.name} personalName={EMPLOYEES.includes(actor.name) ? actor.name : ''} onAdd={() => { setSaved(null); setView('new') }} onEdit={openDetail} onComment={(id, comment) => action('comment', { id, comment })} onComplete={project => action('complete', { id: project.id, previousStatus: project.status })} onReopen={project => action('reopen', { id: project.id })} onUndo={project => action('reopen', { id: project.id })}/>}
        </>}
      </>}
    </>}
    <footer>GNANNT · Produktion & Montage</footer>
  </div></main>
}
