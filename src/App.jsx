import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { CalendarDays, Plus, Search, Hammer, User, MapPin, ClipboardList, Monitor, LockKeyhole, LogOut, Maximize, Paperclip, Bell, Tablet, GripVertical, Moon, RefreshCw, Cloud, BarChart3, Upload, Users, FolderOpen, X } from 'lucide-react'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://zsgvqpikwhawodhvhdeq.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_sDNVYrXK9Zo2AqYo9fEsIw_KvY2YbDo'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const LOCAL_CACHE_KEY = 'gnannt_aix_projects_cache_v1'
const LOCAL_QUEUE_KEY = 'gnannt_aix_offline_queue_v1'

function readCache() {
  try { return JSON.parse(localStorage.getItem(LOCAL_CACHE_KEY) || '[]') } catch { return [] }
}
function writeCache(data) {
  try { localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(data || [])) } catch {}
}
function readQueue() {
  try { return JSON.parse(localStorage.getItem(LOCAL_QUEUE_KEY) || '[]') } catch { return [] }
}
function writeQueue(q) {
  try { localStorage.setItem(LOCAL_QUEUE_KEY, JSON.stringify(q || [])) } catch {}
}
function queueOperation(op) {
  const q = readQueue()
  q.push({ ...op, queue_id: Date.now() + '_' + Math.random().toString(16).slice(2) })
  writeQueue(q)
}
function cacheUpsert(project) {
  const data = readCache()
  const idx = data.findIndex(x => String(x.id) === String(project.id))
  if (idx >= 0) data[idx] = { ...data[idx], ...project }
  else data.unshift(project)
  writeCache(data)
  return data
}
function cacheUpdate(id, patch) {
  const data = readCache().map(x => String(x.id) === String(id) ? { ...x, ...patch } : x)
  writeCache(data)
  return data
}


const PUBLIC_SCREEN_HASH = '#screen'
const STORAGE_BUCKET = 'uploads'
const STATUS_ORDER = ['AUFMASS', 'KONSTRUKTION', 'PRODUKTION', 'MONTAGE']
const ALL_STATUS = ['AUFMASS', 'KONSTRUKTION', 'PRODUKTION', 'MONTAGE', 'ERLEDIGT']
const EMPLOYEES = ['Ruben', 'Edmund', 'Gerold', 'Samuel', 'Jonathan', 'Waldemar']

const EMPTY = { id: null, projekt: '', kunde: '', ort: '', adresse: '', telefon: '', email_kunde: '', gewerk: '', lead: 'Edmund', mitarbeiter: '', status: 'AUFMASS', termin: '', prioritaet: 'Mittel', notiz: '', attachment_name: '', attachment_url: '', push_enabled: false }

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
        <div className="badges"><button className="print-icon-btn" title="Auftrag drucken / PDF" onClick={() => printJobPdf(item)}>🖨️</button>
          <span className={badgeClass(item.status, dark)}>{item.status}</span>
          {!compact && <span className="mini-badge">{item.prioritaet || 'Mittel'}</span>}
        </div>
      </div>
      <div className="meta">
        <div><MapPin size={16} /> {fmt(item.ort)}</div>
        <div><ClipboardList size={16} /> {fmt(item.adresse || item.ort)}</div>
        {item.telefon && <div><User size={16} /> Tel.: {item.telefon}</div>}
        {item.email_kunde && <div><User size={16} /> E-Mail: {item.email_kunde}</div>}
        <div><User size={16} /> {fmt(item.lead)}</div>
        <div><Hammer size={16} /> {fmt(item.mitarbeiter)}</div>
        <div><CalendarDays size={16} /> Termin: {fmt(item.termin)}</div>
        {(item.attachment_name || item.attachment_url) && <div><Paperclip size={16} /> {item.attachment_name || 'Anhang vorhanden'}</div>}
      </div>
      <div className="note">{item.notiz || '-'}</div>
      {!compact && (
        <div className="card-actions">
          <button className="btn small outline print-btn" onClick={() => printJobPdf(item)}>🖨️ PDF</button><button className="btn small outline" onClick={() => onEdit(item)}>Bearbeiten</button><button className="btn small outline" onClick={() => printJobPdf(item)}>PDF</button>
          {ALL_STATUS.map(s => <button className="btn small outline" key={s} onClick={() => onStatus(item.id, s)}>{s === 'AUFMASS' ? 'Aufmaß' : s.charAt(0) + s.slice(1).toLowerCase()}</button>)}
        </div>
      )}
    </div>
  )
}



function toDbProject(form) {
  return {
    projekt: form.projekt || '',
    kunde: form.kunde || '',
    adresse: form.adresse || '',
    ort: form.ort || '',
    telefon: form.telefon || '',
    email_kunde: form.email_kunde || '',
    gewerk: form.gewerk || '',
    lead: form.lead || '',
    mitarbeiter: form.mitarbeiter || '',
    status: form.status || 'AUFMASS',
    termin: form.termin || null,
    prioritaet: form.prioritaet || 'Mittel',
    notiz: form.notiz || '',
    attachment_name: form.attachment_name || '',
    attachment_url: form.attachment_url || '',
    push_enabled: !!form.push_enabled
  }
}

function printJobPdf(item) {
  const esc = (v) => String(v || '-').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))
  const win = window.open('', '_blank')
  if (!win) return
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"/><title>Auftrag ${esc(item.projekt)}</title><style>
  @page{size:A4;margin:16mm}body{font-family:Arial,sans-serif;color:#111827}.head{display:flex;justify-content:space-between;border-bottom:2px solid #111827;padding-bottom:12px;margin-bottom:18px}.logo{font-size:24px;font-weight:800}.sub{color:#6b7280;font-size:12px}h1{font-size:22px;margin:0 0 4px}.badge{display:inline-block;padding:5px 10px;border-radius:999px;background:#eef2ff;color:#3730a3;font-weight:700;font-size:12px}table{width:100%;border-collapse:collapse;margin-top:16px}td{border:1px solid #d1d5db;padding:9px 10px;vertical-align:top;font-size:13px}td:first-child{width:32%;background:#f9fafb;font-weight:700}.note{min-height:100px;white-space:pre-wrap}.footer{margin-top:28px;display:grid;grid-template-columns:1fr 1fr;gap:24px;font-size:12px}.sign{border-top:1px solid #111827;padding-top:6px;margin-top:38px}.actions{margin-top:18px;font-size:12px;color:#6b7280}@media print{.actions{display:none}}
  </style></head><body>
  <div class="head"><div><div class="logo">Gnannt GmbH</div><div class="sub">Produktionsplanung · Montage · Aufmaß</div></div><div style="text-align:right"><h1>Auftrag / Job Sheet</h1><div class="sub">${new Date().toLocaleDateString('de-DE')}</div></div></div>
  <span class="badge">${esc(item.status)}</span><h1 style="margin-top:12px">${esc(item.projekt)}</h1><div class="sub">${esc(item.kunde)} · ${esc(item.ort)}</div>
  <table>
  <tr><td>Kunde</td><td>${esc(item.kunde)}</td></tr>
  <tr><td>Adresse / Baustelle</td><td>${esc(item.adresse || item.ort)}</td></tr>
  <tr><td>Telefon</td><td>${esc(item.telefon)}</td></tr>
  <tr><td>E-Mail</td><td>${esc(item.email_kunde)}</td></tr>
  <tr><td>Termin</td><td>${esc(item.termin)}</td></tr>
  <tr><td>Verantwortlich</td><td>${esc(item.lead)}</td></tr>
  <tr><td>Mitarbeiter / Team</td><td>${esc(item.mitarbeiter)}</td></tr>
  <tr><td>Status</td><td>${esc(item.status)}</td></tr>
  <tr><td>PDF / Anhang</td><td>${esc(item.attachment_name)}</td></tr>
  <tr><td>Notiz / Besonderheiten</td><td class="note">${esc(item.notiz)}</td></tr>
  </table><div class="footer"><div><div class="sign">Montage / Produktion</div></div><div><div class="sign">Kontrolle / Freigabe</div></div></div><div class="actions">Über den Druckdialog kann dieser Auftrag als PDF gespeichert oder ausgedruckt werden.</div><script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`
  win.document.open(); win.document.write(html); win.document.close()
}


function KnowledgeBaseLive() {
  const [docs, setDocs] = useState([])
  const [kbSearch, setKbSearch] = useState('')
  const [category, setCategory] = useState('ALLE')
  const [title, setTitle] = useState('')
  const [docCategory, setDocCategory] = useState('Montage Akademie')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState(null)
  const [kbError, setKbError] = useState('')
  const [kbLoading, setKbLoading] = useState(false)

  const categories = ['Montage Akademie', 'Sicherheitsunterweisung', 'Aufmaß', 'Dokumente & Videos']

  const loadDocs = async () => {
    setKbLoading(true)
    const { data, error } = await supabase
      .from('knowledge_docs')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setKbError('Wissensdatenbank konnte nicht geladen werden: ' + error.message)
      setDocs([])
    } else {
      setKbError('')
      setDocs(data || [])
    }
    setKbLoading(false)
  }

  useEffect(() => { loadDocs() }, [])

  const saveDoc = async () => {
    if (!title.trim()) {
      setKbError('Bitte Titel eingeben.')
      return
    }

    setKbLoading(true)
    setKbError('')
    let finalUrl = url

    if (file) {
      const ext = file.name.split('.').pop() || 'bin'
      const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')
      const path = `knowledge/${Date.now()}_${safeName}`
      const { error: upErr } = await supabase.storage
        .from('uploads')
        .upload(path, file, { upsert: true, contentType: file.type || 'application/octet-stream' })

      if (upErr) {
        setKbError('Upload fehlgeschlagen: ' + upErr.message)
        setKbLoading(false)
        return
      }

      const { data } = supabase.storage.from('uploads').getPublicUrl(path)
      finalUrl = data.publicUrl
    }

    const { error } = await supabase.from('knowledge_docs').insert({
      title,
      category: docCategory,
      url: finalUrl,
      file_name: file?.name || '',
      type: file ? 'file' : 'link'
    })

    if (error) {
      setKbError('Speichern fehlgeschlagen: ' + error.message)
    } else {
      setTitle('')
      setUrl('')
      setFile(null)
      await loadDocs()
    }
    setKbLoading(false)
  }

  const filteredDocs = docs.filter(d => {
    const hay = [d.title, d.category, d.file_name, d.url].join(' ').toLowerCase()
    return (category === 'ALLE' || d.category === category) && (!kbSearch || hay.includes(kbSearch.toLowerCase()))
  })

  return (
    <div className="knowledge-live">
      <div className="hub-hero">
        <h2>GNANNT Wissensdatenbank</h2>
        <p>Montageanleitungen, Videos, Sicherheitsunterweisungen, Aufmaß-Vorlagen und interne Dokumente.</p>
      </div>

      <div className="kb-layout">
        <div className="kb-panel">
          <h3>Neuen Eintrag hinzufügen</h3>
          <input className="input" placeholder="Titel" value={title} onChange={e => setTitle(e.target.value)} />
          <select className="input" value={docCategory} onChange={e => setDocCategory(e.target.value)}>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
          <input className="input" placeholder="Video-Link oder externe URL optional" value={url} onChange={e => setUrl(e.target.value)} />
          <input className="input" type="file" accept="application/pdf,video/*,image/*" onChange={e => setFile(e.target.files?.[0] || null)} />
          {file && <div className="tiny">Datei ausgewählt: {file.name}</div>}
          {kbError && <div className="error">{kbError}</div>}
          <button className="btn primary full" onClick={saveDoc} disabled={kbLoading}>{kbLoading ? 'Speichert...' : 'Speichern'}</button>
        </div>

        <div className="kb-panel">
          <h3>Dokumente / Videos</h3>
          <div className="kb-filters">
            <input className="input" placeholder="Suchen..." value={kbSearch} onChange={e => setKbSearch(e.target.value)} />
            <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
              <option>ALLE</option>
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          {kbLoading && <div className="tiny">Lade Wissensdatenbank...</div>}
          {!kbLoading && filteredDocs.length === 0 && <div className="empty">Noch keine Einträge vorhanden.</div>}

          <div className="kb-list">
            {filteredDocs.map(doc => (
              <div className="kb-item" key={doc.id}>
                <div>
                  <strong>{doc.title}</strong>
                  <p>{doc.category} · {doc.file_name || doc.type || 'Link'}</p>
                </div>
                {doc.url && <a className="btn small outline" href={doc.url} target="_blank" rel="noreferrer">Öffnen</a>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}


function KnowledgeHubPage() {
  const sections = [
    { title: 'Montage Akademie', icon: '🛠️', text: 'Montageanleitungen, Videos, Checklisten und Standards für Monteure.', items: ['Fenstermontage Holz / Holz-Alu', 'Kunststofffenster Montage', 'Haustüren setzen und einstellen', 'HST Montage', 'Abdichtung innen / außen', 'Quellband und Montagematerial'] },
    { title: 'Sicherheitsunterweisung', icon: '🦺', text: 'Jährliche Unterweisungen, Baustellensicherheit, Maschinen, PSA und Nachweise.', items: ['PSA Pflicht', 'Leitern und Gerüste', 'Stapler / Transport', 'Maschinensicherheit', 'Gefahrstoffe', 'Unterweisungsnachweis'] },
    { title: 'Aufmaß', icon: '📏', text: 'Digitales Aufmaß, Fotos, PDF-Aufmaßblätter und Freigabeprozess.', items: ['Neues Aufmaß erfassen', 'Fotos zur Baustelle', 'Fenster / Tür / HST Felder', 'Kontrolle Ruben / Edmund', 'Produktionsfreigabe', 'PDF-Aufmaß exportieren'] },
    { title: 'Dokumente & Videos', icon: '📚', text: 'Zentrale Ablage für PDFs, Einbauvideos, Herstellerinformationen und interne Standards.', items: ['PDF Upload', 'Video Links', 'Montage Checklisten', 'Werkzeuglisten', 'Reklamationsvermeidung', 'Schulung neuer Mitarbeiter'] },
  ]
  return <div className="hub-page"><div className="hub-hero"><h2>GNANNT HUB</h2><p>Interne Plattform für Produktionsplanung, Montagewissen, Sicherheitsunterweisung und Aufmaß.</p></div><div className="hub-grid">{sections.map(s=><div className="hub-card" key={s.title}><div className="hub-icon">{s.icon}</div><h3>{s.title}</h3><p>{s.text}</p><ul>{s.items.map(i=><li key={i}>{i}</li>)}</ul></div>)}</div></div>
}

function Login({ username, setUsername, password, setPassword, onPlanerLogin, error, openScreen }) {
  return (
    <div className="login-page final-login">
      <section className="login-side">
        <div className="brand-block">
          <img src="/gnannt-logo.png" alt="Gnannt" className="login-logo" />
          <h1>Produktionsplanung</h1>
          <p>Produktion & Montage effizient planen und steuern</p>
        </div>

        <div className="login-card final-login-card">
          <h2>Anmelden</h2>
          <p className="login-copy">Bitte melden Sie sich an, um fortzufahren.</p>

          <label>Benutzername</label>
          <input
            className="input"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Benutzername eingeben"
            autoComplete="username"
          />

          <label>Passwort</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Passwort eingeben"
            autoComplete="current-password"
            onKeyDown={e => { if(e.key === 'Enter') onPlanerLogin() }}
          />

          {error && <div className="error">{error}</div>}

          <button className="btn primary full login-submit" onClick={onPlanerLogin}>Anmelden</button>
          <button className="screen-link" onClick={openScreen}>Produktionsscreen öffnen</button>
        </div>

        <footer>© 2026 Gnannt GmbH. Alle Rechte vorbehalten.</footer>
      </section>

      <section className="login-preview">
        <div className="preview-top">
          <img src="/gnannt-logo.png" alt="Gnannt" className="preview-logo" />
          <span>Produktionsplanung</span>
        </div>

        <div className="preview-grid">
          <div className="preview-card active">Übersicht</div>
          <div className="preview-card">Plantafel</div>
          <div className="preview-card">PDF Upload</div>
          <div className="preview-card">Kalender</div>
        </div>

        <div className="preview-content">
          <h2>Übersicht</h2>
          <p>Willkommen in der Gnannt Produktionsplanung.</p>
          <div className="preview-stats">
            <div><strong>4</strong><span>Bereiche</span></div>
            <div><strong>PDF</strong><span>Upload</span></div>
            <div><strong>Live</strong><span>Plantafel</span></div>
          </div>
          <div className="preview-upload">
            <strong>PDF Upload</strong>
            <p>PDF-Dateien direkt zum Auftrag hochladen.</p>
            <div className="upload-dummy">Datei auswählen</div>
          </div>
        </div>
      </section>
    </div>
  )
}

function ScreenLogin({ screenUser, setScreenUser, screenPassword, setScreenPassword, onScreenLogin, error }) {
  return (
    <div className="screen-login-page">
      <div className="screen-login-card">
        <img src="/gnannt-logo.png" alt="Gnannt" className="screen-login-logo" />
        <h1>Produktionsscreen</h1>
        <p>Bitte anmelden, um den Hallenmodus zu öffnen.</p>

        <label>Benutzername</label>
        <input
          className="input"
          value={screenUser}
          onChange={e => setScreenUser(e.target.value)}
          placeholder="Benutzername eingeben"
          autoComplete="username"
        />

        <label>Passwort</label>
        <input
          className="input"
          type="password"
          value={screenPassword}
          onChange={e => setScreenPassword(e.target.value)}
          placeholder="Passwort eingeben"
          autoComplete="current-password"
          onKeyDown={e => { if(e.key === 'Enter') onScreenLogin() }}
        />

        {error && <div className="error">{error}</div>}

        <button className="btn primary full login-submit" onClick={onScreenLogin}>Screen öffnen</button>
      </div>
    </div>
  )
}

function Modal({ open, close, children }) {
  if (!open) return null
  return <div className="modal-bg"><div className="modal"><button className="close" onClick={close}><X size={18}/></button>{children}</div></div>
}

function Form({ form, setForm, save, saving, upload, uploading, pendingFile, setPendingFile }) {
  const set = (k, v) => setForm({ ...form, [k]: v })
  return (
    <div>
      <h2>Auftrag anlegen / bearbeiten</h2>
      <div className="form-grid">
        <input className="input" placeholder="Projekt" value={form.projekt || ''} onChange={e => set('projekt', e.target.value)} />
        <input className="input" placeholder="Kunde" value={form.kunde || ''} onChange={e => set('kunde', e.target.value)} />
        <input className="input" placeholder="Adresse / Baustelle" value={form.adresse || ''} onChange={e => set('adresse', e.target.value)} />
        <input className="input" placeholder="Ort" value={form.ort || ''} onChange={e => set('ort', e.target.value)} />
        <input className="input" placeholder="Telefon Kunde" value={form.telefon || ''} onChange={e => set('telefon', e.target.value)} />
        <input className="input" placeholder="E-Mail Kunde" value={form.email_kunde || ''} onChange={e => set('email_kunde', e.target.value)} />
        <select className="input" value={form.lead || 'Edmund'} onChange={e => set('lead', e.target.value)}>{EMPLOYEES.map(x => <option key={x}>{x}</option>)}</select>
        <select className="input" value={form.status || 'AUFMASS'} onChange={e => set('status', e.target.value)}>{ALL_STATUS.map(x => <option key={x}>{x}</option>)}</select>
        <input className="input" placeholder="Mitarbeiter / Team" value={form.mitarbeiter || ''} onChange={e => set('mitarbeiter', e.target.value)} />
        <input className="input" type="date" value={form.termin || ''} onChange={e => set('termin', e.target.value)} />
        <textarea className="input textarea" placeholder="Notiz / Besonderheiten" value={form.notiz || ''} onChange={e => set('notiz', e.target.value)} />
      </div>
      <div className="upload-box">
        <strong><Upload size={16}/> PDF hochladen</strong>
        <input className="input" type="file" accept="application/pdf" onChange={e => {
          const file = e.target.files?.[0]
          if (!file) return
          if (form.id) upload(file)
          else setPendingFile(file)
        }} />
        {pendingFile && !form.id && <p className="tiny">PDF vorgemerkt: {pendingFile.name}. Wird nach dem Speichern hochgeladen.</p>}
        {form.attachment_url && <a className="btn small outline" href={form.attachment_url} target="_blank">PDF öffnen</a>}
        {uploading && <p>Datei wird hochgeladen...</p>}
      </div>
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
function Uploads({ items, edit }) { return <div className="panel"><h3><Upload/> PDF Uploads</h3>{items.map(x => <div className="row bigrow" key={x.id}><div><strong>{x.projekt}</strong><p>{x.attachment_name || 'Noch kein PDF'}</p></div><div className="row-actions">{x.attachment_url && <a className="btn small outline" href={x.attachment_url} target="_blank">Öffnen</a>}<button className="btn small outline" onClick={() => edit(x)}>Bearbeiten</button></div></div>)}</div> }
function Team({ user, items }) { const ruben = items.filter(x => x.status === 'MONTAGE' || x.lead === 'Ruben'); return <div className="stack"><div className="two"><div className="panel"><h3><Users/> Mitarbeiter Login</h3><p>Aktuell: <strong>{user?.email || '-'}</strong></p><p>Rolle: <strong>{user?.role || 'user'}</strong></p></div><div className="panel"><h3><FolderOpen/> Ruben App</h3><p>Relevante Montageprojekte: <strong>{ruben.length}</strong></p></div></div><div className="grid">{ruben.map(x => <Card key={x.id} item={x} compact />)}</div></div> }

export default function App() {
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState(window.location.hash === PUBLIC_SCREEN_HASH ? 'screen' : 'planung')
  const [filterLead, setFilterLead] = useState('ALLE')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [online, setOnline] = useState(navigator.onLine)
  const [syncing, setSyncing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pendingFile, setPendingFile] = useState(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [screenUser, setScreenUser] = useState('')
  const [screenPassword, setScreenPassword] = useState('')
  const [screenUnlocked, setScreenUnlocked] = useState(() => sessionStorage.getItem('gnannt_screen_unlocked') === '1')
  const [localUser, setLocalUser] = useState(null)
  const [loginError, setLoginError] = useState('')
  const [loginInfo, setLoginInfo] = useState('')
  const [user, setUser] = useState(null)
  const [dragged, setDragged] = useState(null)
  const screenRef = useRef(null)
  const autoScrollTimerRef = useRef(null)
  const autoScrollResumeRef = useRef(null)
  const autoReloadRef = useRef(null)
  const [now, setNow] = useState(new Date())

  const isScreen = window.location.hash === PUBLIC_SCREEN_HASH
  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setError('Supabase Fehler beim Laden: ' + error.message)
      setConnected(false)
      setItems([])
    } else {
      setError('')
      setConnected(true)
      setItems(data || [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const goOnline = () => { setOnline(true); syncQueue() }
    const goOffline = () => { setOnline(false); setConnected(false); setError('Offline-Modus aktiv. Änderungen werden später synchronisiert.') }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline) }
  }, [])
  useEffect(() => { supabase.auth.getSession().then(({ data }) => { if (data.session?.user) setUser({ email: data.session.user.email, role: 'user' }) }); const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ? { email: session.user.email, role: 'user' } : null)); return () => data.subscription.unsubscribe() }, [])
  useEffect(() => { const channel = supabase.channel('projects-live').on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => load()).subscribe(s => setConnected(s === 'SUBSCRIBED')); return () => supabase.removeChannel(channel) }, [])
  useEffect(() => { const onHash = () => { if (window.location.hash === PUBLIC_SCREEN_HASH) setTab('screen') }; window.addEventListener('hashchange', onHash); return () => window.removeEventListener('hashchange', onHash) }, [])
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer) }, [])

  useEffect(() => {
    if (tab !== 'screen') return

    const el = screenRef.current
    if (!el) return

    const clearAutoScroll = () => {
      if (autoScrollTimerRef.current) {
        clearInterval(autoScrollTimerRef.current)
        autoScrollTimerRef.current = null
      }
    }

    const clearResume = () => {
      if (autoScrollResumeRef.current) {
        clearTimeout(autoScrollResumeRef.current)
        autoScrollResumeRef.current = null
      }
    }

    const startAutoScroll = () => {
      clearAutoScroll()
      autoScrollTimerRef.current = setInterval(() => {
        const maxScroll = el.scrollHeight - el.clientHeight

        if (maxScroll <= 8) return

        if (el.scrollTop >= maxScroll - 3) {
          clearAutoScroll()
          setTimeout(() => {
            el.scrollTo({ top: 0, behavior: 'smooth' })
            setTimeout(startAutoScroll, 2500)
          }, 2200)
          return
        }

        el.scrollBy({ top: 1, behavior: 'auto' })
      }, 34)
    }

    const pauseAutoScroll = () => {
      clearAutoScroll()
      clearResume()
      autoScrollResumeRef.current = setTimeout(() => {
        startAutoScroll()
      }, 30000)
    }

    startAutoScroll()

    el.addEventListener('wheel', pauseAutoScroll, { passive: true })
    el.addEventListener('touchstart', pauseAutoScroll, { passive: true })
    el.addEventListener('pointerdown', pauseAutoScroll)
    el.addEventListener('scroll', () => {}, { passive: true })

    autoReloadRef.current = setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        load()
      }
    }, 10 * 60 * 1000)

    return () => {
      clearAutoScroll()
      clearResume()
      if (autoReloadRef.current) clearInterval(autoReloadRef.current)
      el.removeEventListener('wheel', pauseAutoScroll)
      el.removeEventListener('touchstart', pauseAutoScroll)
      el.removeEventListener('pointerdown', pauseAutoScroll)
    }
  }, [tab, active.length, items.length])


  const filtered = useMemo(() => items.filter(x => { const text = [x.projekt,x.kunde,x.adresse,x.telefon,x.email_kunde,x.ort,x.gewerk,x.lead,x.status,x.notiz,x.mitarbeiter].join(' ').toLowerCase(); return (!search || text.includes(search.toLowerCase())) && (filterLead === 'ALLE' || x.lead === filterLead) }), [items, search, filterLead])
  const active = filtered.filter(x => x.status !== 'ERLEDIGT')
  const archived = filtered.filter(x => x.status === 'ERLEDIGT')
  const grouped = STATUS_ORDER.map(s => ({ status: s, items: active.filter(x => x.status === s) }))
  const screenLogin = () => {
    setLoginError('')
    if (screenUser.trim() === 'Screen' && screenPassword === 'Produktion') {
      sessionStorage.setItem('gnannt_screen_unlocked', '1')
      setScreenUnlocked(true)
      return
    }
    setLoginError('Benutzername oder Passwort ist falsch.')
  }

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
  const syncQueue = async () => {
    const q = readQueue()
    if (!q.length || !navigator.onLine) return
    setSyncing(true)
    const remaining = []
    for (const op of q) {
      try {
        if (op.type === 'insert') {
          const payload = { ...op.payload }
          delete payload.__offline
          delete payload.offline_id
          const { error } = await supabase.from('projects').insert(payload)
          if (error) remaining.push(op)
        } else if (op.type === 'update') {
          const payload = { ...op.payload }
          delete payload.__offline
          delete payload.offline_id
          const { error } = await supabase.from('projects').update(payload).eq('id', op.id)
          if (error) remaining.push(op)
        }
      } catch {
        remaining.push(op)
      }
    }
    writeQueue(remaining)
    await load()
    setSyncing(false)
    if (!remaining.length) setError('')
  }

  const save = async () => {
    if (!form.projekt?.trim()) {
      setError('Bitte mindestens Projekt eintragen.')
      return
    }

    setSaving(true)
    setError('')

    const payload = toDbProject(form)
    let result
    let savedId = form.id

    if (form.id && !String(form.id).startsWith('offline_')) {
      result = await supabase
        .from('projects')
        .update(payload)
        .eq('id', form.id)
        .select()
        .single()
    } else {
      result = await supabase
        .from('projects')
        .insert(payload)
        .select()
        .single()
      savedId = result.data?.id
    }

    if (result.error) {
      setError('Speichern fehlgeschlagen: ' + result.error.message)
      setSaving(false)
      return
    }

    if (pendingFile && savedId) {
      await upload(pendingFile, savedId)
    }

    setModal(false)
    setForm(EMPTY)
    setPendingFile(null)
    await load()
    setSaving(false)
  }

  const edit = (item) => { setForm({ ...EMPTY, ...item }); setModal(true) }
  const updateStatus = async (id, status) => {
    setError('')
    const { error } = await supabase
      .from('projects')
      .update({ status })
      .eq('id', id)

    if (error) {
      setError('Status konnte nicht gespeichert werden: ' + error.message)
      return
    }

    await load()
  }

  const upload = async (file, projectId = form.id) => {
    if (!file || !projectId) return false

    setUploading(true)
    setError('')

    const ext = file.name.split('.').pop() || 'pdf'
    const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')
    const path = `projects/${projectId}_${Date.now()}_${safeName}`

    const { error: upErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type || 'application/pdf' })

    if (upErr) {
      setError('PDF Upload fehlgeschlagen: ' + upErr.message)
      setUploading(false)
      return false
    }

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)

    const { error: dbErr } = await supabase
      .from('projects')
      .update({ attachment_name: file.name, attachment_url: data.publicUrl })
      .eq('id', projectId)

    if (dbErr) {
      setError('PDF Link konnte nicht gespeichert werden: ' + dbErr.message)
      setUploading(false)
      return false
    }

    setForm(p => ({ ...p, attachment_name: file.name, attachment_url: data.publicUrl }))
    setPendingFile(null)
    await load()
    setUploading(false)
    return true
  }

  const openScreen = () => { window.location.hash = PUBLIC_SCREEN_HASH; setTab('screen') }
  const openBoard = () => { window.location.hash = ''; setTab('planung') }
  const full = async () => { try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen() } catch {} }

  if (isScreen && !screenUnlocked) return <ScreenLogin screenUser={screenUser} setScreenUser={setScreenUser} screenPassword={screenPassword} setScreenPassword={setScreenPassword} onScreenLogin={screenLogin} error={loginError} />
  const screenDateText = now.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
  const screenTimeText = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

  if (!user && !isScreen) return <Login username={username} setUsername={setUsername} password={password} setPassword={setPassword} onPlanerLogin={planerLogin} error={loginError} openScreen={openScreen} />
  if (tab === 'screen') return <div className="screen"><div className="screen-top"><div className="screen-brand"><img src="/gnannt-logo.png" alt="Gnannt" /><div><h1>Gnannt Produktionsplanung</h1><p>Offene Projekte: {active.length}</p></div></div><div className="screen-actions"><div className="screen-clock"><strong>{screenDateText}</strong><span>{screenTimeText}</span></div><span className={connected ? 'live on' : 'live off'}><Cloud size={14}/>{connected ? 'Live' : 'Offline'}</span><button className="btn screenbtn icon-only" title="Screen sperren" onClick={() => { sessionStorage.removeItem('gnannt_screen_unlocked'); setScreenUnlocked(false); setScreenPassword('') }}><LogOut size={18}/></button><button className="btn screenbtn icon-only" title="Plantafel" onClick={openBoard}><Monitor size={18}/></button><button className="btn screenbtn icon-only" title="Vollbild" onClick={full}><Maximize size={18}/></button></div></div><div ref={screenRef} className="screen-scroll">{loading ? <div className="screen-empty">Lade Daten...</div> : active.length ? active.map(x => <Card key={x.id} item={x} compact dark />) : <div className="screen-empty">Keine offenen Projekte.</div>}</div></div>
  return <div className="app"><div className="shell"><header><div className="board-brand"><img src="/gnannt-logo.png" alt="Gnannt" /><div><h1>Gnannt Produktionsplanung</h1><p>Produktion & Montage</p></div></div><div className="header-actions"><span className={online ? 'online-pill on' : 'online-pill off'}>{online ? (syncing ? 'Sync läuft' : 'Online') : 'Offline'}</span><button className="btn outline" onClick={() => { load(); syncQueue() }}><RefreshCw size={16}/> Neu laden</button><button className="btn outline" onClick={openScreen}><Monitor size={16}/> Screen</button><button className="btn outline" onClick={logout}><LogOut size={16}/> Abmelden</button><button className="btn primary" onClick={() => { setForm(EMPTY); setPendingFile(null); setModal(true) }}><Plus size={16}/> Neuer Auftrag</button></div></header><div className="stats stats-two"><div className="stat"><p>Offene Projekte</p><strong>{active.length}</strong></div><div className="stat"><p>Datenstatus</p><span><Cloud size={16}/> {online ? (syncing ? 'Synchronisiere...' : (connected ? 'Supabase live verbunden' : 'Online / Verbindung wird geprüft')) : 'Offline-Modus'}</span>{error && <small className="error">{error}</small>}</div></div><div className="toolbar"><div className="search"><Search size={18}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suche nach Projekt, Kunde, Ort oder Verantwortlichem..." /></div><select value={filterLead} onChange={e => setFilterLead(e.target.value)}><option>ALLE</option>{EMPLOYEES.map(x => <option key={x}>{x}</option>)}</select></div><nav>{['planung','hub','dashboard','kalender','uploads','ruben','team'].map(t => <button key={t} className={tab===t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}</nav>{loading ? <div className="panel center">Lade Projekte...</div> : tab === 'planung' ? <div className="stack">{grouped.map(g => <div key={g.status} className="panel" onDragOver={e => e.preventDefault()} onDrop={() => dragged && updateStatus(dragged, g.status)}><div className="panel-head"><h3>{g.status}</h3><span className={badgeClass(g.status)}>{g.items.length}</span></div><p className="tiny">Drag & Drop zwischen Statusbereichen aktiv</p><div className="grid">{g.items.length ? g.items.map(x => <Card key={x.id} item={x} onEdit={edit} onStatus={updateStatus} draggable onDragStart={() => setDragged(x.id)} />) : <div className="empty">Keine offenen Projekte</div>}</div></div>)}{archived.length > 0 && <div className="panel"><h3>Archiv</h3><div className="grid">{archived.map(x => <Card key={x.id} item={x} onEdit={edit} onStatus={updateStatus}/>)}</div></div>}</div> : tab === 'hub' ? <KnowledgeBaseLive/> : tab === 'dashboard' ? <Dashboard active={active} archived={archived}/> : tab === 'kalender' ? <Calendar items={active} edit={edit}/> : tab === 'uploads' ? <Uploads items={items} edit={edit}/> : <Team user={user} items={tab === 'ruben' ? items.filter(x => x.status === 'MONTAGE' || x.lead === 'Ruben') : items}/>}<Modal open={modal} close={() => setModal(false)}><Form form={form} setForm={setForm} save={save} saving={saving} upload={upload} uploading={uploading} pendingFile={pendingFile} setPendingFile={setPendingFile} /></Modal></div></div>
}
