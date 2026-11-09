import {useRef,useState} from 'react'
export const isPrivateDocument = doc => typeof doc?.url === 'string' && (doc.url.startsWith('gnannt-private:') || /^https:\/\/xhpwmebwvjpdhsjeyrug\.supabase\.co\/storage\/v1\/object\/public\/uploads\/(knowledge|projects)\//.test(doc.url))
export default function PrivateDocumentButton({doc,download,className}) {
 const lock=useRef(false)
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 async function open(){
  if(lock.current)return
  lock.current=true
  setBusy(true);setError('')
  try{
   if(typeof download!=='function')throw Error('Bitte im Portal anmelden und erneut versuchen.')
   const blob=await download(doc.id)
   if(!(blob instanceof Blob)||!blob.size||!(/^(application\/pdf|application\/octet-stream|image\/[a-z0-9.+-]+|video\/[a-z0-9.+-]+)(;|$)/i.test(blob.type)))throw Error('Ungültige Dokumentantwort.')
   const url=URL.createObjectURL(blob),a=document.createElement('a')
   a.href=url;a.download=doc.file_name||'Dokument';document.body.append(a);a.click();a.remove()
   setTimeout(()=>URL.revokeObjectURL(url),60000)
  }catch(e){setError(e.message||'Dokument konnte nicht geladen werden.')}finally{lock.current=false;setBusy(false)}
 }
 return <div><button type="button" className={className} disabled={busy} onClick={open}>{busy?'Datei wird geladen…':'Herunterladen'}</button>{error&&<p role="alert">{error}</p>}</div>
}

export function ProjectDocument({project,download,className}) {
 const doc={id:project.id,url:project.attachment_url,file_name:project.attachment_name}
 if(!doc.url)return null
 if(isPrivateDocument(doc))return <PrivateDocumentButton doc={doc} download={download} className={className}/>
 try{const url=new URL(doc.url);if(!['http:','https:'].includes(url.protocol))return null;return <a className={className} href={url.href} target="_blank" rel="noreferrer">Projekt-PDF öffnen</a>}catch{return null}
}
