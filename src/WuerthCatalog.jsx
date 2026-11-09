import { useEffect, useMemo, useRef, useState } from 'react'
import { ShieldCheck, LockKeyhole, PackageSearch, Copy } from 'lucide-react'
import {createWuerthClient,submitWuerthForm} from './wuerthClient.mjs'
import {groupProducts,matchingPrices,priceLabel} from './wuerthProducts.mjs'
import './wuerthCatalog.css'

// Live launch remains unavailable until the dedicated OCI credential has been
// configured securely and the server-side session/callback integration tested.
// Never collect a Würth password or put customer prices into browser storage.
export default function WuerthCatalog({plannerSession=''}) {
  const generation=useRef(0)
  const popupRef=useRef(null)
  const ownerRef=useRef(plannerSession)
  const [products,setProducts]=useState([])
  const [source,setSource]=useState('')
  const [loadingProducts,setLoadingProducts]=useState(false)
  const [productError,setProductError]=useState('')
  const [query,setQuery]=useState('')
  const [selectedGroup,setSelectedGroup]=useState('')
  const [copyStatus,setCopyStatus]=useState('')
  const [productsRetry,setProductsRetry]=useState(0)
  const [connected,setConnected]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [sessionId,setSessionId]=useState(()=>new URLSearchParams(globalThis.location?.search||'').get('oci_session')||'')
  const [cart,setCart]=useState(null)
  const [waiting,setWaiting]=useState(false)
  useEffect(()=>{
    ++generation.current;let active=true;setConnected(false);setCart(null);setError('');setWaiting(false);setBusy(false);setProducts([]);setSource('');setProductError('');setQuery('');setSelectedGroup('');setCopyStatus('');setLoadingProducts(Boolean(plannerSession))
    if(ownerRef.current!==plannerSession){setSessionId('');ownerRef.current=plannerSession}
    if(plannerSession)createWuerthClient(plannerSession)({action:'status'}).then(result=>{if(active)setConnected(result.configured===true)}).catch(()=>{if(active)setError('Verbindungsstatus konnte nicht geladen werden. Bitte erneut prüfen.')})
    return()=>{active=false;++generation.current;if(popupRef.current){try{popupRef.current.close()}catch{}popupRef.current=null}}
  },[plannerSession])
  useEffect(()=>{
    let active=true;setProductError('');setLoadingProducts(Boolean(plannerSession))
    if(plannerSession)createWuerthClient(plannerSession)({action:'products'}).then(result=>{if(active){setProducts(Array.isArray(result.products)?result.products:[]);setSource(result.source||'')}}).catch(()=>{if(active)setProductError('Die Artikelliste konnte nicht geladen werden. Bitte erneut versuchen.')}).finally(()=>{if(active)setLoadingProducts(false)})
    return()=>{active=false}
  },[plannerSession,productsRetry])
  async function refresh(){
    if(!plannerSession||busy)return
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
  async function copyArticle(article){
    const version=generation.current
    try{await navigator.clipboard.writeText(String(article));if(version===generation.current)setCopyStatus(`Artikelnummer ${article} kopiert.`)}catch{if(version===generation.current)setCopyStatus(`Bitte Artikelnummer ${article} markieren und kopieren.`)}
  }
  const groups=useMemo(()=>groupProducts(products),[products])
  const filteredGroups=useMemo(()=>groupProducts(products,query,selectedGroup),[products,query,selectedGroup])
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
    </div>
    {plannerSession&&ownerRef.current===plannerSession&&<section className="wu-panel wu-products" aria-labelledby="wu-products-title">
      <div className="wu-products-heading"><div><h3 id="wu-products-title">Eure Top-Artikel</h3><p>{products.length} Artikel · {groups.length} Produktgruppen{source&&` · ${source}`}</p></div></div>
      <p>Artikelnummer kopieren und im Würth-Katalog suchen. Zurückgegebene OCI-Preise erscheinen bei exakt passender Würth-Artikelnummer.</p>
      <div className="wu-filters"><label>Artikel suchen<input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Artikelnummer, Bezeichnung oder Produktgruppe"/></label><label>Produktgruppe<select value={selectedGroup} onChange={event=>setSelectedGroup(event.target.value)}><option value="">Alle Produktgruppen</option>{groups.map(([group,items])=><option key={group} value={group}>{group} ({items.length})</option>)}</select></label></div>
      {loadingProducts&&<p role="status">Artikelliste wird geladen …</p>}
      {productError&&<div><p role="alert">{productError}</p><button type="button" className="wu-details-button" onClick={()=>setProductsRetry(value=>value+1)}>Artikelliste erneut laden</button></div>}
      {!loadingProducts&&!productError&&<p role="status">{filteredGroups.reduce((sum,[,items])=>sum+items.length,0)} Artikel gefunden</p>}
      {copyStatus&&<p role="status">{copyStatus}</p>}
      {cart&&<p className="wu-price-note">Unbestätigte OCI-Katalogvorschau · Keine Bestellung. Preise gelten nur für die zurückgegebene Menge und Preiseinheit.</p>}
      {filteredGroups.map(([group,items])=><details className="wu-product-group" key={group} open><summary>{group}<span>{items.length} Artikel</span></summary><div className="wu-product-list">{items.map((product,index)=>{
        const prices=matchingPrices(product,cart?.items)
        return <article key={`${product.article_number}-${product.source_row??index}`} className="wu-product"><div><h4>{product.description}</h4><div className="wu-article-number">Art. {product.article_number}<button type="button" aria-label={`Artikelnummer ${product.article_number} kopieren`} onClick={()=>copyArticle(product.article_number)}><Copy size={14} aria-hidden="true"/> Kopieren</button></div></div><div className="wu-product-prices">{prices.length===0?<p>Noch kein OCI-Preis</p>:<>{prices.length>1&&<p className="wu-price-note">Mehrere OCI-Positionen · einzeln prüfen</p>}{prices.map((item,i)=><div key={i}><p><strong>{priceLabel(item)}</strong></p><p>Menge {item.quantity??'unbekannt'} {item.unit||''}</p></div>)}</>}</div></article>
      })}</div></details>)}
    </section>}
    {plannerSession&&ownerRef.current===plannerSession&&cart&&<section className="wu-panel" aria-label="Katalogvorschau"><h3>Deine Katalogauswahl</h3><p>Unbestätigte Katalogvorschau · Keine Bestellung. Preise beziehen sich auf die angezeigte Preiseinheit.</p><div className="wu-cart-list">{cart.items?.map(item=><article key={item.index}><strong>{item.description}</strong><p>Artikel {item.supplierArticle||'ohne Würth-Nummer'} · Menge {item.quantity} {item.unit}</p><p>{priceLabel(item)}</p></article>)}</div></section>}
  </section>
}
