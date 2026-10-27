import {useCallback,useEffect,useRef,useState} from 'react'
import {Plus,X,Search} from 'lucide-react'
import {hubCategories,hubCategory,hubEntryCategories,hubDocumentSections,hubDocumentSystems,groupedHubDocuments} from './hubCategories.mjs'
const documentUrl=url=>{try{const parsed=new URL(url);return ['http:','https:'].includes(parsed.protocol)?parsed.href:null}catch{return null}}
const dateLabel=date=>date?new Date(date).toLocaleDateString('de-DE',{timeZone:'Europe/Berlin'}):''
export default function KnowledgeBaseLive({supabase}) {
  const [docs,setDocs]=useState([]),[search,setSearch]=useState(''),[category,setCategory]=useState('ALLE')
  const [section,setSection]=useState('ALLE'),[system,setSystem]=useState('ALLE')
  const [title,setTitle]=useState(''),[docCategory,setDocCategory]=useState(''),[url,setUrl]=useState(''),[file,setFile]=useState(null)
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[loadError,setLoadError]=useState(''),[saveError,setSaveError]=useState(''),[notice,setNotice]=useState('')
  const [composer,setComposer]=useState(false),dialogRef=useRef(null),fileRef=useRef(null)
  const categories=hubCategories(docs),entryCategories=hubEntryCategories(docs),sections=hubDocumentSections(docs),systems=hubDocumentSystems(docs,section),groups=groupedHubDocuments(docs,category,search,section,system)
  const selectCategory=value=>{setCategory(value);setSection('ALLE');setSystem('ALLE')}
  const loadDocs=useCallback(async()=>{
    setLoading(true);setLoadError('')
    try{const {data,error}=await supabase.from('knowledge_docs').select('*').order('created_at',{ascending:false});if(error)throw error;setDocs(data||[])}catch(e){setLoadError('Wissensdatenbank konnte nicht geladen werden: '+e.message)}finally{setLoading(false)}
  },[supabase])
  useEffect(()=>{loadDocs()},[loadDocs])
  useEffect(()=>{const dialog=dialogRef.current;if(composer&&!dialog.open)dialog.showModal();if(!composer&&dialog.open)dialog.close()},[composer])
  const openComposer=(selected=category==='Dokumente & Videos'&&section!=='ALLE'?category+' / '+section+(system!=='ALLE'?' / '+system:''):category)=>{setDocCategory(selected==='ALLE'?'':selected);setSaveError('');setNotice('');setComposer(true)}
  const saveDoc=async event=>{
    event.preventDefault();if(saving||!title.trim()||!docCategory)return
    setSaving(true);setSaveError('')
    try{
      let finalUrl=url.trim(),finalFileName=''
      if(finalUrl&&!documentUrl(finalUrl))throw Error('Bitte einen vollständigen http- oder https-Link eingeben.')
      if(file){const safeName=file.name.replace(/[^a-zA-Z0-9_.-]/g,'_');const path=`knowledge/${crypto.randomUUID()}_${safeName}`;const {error}=await supabase.storage.from('uploads').upload(path,file,{upsert:false,contentType:file.type||'application/octet-stream'});if(error)throw Error('Upload fehlgeschlagen: '+error.message);const {data}=supabase.storage.from('uploads').getPublicUrl(path);finalUrl=data.publicUrl;finalFileName=file.name}
      const {error}=await supabase.from('knowledge_docs').insert({title:title.trim(),category:docCategory,type:file?'file':'link',file_name:finalFileName,url:finalUrl});if(error)throw error
      setTitle('');setUrl('');setFile(null);if(fileRef.current)fileRef.current.value='';setCategory(docCategory.split(' / ')[0]);setSection(docCategory.split(' / ')[1]||'ALLE');setSystem(docCategory.split(' / ').slice(2).join(' / ')||'ALLE');setSearch('');setComposer(false);setNotice('Eintrag in „'+docCategory+'“ gespeichert.');await loadDocs()
    }catch(e){setSaveError('Speichern fehlgeschlagen: '+e.message)}finally{setSaving(false)}
  }
  return <section className="knowledge-live" aria-label="Gnannt Hub">
    <div className="hub-quickbar"><div><h2>GNANNT HUB</h2><p>Erst den Bereich wählen. Direkt finden oder hinzufügen.</p></div><button className="btn primary" onClick={()=>openComposer()}><Plus size={18}/> Hinzufügen</button></div>
    <div className="hub-category-picker" role="group" aria-label="Hub-Kategorien"><button className={'hub-category-choice hub-category-all'+(category==='ALLE'?' selected':'')} aria-pressed={category==='ALLE'} onClick={()=>selectCategory('ALLE')}><span>Alle Bereiche</span><strong>{docs.length}</strong></button>{categories.map(c=><button className={'hub-category-choice'+(category===c.title?' selected':'')} key={c.title} aria-pressed={category===c.title} onClick={()=>selectCategory(c.title)}><span><span aria-hidden="true">{c.icon}</span> {c.title}</span><strong>{docs.filter(doc=>hubCategory(doc)===c.title).length}</strong></button>)}</div>
    {category==='Dokumente & Videos'&&<div className="hub-document-filters"><label>Dokumentbereich<select className="input" value={section} onChange={e=>{setSection(e.target.value);setSystem('ALLE')}}><option value="ALLE">Alle Dokumentbereiche</option>{sections.map(name=><option key={name}>{name}</option>)}</select></label>{systems.length>0&&<label>System / Unterkategorie<select className="input" value={system} onChange={e=>setSystem(e.target.value)}><option value="ALLE">Alle Systeme</option>{systems.map(name=><option key={name}>{name}</option>)}</select></label>}</div>}
    <div className="hub-searchbar"><label><Search size={18}/><span className="sr-only">Hub durchsuchen</span><input className="input" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Titel, Datei oder Link suchen…"/></label><span>{category==='ALLE'?'Alle Kategorien':category} · {groups.reduce((n,g)=>n+g.documents.length,0)} Einträge</span></div>
    {notice&&<p className="hub-notice" role="status">{notice}</p>}
    {loading&&<p role="status">Hub wird geladen…</p>}
    {loadError&&<div className="error" role="alert">{loadError}<button className="btn outline" onClick={loadDocs}>Erneut laden</button></div>}
    {!loading&&!loadError&&!groups.length&&<div className="kb-panel"><h3>{search?'Keine passenden Einträge':category==='ALLE'?'Noch keine Einträge':category}</h3><p>{search?'Suche ändern oder einen anderen Bereich wählen.':'Füge den ersten Link oder eine Datei hinzu.'}</p><button className="btn primary" onClick={()=>openComposer()}><Plus size={16}/> Eintrag hinzufügen</button></div>}
    {groups.map(group=><section className="kb-panel hub-document-group" key={group.title} aria-label={group.title}><div className="kb-title-row"><h3>{group.icon} {group.title.replace('Dokumente & Videos / ','')} <span className="hub-group-count">{group.documents.length}</span></h3><button className="btn small outline" onClick={()=>openComposer(group.title)}><Plus size={16}/> Hier hinzufügen</button></div><div className="kb-list">{group.documents.map(doc=><article className="kb-item" key={doc.id}><div><strong>{doc.title}</strong><p>{[dateLabel(doc.created_at),doc.file_name||(doc.type==='file'?'Datei':'Link')].filter(Boolean).join(' · ')}</p></div>{documentUrl(doc.url)?<a className="btn small outline" href={documentUrl(doc.url)} target="_blank" rel="noreferrer">Öffnen ↗</a>:<span className="tiny">Kein Link hinterlegt</span>}</article>)}</div></section>)}
    <dialog ref={dialogRef} className="hub-composer" aria-labelledby="hub-composer-title" onCancel={event=>{if(saving)event.preventDefault();else setComposer(false)}} onClose={()=>setComposer(false)}>
      <form onSubmit={saveDoc}><div className="hub-composer-head"><div><p>GNANNT HUB</p><h2 id="hub-composer-title">Neuen Eintrag hinzufügen</h2></div><button type="button" className="btn outline" aria-label="Schließen" disabled={saving} onClick={()=>setComposer(false)}><X size={18}/></button></div>
        <fieldset disabled={saving}><label>1. Kategorie wählen<select className="input" autoFocus required value={docCategory} onChange={e=>setDocCategory(e.target.value)}><option value="" disabled>Bereich auswählen…</option>{entryCategories.map(name=><option key={name}>{name}</option>)}</select></label>
        <div className="hub-composer-fields"><label>2. Titel<input className="input" required disabled={!docCategory} value={title} onChange={e=>setTitle(e.target.value)} placeholder="z. B. Haustür richtig einstellen"/></label><label>Video-Link oder externe URL <span>optional</span><input className="input" type="url" disabled={!docCategory} value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://…"/></label><label>PDF, Video oder Bild <span>optional</span><input className="input" ref={fileRef} type="file" disabled={!docCategory} accept="application/pdf,video/*,image/*" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>{file&&<p className="tiny">Datei ausgewählt: {file.name}</p>}</div></fieldset>
        {saveError&&<p className="error" role="alert">{saveError}</p>}<div className="hub-composer-actions"><button type="button" className="btn outline" disabled={saving} onClick={()=>setComposer(false)}>Abbrechen</button><button className="btn primary" disabled={saving||!docCategory||!title.trim()}>{saving?'Speichert…':'Eintrag speichern'}</button></div>
      </form>
    </dialog>
  </section>
}
