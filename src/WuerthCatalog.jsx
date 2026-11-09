import { useEffect, useRef, useState } from 'react'
import { ShieldCheck, LockKeyhole, PackageSearch, ArrowRight } from 'lucide-react'
import {createWuerthClient,submitWuerthForm} from './wuerthClient.mjs'
import './wuerthCatalog.css'

// Live launch remains unavailable until the dedicated OCI credential has been
// configured securely and the server-side session/callback integration tested.
// Never collect a Würth password or put customer prices into browser storage.
export default function WuerthCatalog({plannerSession=''}) {
  const generation=useRef(0)
  const popupRef=useRef(null)
  const ownerRef=useRef(plannerSession)
  const [details, setDetails] = useState(false)
  const [connected,setConnected]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [sessionId,setSessionId]=useState(()=>new URLSearchParams(globalThis.location?.search||'').get('oci_session')||'')
  const [cart,setCart]=useState(null)
  const [waiting,setWaiting]=useState(false)
  useEffect(()=>{
    ++generation.current;let active=true;setConnected(false);setCart(null);setError('');setWaiting(false);setBusy(false)
    if(ownerRef.current!==plannerSession){setSessionId('');ownerRef.current=plannerSession}
    if(plannerSession)createWuerthClient(plannerSession)({action:'status'}).then(result=>{if(active)setConnected(result.configured===true)}).catch(()=>{if(active)setError('Verbindungsstatus konnte nicht geladen werden. Bitte erneut prüfen.')})
    return()=>{active=false;++generation.current;if(popupRef.current){try{popupRef.current.close()}catch{}popupRef.current=null}}
  },[plannerSession])
  async function refresh(){
    const version=generation.current
    setBusy(true);setError('')
    try{const result=await createWuerthClient(plannerSession)({action:sessionId?'result':'status',...(sessionId?{id:sessionId}:{})});if(version!==generation.current)return;if(sessionId){setCart(result.cart);setWaiting(result.status==='pending')}else setConnected(result.configured===true)}catch(e){if(version===generation.current)setError(e.message)}finally{if(version===generation.current)setBusy(false)}
  }
  async function open(){
    if(busy||!connected)return
    if(popupRef.current&&!popupRef.current.closed){popupRef.current.focus();return}
    const popup=window.open('about:blank','_blank','popup,width=1440,height=1000')
    if(!popup){setError('Bitte Pop-ups für dieses Portal zulassen.');return}
    const version=generation.current;popupRef.current=popup
    setBusy(true);setError('');setCart(null);setWaiting(false)
    try{const result=await createWuerthClient(plannerSession)({action:'launch'});if(version!==generation.current){popup.close();return}submitWuerthForm(popup,result.launch);setSessionId(result.id);setWaiting(true)}catch(e){popup.close();if(version===generation.current)setError(e.message)}finally{if(version===generation.current)setBusy(false)}
  }
  return <section className="wu-catalog" aria-labelledby="wu-title">
    <div className="wu-hero">
      <div className="wu-eyebrow">WÜRTH · EINKAUF & MATERIAL</div>
      <h2 id="wu-title">Eure Produkte. Eure Preise.</h2>
      <p>Der Würth-Katalog direkt aus dem Gnannt-Portal. Zum Start nur Artikel und persönliche Preise ansehen, ohne Bestellung.</p>
      <div className="wu-mode"><ShieldCheck size={18} aria-hidden="true"/> Katalogmodus · Keine Bestellung aus diesem Portal</div>
    </div>
    <div className="wu-layout">
      <div className="wu-panel">
        <div className="wu-icon"><PackageSearch size={28} aria-hidden="true"/></div>
        <h3>Würth-Katalog verbinden</h3>
        <p>{connected?'Der OCI-Zugang ist eingerichtet. Öffne den Katalog, um eure Konditionen direkt bei Würth anzusehen.':'Die OCI-Anbindung ist vorbereitet. Für den Zugriff auf eure vereinbarten Preise fehlt noch die sichere Einrichtung und Freischaltung des eigenen OCI-Zugangs.'}</p>
        <div className="wu-status" role="status"><span aria-hidden="true"/> {connected?'OCI-Zugang eingerichtet':'Noch nicht verbunden'}</div>
        <button type="button" className="wu-connect" disabled={!connected||busy} onClick={connected?open:undefined} aria-describedby="wu-blocker"><LockKeyhole size={17} aria-hidden="true"/> Katalog öffnen</button>
        <p id="wu-blocker" className="wu-small">{connected?'Der Katalog öffnet in einem eigenen Fenster. Die Rückgabe führt ins Portal; es wird keine Bestellung ausgelöst.':'Sobald der OCI-Zugang eingerichtet und geprüft ist, wird der Katalog hier freigeschaltet. Es werden noch keine Live-Preise angezeigt.'}</p>
        {plannerSession&&<button type="button" className="wu-details-button" disabled={busy} onClick={refresh}>{sessionId?'Auswahl abrufen':'Verbindung prüfen'}</button>}
        {waiting&&<p role="status">Noch keine Auswahl zurückgegeben. Im Würth-Katalog die Rückgabe an das Portal wählen, danach hier die Auswahl abrufen.</p>}
        {error&&<p role="alert">{error}</p>}
      </div>
      <div className="wu-panel wu-steps">
        <h3>So funktioniert die Anbindung</h3>
        <ol>
          <li><strong>Katalog öffnen</strong><span>Mit eurem eigenen Würth-OCI-Zugang.</span></li>
          <li><strong>Artikel und Preise ansehen</strong><span>Eure Konditionen direkt im Würth-Katalog prüfen.</span></li>
          <li><strong>Auswahl zurückholen</strong><span>Artikel als Katalogvorschau ins Portal übernehmen. Keine Bestellung.</span></li>
        </ol>
        <button type="button" className="wu-details-button" aria-expanded={details} aria-controls="wu-setup-details" onClick={() => setDetails(value => !value)}>{details ? 'Details ausblenden' : 'Was fehlt noch?'}<ArrowRight size={16} aria-hidden="true"/></button>
        {details && <div id="wu-setup-details" className="wu-details">
          <p>Die Bestellauslösung wurde nach eurer Rückmeldung bei Würth deaktiviert.</p>
          <p>Benötigt wird jetzt der separate OCI-Zugang, nicht das normale Shop-Login. Das Passwort wird ausschließlich über einen sicheren Einrichtungsweg hinterlegt, nicht hier im Portal oder im Chat.</p>
          <p>Danach prüfen wir Anmeldung, persönliche Preise und die Rückgabe der Auswahl, ohne eine Bestellung auszulösen.</p>
        </div>}
      </div>
    </div>
    {cart&&<section className="wu-panel" aria-label="Katalogvorschau"><h3>Deine Katalogauswahl</h3><p>Unbestätigte Katalogvorschau · Keine Bestellung. Preise beziehen sich auf die angezeigte Preiseinheit.</p><div className="wu-cart-list">{cart.items?.map(item=><article key={item.index}><strong>{item.description}</strong><p>Artikel {item.supplierArticle||item.materialNumber||'ohne Nummer'} · Menge {item.quantity} {item.unit}</p><p>{item.price===null?'Preis nicht verfügbar':`${item.price} ${item.currency} je ${item.priceUnit} ${item.unit}`}</p></article>)}</div></section>}
  </section>
}
