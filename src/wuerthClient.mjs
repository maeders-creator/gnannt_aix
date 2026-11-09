export const WUERTH_API='https://xhpwmebwvjpdhsjeyrug.supabase.co/functions/v1/wuerth-oci'
const SHOP='https://eshop.wuerth.de/is-bin/INTERSHOP.enfinity/WFS/1401-B1-Site/de_DE/-/EUR/OCICatalogService-Inbound'
const errors={LOGIN_REQUIRED:'Bitte erneut im Portal anmelden.',LIVE_SETUP_REQUIRED:'Der sichere OCI-Zugang ist noch nicht freigeschaltet.',SESSION_NOT_FOUND:'Diese Katalogsitzung gehört nicht zu deiner Anmeldung.',SESSION_EXPIRED:'Die Katalogsitzung ist abgelaufen. Bitte neu öffnen.',RATE_LIMIT:'Bitte kurz warten und den Katalog dann erneut öffnen.',SERVICE_UNAVAILABLE:'Die Verbindung ist gerade nicht verfügbar. Bitte später erneut versuchen.'}
export function createWuerthClient(session,fetcher=fetch){
  return async input=>{
    if(!session)throw new Error(errors.LOGIN_REQUIRED)
    const r=await fetcher(WUERTH_API,{method:'POST',headers:{'Content-Type':'application/json','x-planer-session':session},body:JSON.stringify(input),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)})
    let result;try{result=await r.json()}catch{throw new Error(errors.SERVICE_UNAVAILABLE)}
    if(!r.ok||result.error)throw new Error(errors[result.error]||'Kataloganfrage fehlgeschlagen. Bitte erneut versuchen.')
    return result
  }
}
export function submitWuerthForm(popup,launch){
  if(launch?.method!=='POST'||launch.action!==SHOP||!launch.fields)throw new Error('Ungültiger Katalogaufruf.')
  const keys=Object.keys(launch.fields).sort().join(',')
  if(keys!=='HOOK_URL,NAME,ORGANIZATION,PASSWORD'||Object.values(launch.fields).some(v=>typeof v!=='string'||!v||v.length>2048))throw new Error('Ungültiger Katalogaufruf.')
  if(!new RegExp('^'+WUERTH_API.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'/return/[A-Za-z0-9_-]{43}$').test(launch.fields.HOOK_URL))throw new Error('Ungültige Rücksprungadresse.')
  if(!popup||popup.closed)throw new Error('Bitte Pop-ups für dieses Portal zulassen und erneut öffnen.')
  const doc=popup.document;doc.title='Würth-Katalog öffnen'
  const meta=doc.createElement('meta');meta.name='referrer';meta.content='no-referrer';doc.head.append(meta)
  const form=doc.createElement('form');form.method='POST';form.action=SHOP;form.acceptCharset='UTF-8'
  for(const [name,value] of Object.entries(launch.fields)){const input=doc.createElement('input');input.type='hidden';input.name=name;input.value=value;form.append(input)}
  doc.body.replaceChildren(form);popup.opener=null;form.submit()
}
