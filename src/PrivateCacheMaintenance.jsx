import {useRef,useState} from 'react'

export default function PrivateCacheMaintenance({purge}) {
  const lock=useRef(false)
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('')
  if(typeof purge!=='function')return null
  async function clear(){
    if(lock.current)return
    lock.current=true;setBusy(true);setMessage('')
    try{
      const result=await purge()
      if(result.error||!result.data?.purged)throw Error(result.error?.message||'Cache konnte nicht geleert werden.')
      setMessage('Öffentliche Server-Caches werden geleert. Die Verteilung kann bis zu 60 Sekunden dauern. Bereits heruntergeladene Kopien bleiben beim Empfänger.')
    }catch(error){setMessage(error.message||'Cache konnte nicht geleert werden.')}
    finally{lock.current=false;setBusy(false)}
  }
  return <details className="kb-panel"><summary>Schutz früher öffentlicher Dateien</summary><p>Alte öffentliche Server-Caches leeren. Alle Originaldateien bleiben erhalten und sind weiterhin nach Anmeldung abrufbar.</p><button type="button" className="btn outline" disabled={busy} onClick={clear}>{busy?'Cache wird geleert…':'Öffentliche Datei-Caches leeren'}</button>{message&&<p role="status">{message}</p>}</details>
}
