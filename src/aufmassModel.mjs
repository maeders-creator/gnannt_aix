export const PRODUCTION_ORIGINS = ['https://gnannt-aix-83xs.vercel.app','https://gnannt-aix-83xs-maeders-9026s-projects.vercel.app','https://gnannt-aix-83xs-git-main-maeders-9026s-projects.vercel.app']
export function resolveAufmassEndpoint(configured,origin){return configured || (PRODUCTION_ORIGINS.includes(origin)?'https://xhpwmebwvjpdhsjeyrug.supabase.co/functions/v1/aufmass-api':'')}
export const HEADER_FIELDS = [['farbe','Farbe'],['glasBemerkungen','Glas / Bemerkungen']]
export const TEXT_FIELDS = [['rollladenLeisten','Rollladenleisten'],['fensterbankInnen','Fensterbank innen'],['fensterbankAussen','Fensterbank außen'],['glasart','Glasart (z. B. Float, satiniert)'],['randverbundFarbe','Randverbund · Farbe'],['zusatztext','Zusatztext']]
export const DIMENSIONS = [['breite','Breite'],['hoehe','Höhe'],['rahmenSeitlich','Rahmenholzbreite seitlich'],['rahmenOben','Rahmenholzbreite oben'],['rahmenUnten','Rahmenholzbreite unten'],['nutmass','Nutmaß Rollladenleisten (falls benötigt)'],['leibungAussenBreite','Leibung außen · Breite'],['leibungAussenHoehe','Leibung außen · Höhe'],['leibungInnenBreite','Leibung innen · Breite'],['leibungInnenHoehe','Leibung innen · Höhe'],['schraegmass','Schrägmaß'],['versatz','Versatz']]
export const blankPosition = () => ({id:crypto.randomUUID(),bezeichnung:'',rollladen:false,stueckzahl:'1',...Object.fromEntries([...TEXT_FIELDS,...DIMENSIONS].map(([k])=>[k,''])),sketch:[],photos:[]})
export const blankSheet = () => ({id:crypto.randomUUID(),projectId:null,version:0,payload:{header:{kunde:'',ausfuehrung:'',farbe:'',glasBemerkungen:''},positions:[blankPosition()]}})
export function validateSheet(sheet){
 if(!Number.isSafeInteger(sheet.projectId)||sheet.projectId<1)return 'Bitte zuerst ein Projekt auswählen oder anlegen.'
 if(!sheet.payload.header.kunde.trim())return 'Bitte den Kunden eintragen.'
 if(!['Holz','Kunststoff'].includes(sheet.payload.header.ausfuehrung))return 'Bitte die Ausführung wählen.'
 if(!sheet.payload.positions.length)return 'Bitte mindestens eine Position anlegen.'
 for(const [i,p] of sheet.payload.positions.entries()){
  if(!/^\d+$/.test(String(p.stueckzahl))||(Number(p.stueckzahl)<1||Number(p.stueckzahl)>10000))return `Position ${i+1}: Stückzahl muss eine positive ganze Zahl sein.`
  for(const [key,label] of DIMENSIONS)if(p[key]!==''&&(!(key==='versatz'?/^-?\d+(\.\d{1,3})?$/:/^\d+(\.\d{1,3})?$/).test(String(p[key]))||!Number.isFinite(Number(p[key]))||Math.abs(Number(p[key]))>100000||(key!=='versatz'&&Number(p[key])<0)||(['breite','hoehe'].includes(key)&&Number(p[key])===0)))return `Position ${i+1}: ${label} bitte als gültiges Maß in mm eingeben.`
 }
 return ''
}
export function createAufmassApi({token,plannerSession,endpoint}){
 return async(action,data={})=>{
  if(!endpoint)throw Error('Die geschützte Aufmaß-Speicherung ist noch nicht eingerichtet. Es wurden keine Daten übertragen.')
  if(!navigator.onLine)throw Error('Offline. Deine Eingabe bleibt in dieser geöffneten Ansicht. Bitte online erneut speichern.')
  const body=JSON.stringify({action,...data});if(new TextEncoder().encode(body).length>6*1024*1024)throw Error('Aufmaß zu groß. Bitte weniger Fotos verwenden.')
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000)
  try{const r=await fetch(endpoint,{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json',...(token?{'x-monteur-token':token}:{}),...(plannerSession?{'x-planer-session':plannerSession}:{})},body});const result=await r.json();if(!r.ok)throw Error(typeof result.error==='string'?result.error:'Aufmaß konnte nicht gespeichert werden.');return result.data}
  catch(e){if(e.name==='AbortError'||e instanceof TypeError)throw Error('Verbindung unterbrochen; Speicherung nicht bestätigt. Eingaben bleiben erhalten. Erneut speichern ist sicher.');throw e}finally{clearTimeout(timer)}
 }
}
