import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { CalendarDays, Plus, Search, Hammer, User, MapPin, ClipboardList, Monitor, LockKeyhole, LogOut, Maximize, Paperclip, Bell, Tablet, GripVertical, Moon, RefreshCw, Cloud, BarChart3, Upload, Users, FolderOpen, X } from 'lucide-react'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://zsgvqpikwhawodhvhdeq.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_sDNVYrXK9Zo2AqYo9fEsIw_KvY2YbDo'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const PUBLIC_SCREEN_HASH = '#screen'
const STORAGE_BUCKET = 'gnannt-aix-files'
const STATUS_ORDER = ['AUFMASS', 'KONSTRUKTION', 'PRODUKTION', 'MONTAGE']
const ALL_STATUS = ['AUFMASS', 'KONSTRUKTION', 'PRODUKTION', 'MONTAGE', 'ERLEDIGT']
const EMPLOYEES = ['Ruben', 'Edmund', 'Gerold', 'Samuel', 'Jonathan', 'Ali', 'Waldemar']

const EMPTY = { id: null, projekt: '', kunde: '', ort: '', gewerk: '', lead: 'Edmund', mitarbeiter: '', status: 'AUFMASS', termin: '', prioritaet: 'Mittel', notiz: '', attachment_name: '', attachment_url: '', push_enabled: false }

function badgeClass(status, dark = false) {
  const s = (status || 'AUFMASS').toLowerCase()
  return `badge ${dark ? 'dark ' : ''}${s}`
}
function fmt(v) { return v || '-' }

function Card({ item, onEdit, onStatus, compact, dark, draggable, onDragStart }) {
  return (
    <div className={`project-card ${dark ? 'dark-card' : ''} ${draggable ? 'drag' : ''}`} draggable={draggable} onDragStart={onDragStart}>
      <div className="card-head">
        <div className="card-title-wrap">
          <div className="card-title-line">
            {draggable && !compact && <GripVertical size={18} className="muted" />}
            <h3 className={compact ? 'card-title big' : 'card-title'}>{item.projekt || 'Ohne Projektname'}</h3>
          </div>
          <p>{item.kunde || '-'}</p>
        </div>
        <div className="badges">
          <span className={badgeClass(item.status, dark)}>{item.status}</span>
          {!compact && <span className="mini-badge">{item.prioritaet || 'Mittel'}</span>}
        </div>
      </div>
      <div className="meta">
        <div><MapPin size={16} /> {fmt(item.ort)}</div>
        <div><ClipboardList size={16} /> {fmt(item.gewerk)}</div>
        <div><User size={16} /> {fmt(item.lead)}</div>
        <div><Hammer size={16} /> {fmt(item.mitarbeiter)}</div>
        <div><CalendarDays size={16} /> Termin: {fmt(item.termin)}</div>
        {(item.attachment_name || item.attachment_url) && <div><Paperclip size={16} /> {item.attachment_name || 'Anhang vorhanden'}</div>}
        {item.push_enabled && <div><Bell size={16} /> Push aktiv</div>}
      </div>
      <div className="note">{item.notiz || '-'}</div>
      {!compact && (
        <div className="card-actions">
          <button className="btn small outline" onClick={() => onEdit(item)}>Bearbeiten</button>
          {ALL_STATUS.map(s => <button className="btn small outline" key={s} onClick={() => onStatus(item.id, s)}>{s === 'AUFMASS' ? 'Aufmaß' : s.charAt(0) + s.slice(1).toLowerCase()}</button>)}
        </div>
      )}
    </div>
  )
}

function Login({ email, setEmail, username, setUsername, password, setPassword, onPlanerLogin, onLogin, error, info, openScreen }) {
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-top">
          <div className="login-icon"><LockKeyhole size={26} /></div>
          <div>
            <h1>GNANNT_AIx Login</h1>
            <p>Planer-Login oder optional Magic Link</p>
          </div>
        </div>

        <div className="login-block">
          <h3>Planer Login</h3>
          <label>Benutzername</label>
          <input className="input" value={username} onChange={e => setUsername(e.target.value)} placeholder="Planer" />
          <label>Passwort</label>
          <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Planung" onKeyDown={e => { if(e.key === 'Enter') onPlanerLogin() }} />
          <button className="btn primary full" onClick={onPlanerLogin}>Anmelden</button>
        </div>

        <div className="login-separator">oder optional</div>

        <div className="login-block">
          <h3>Magic Link</h3>
          <label>E-Mail</label>
          <input className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@firma.de" onKeyDown={e => { if(e.key === 'Enter') onLogin() }} />
          <button className="btn outline full" onClick={onLogin}>Magic Link senden</button>
        </div>

        {error && <div className="error">{error}</div>}
        {info && <div className="success">{info}</div>}

        <button className="btn outline full" onClick={openScreen}>Produktionsscreen öffnen</button>
      </div>
    </div>
  )
}

function Modal({ open, close, children }) {
  if (!open) return null
  return <div className="modal-bg"><div className="modal"><button className="close" onClick={close}><X size={18}/></button>{children}</div></div>
}

function Form({ form, setForm, save, saving, upload, uploading }) {
  const set = (k, v) => setForm({ ...form, [k]: v })
  return (
    <div>
      <h2>Auftrag anlegen / bearbeiten</h2>
      <div className="form-grid">
        <input className="input" placeholder="Projekt" value={form.projekt || ''} onChange={e => set('projekt', e.target.value)} />
        <input className="input" placeholder="Kunde" value={form.kunde || ''} onChange={e => set('kunde', e.target.value)} />
        <input className="input" placeholder="Ort" value={form.ort || ''} onChange={e => set('ort', e.target.value)} />
        <input className="input" placeholder="Gewerk" value={form.gewerk || ''} onChange={e => set('gewerk', e.target.value)} />
        <select className="input" value={form.lead || 'Edmund'} onChange={e => set('lead', e.target.value)}>{EMPLOYEES.map(x => <option key={x}>{x}</option>)}</select>
        <select className="input" value={form.status || 'AUFMASS'} onChange={e => set('status', e.target.value)}>{ALL_STATUS.map(x => <option key={x}>{x}</option>)}</select>
        <select className="input" value={form.prioritaet || 'Mittel'} onChange={e => set('prioritaet', e.target.value)}><option>Hoch</option><option>Mittel</option><option>Niedrig</option></select>
        <input className="input" placeholder="Mitarbeiter / Team" value={form.mitarbeiter || ''} onChange={e => set('mitarbeiter', e.target.value)} />
        <input className="input" type="date" value={form.termin || ''} onChange={e => set('termin', e.target.value)} />
        <input className="input" placeholder="PDF / Auftrag Name" value={form.attachment_name || ''} onChange={e => set('attachment_name', e.target.value)} />
        <input className="input" placeholder="PDF / Auftrag URL" value={form.attachment_url || ''} onChange={e => set('attachment_url', e.target.value)} />
        <select className="input" value={form.push_enabled ? 'ja' : 'nein'} onChange={e => set('push_enabled', e.target.value === 'ja')}><option value="ja">Push aktiv</option><option value="nein">Kein Push</option></select>
        <textarea className="input textarea" placeholder="Notiz / Besonderheiten" value={form.notiz || ''} onChange={e => set('notiz', e.target.value)} />
      </div>
      {form.id && <div className="upload-box"><strong><Upload size={16}/> Datei hochladen PDF / Scan / Bild</strong><input className="input" type="file" accept="application/pdf,image/*" onChange={e => upload(e.target.files?.[0])} />{uploading && <p>Datei wird hochgeladen...</p>}</div>}
      <div className="right"><button className="btn primary" onClick={save} disabled={saving}>{saving ? 'Speichert...' : 'Speichern'}</button></div>
    </div>
  )
}

function Dashboard({ active, archived }) {
  const statusCounts = STATUS_ORDER.map(s => ({ s, count: active.filter(x => x.status === s).length }))
  const leads = active.reduce((a, p) => { const lead = p.lead || 'Ohne Lead'; a[lead] = (a[lead] || 0) + 1; return a }, {})
  return <div className="stack"><div className="stats"><div className="stat"><p>Offene Projekte</p><strong>{active.length}</strong></div><div className="stat"><p>Archivierte Projekte</p><strong>{archived.length}</strong></div><div className="stat"><p>Umsatz</p><strong>-</strong><small>Nicht aktiviert</small></div><div className="stat"><p>Auslastung</p><strong>-</strong><small>Nicht aktiviert</small></div></div><div className="two"><div className="panel"><h3><BarChart3/> Statusübersicht</h3>{statusCounts.map(r => <div className="row" key={r.s}><span className={badgeClass(r.s)}>{r.s}</span><strong>{r.count}</strong></div>)}</div><div className="panel"><h3><Users/> Verantwortliche</h3>{Object.entries(leads).map(([k,v]) => <div className="row" key={k}><span>{k}</span><strong>{v} Projekte</strong></div>)}</div></div></div>
}
function Calendar({ items, edit }) { const sorted = [...items].sort((a,b) => String(a.termin || '9999').localeCompare(String(b.termin || '9999'))); return <div className="panel"><h3><CalendarDays/> Montageplanung</h3>{sorted.map(x => <div className="row bigrow" key={x.id}><div><strong>{x.projekt}</strong><p>{x.kunde} · {x.ort} · Termin: {fmt(x.termin)}</p></div><button className="btn small outline" onClick={() => edit(x)}>Öffnen</button></div>)}</div> }
function Uploads({ items, edit }) { return <div className="panel"><h3><Upload/> Uploads</h3>{items.map(x => <div className="row bigrow" key={x.id}><div><strong>{x.projekt}</strong><p>{x.attachment_name || 'Noch kein Dokument'}</p></div><div className="row-actions">{x.attachment_url && <a className="btn small outline" href={x.attachment_url} target="_blank">Öffnen</a>}<button className="btn small outline" onClick={() => edit(x)}>Bearbeiten</button></div></div>)}</div> }
function Team({ user, items }) { const ruben = items.filter(x => x.status === 'MONTAGE' || x.lead === 'Ruben'); return <div className="stack"><div className="two"><div className="panel"><h3><Users/> Mitarbeiter Login</h3><p>Aktuell: <strong>{user?.email || '-'}</strong></p><p>Rolle: <strong>{user?.role || 'user'}</strong></p></div><div className="panel"><h3><FolderOpen/> Ruben App</h3><p>Relevante Montageprojekte: <strong>{ruben.length}</strong></p></div></div><div className="grid">{ruben.map(x => <Card key={x.id} item={x} compact />)}</div></div> }

export default function App() {
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState(window.location.hash === PUBLIC_SCREEN_HASH ? 'screen' : 'planung')
  const [filterLead, setFilterLead] = useState('ALLE')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [localUser, setLocalUser] = useState(null)
  const [loginError, setLoginError] = useState('')
  const [loginInfo, setLoginInfo] = useState('')
  const [user, setUser] = useState(null)
  const [dragged, setDragged] = useState(null)
  const screenRef = useRef(null)

  const isScreen = window.location.hash === PUBLIC_SCREEN_HASH
  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
    if (error) { setError(error.message); setConnected(false); setItems([]) } else { setError(''); setConnected(true); setItems(data || []) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])
  useEffect(() => { supabase.auth.getSession().then(({ data }) => { if (data.session?.user) setUser({ email: data.session.user.email, role: 'user' }) }); const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ? { email: session.user.email, role: 'user' } : null)); return () => data.subscription.unsubscribe() }, [])
  useEffect(() => { const channel = supabase.channel('projects-live').on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => load()).subscribe(s => setConnected(s === 'SUBSCRIBED')); return () => supabase.removeChannel(channel) }, [])
  useEffect(() => { const onHash = () => { if (window.location.hash === PUBLIC_SCREEN_HASH) setTab('screen') }; window.addEventListener('hashchange', onHash); return () => window.removeEventListener('hashchange', onHash) }, [])
  useEffect(() => { if (tab !== 'screen') return; const el = screenRef.current; if (!el) return; const timer = setInterval(() => { if (el.scrollHeight <= el.clientHeight) return; if (el.scrollTop >= el.scrollHeight - el.clientHeight - 2) el.scrollTop = 0; else el.scrollTop += 1 }, 35); return () => clearInterval(timer) }, [tab, items.length])

  const filtered = useMemo(() => items.filter(x => { const text = [x.projekt,x.kunde,x.ort,x.gewerk,x.lead,x.status,x.notiz,x.mitarbeiter].join(' ').toLowerCase(); return (!search || text.includes(search.toLowerCase())) && (filterLead === 'ALLE' || x.lead === filterLead) }), [items, search, filterLead])
  const active = filtered.filter(x => x.status !== 'ERLEDIGT')
  const archived = filtered.filter(x => x.status === 'ERLEDIGT')
  const grouped = STATUS_ORDER.map(s => ({ status: s, items: active.filter(x => x.status === s) }))
  const planerLogin = () => {
    setLoginError('')
    setLoginInfo('')
    if (username.trim() === 'Planer' && password === 'Planung') {
      setLocalUser({ email: 'Planer', role: 'planer' })
      setUser({ email: 'Planer', role: 'planer' })
      return
    }
    setLoginError('Benutzername oder Passwort ist falsch.')
  }

  const login = async () => { setLoginError(''); setLoginInfo(''); if (!email.trim()) { setLoginError('Bitte E-Mail eingeben.'); return }; const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` } }); if (error) setLoginError(error.message); else setLoginInfo('Magic Link wurde versendet.') }
  const logout = async () => { await supabase.auth.signOut(); setUser(null); setLocalUser(null); setUsername(''); setPassword('') }
  const save = async () => { if (!form.projekt?.trim()) return; setSaving(true); const payload = { ...form, id: undefined, termin: form.termin || null }; const res = form.id ? await supabase.from('projects').update(payload).eq('id', form.id) : await supabase.from('projects').insert(payload); if (res.error) setError(res.error.message); else { setModal(false); setForm(EMPTY); await load() }; setSaving(false) }
  const edit = (item) => { setForm({ ...EMPTY, ...item }); setModal(true) }
  const updateStatus = async (id, status) => { const { error } = await supabase.from('projects').update({ status }).eq('id', id); if (error) setError(error.message); else await load() }
  const upload = async (file) => { if (!file || !form.id) return; setUploading(true); const ext = file.name.split('.').pop() || 'bin'; const path = `projects/${form.id}_${Date.now()}.${ext}`; const { error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: true }); if (upErr) { setError(upErr.message); setUploading(false); return }; const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path); const { error: dbErr } = await supabase.from('projects').update({ attachment_name: file.name, attachment_url: data.publicUrl }).eq('id', form.id); if (dbErr) setError(dbErr.message); else { setForm(p => ({ ...p, attachment_name: file.name, attachment_url: data.publicUrl })); await load() }; setUploading(false) }
  const openScreen = () => { window.location.hash = PUBLIC_SCREEN_HASH; setTab('screen') }
  const full = async () => { try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen() } catch {} }

  if (!user && !isScreen) return <Login email={email} setEmail={setEmail} username={username} setUsername={setUsername} password={password} setPassword={setPassword} onPlanerLogin={planerLogin} onLogin={login} error={loginError} info={loginInfo} openScreen={openScreen} />
  if (tab === 'screen') return <div className="screen"><div className="screen-top"><div><h1>GNANNT_AIx Screen</h1><p>Offene Projekte: {active.length}</p></div><div className="screen-actions"><span className={connected ? 'live on' : 'live off'}><Cloud size={14}/>{connected ? 'Live verbunden' : 'Offline'}</span><Moon/><Tablet/><button className="btn screenbtn" onClick={full}><Maximize size={16}/> Vollbild</button></div></div><div ref={screenRef} className="screen-scroll">{loading ? <div className="screen-empty">Lade Daten...</div> : active.length ? active.map(x => <Card key={x.id} item={x} compact dark />) : <div className="screen-empty">Keine offenen Projekte.</div>}</div></div>
  return <div className="app"><div className="shell"><header><div><h1>GNANNT_AIx</h1><p>Cloud-Plantafel Produktion & Montage</p></div><div className="header-actions"><button className="btn outline" onClick={load}><RefreshCw size={16}/> Neu laden</button><button className="btn outline" onClick={openScreen}><Monitor size={16}/> Screen</button><button className="btn outline" onClick={logout}><LogOut size={16}/> Abmelden</button><button className="btn primary" onClick={() => { setForm(EMPTY); setModal(true) }}><Plus size={16}/> Neuer Auftrag</button></div></header><div className="stats"><div className="stat"><p>Offene Projekte</p><strong>{active.length}</strong></div><div className="stat"><p>Datenstatus</p><span><Cloud size={16}/> {connected ? 'Supabase live verbunden' : 'Keine Live-Verbindung'}</span>{error && <small className="error">{error}</small>}</div><div className="stat"><p>Modus</p><span>Tablet / TV optimiert</span></div></div><div className="toolbar"><div className="search"><Search size={18}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suche nach Projekt, Kunde, Ort oder Verantwortlichem..." /></div><select value={filterLead} onChange={e => setFilterLead(e.target.value)}><option>ALLE</option>{EMPLOYEES.map(x => <option key={x}>{x}</option>)}</select></div><nav>{['planung','dashboard','kalender','uploads','ruben','team'].map(t => <button key={t} className={tab===t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}</nav>{loading ? <div className="panel center">Lade Projekte...</div> : tab === 'planung' ? <div className="stack">{grouped.map(g => <div key={g.status} className="panel" onDragOver={e => e.preventDefault()} onDrop={() => dragged && updateStatus(dragged, g.status)}><div className="panel-head"><h3>{g.status}</h3><span className={badgeClass(g.status)}>{g.items.length}</span></div><p className="tiny">Drag & Drop zwischen Statusbereichen aktiv</p><div className="grid">{g.items.length ? g.items.map(x => <Card key={x.id} item={x} onEdit={edit} onStatus={updateStatus} draggable onDragStart={() => setDragged(x.id)} />) : <div className="empty">Keine offenen Projekte</div>}</div></div>)}{archived.length > 0 && <div className="panel"><h3>Archiv</h3><div className="grid">{archived.map(x => <Card key={x.id} item={x} onEdit={edit} onStatus={updateStatus}/>)}</div></div>}</div> : tab === 'dashboard' ? <Dashboard active={active} archived={archived}/> : tab === 'kalender' ? <Calendar items={active} edit={edit}/> : tab === 'uploads' ? <Uploads items={items} edit={edit}/> : <Team user={user} items={tab === 'ruben' ? items.filter(x => x.status === 'MONTAGE' || x.lead === 'Ruben') : items}/>}<Modal open={modal} close={() => setModal(false)}><Form form={form} setForm={setForm} save={save} saving={saving} upload={upload} uploading={uploading} /></Modal></div></div>
}
