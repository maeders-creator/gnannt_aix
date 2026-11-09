import {downloadPortalDocument} from '../_shared/private-knowledge.mjs'
import {plannerKnowledge} from './planner-knowledge.mjs'
import {calculatorProjects} from './calculator-projects.mjs'
import {plannerProjects} from './planner-projects.mjs'
export const allowedIds = new Set(['994074e0-5c81-4501-a9a0-02e84a9ee418','a03b5927-affb-4cca-b57d-c603712d2784','d97f7944-5969-4c72-82c1-7759fe8537cb'])
const enc=new TextEncoder()
export async function hash(text){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(text))),b=>b.toString(16).padStart(2,'0')).join('')}
async function sign(key,text){return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',await crypto.subtle.importKey('raw',enc.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']),enc.encode(text))),b=>b.toString(16).padStart(2,'0')).join('')}
export function createHandler(db,bundle,plannerHash,secret){
 const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,x-monteur-token,x-planer-session,apikey','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store','Content-Type':'application/json'}
 const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers})
 return async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers})
  if(req.method!=='POST')return reply({error:'Nicht verfügbar.'},405)
  try {
   const raw=await req.text();if(raw.length>6000000)return reply({error:'Anfrage zu groß.'},413);const input=JSON.parse(raw)
   if(input.action==='planner-login'){
    if(input.username!=='Planer'||typeof input.password!=='string'||await hash(input.password)!==plannerHash)return reply({error:'Benutzername oder Passwort ist falsch.'},401)
    const payload='planer.'+(Date.now()+8*3600000);return reply({session:payload+'.'+await sign(secret,payload)})
   }
   if(!['calculator','access','planner-projects','calculator-projects','planner-knowledge'].includes(input.action))return reply({error:'Nicht verfügbar.'},400)
   const session=req.headers.get('x-planer-session')||''
   if(session){const parts=session.split('.');if(parts.length!==3||parts[0]!=='planer'||!Number.isFinite(Number(parts[1]))||Number(parts[1])<Date.now()||parts[2]!==await sign(secret,parts[0]+'.'+parts[1]))return reply({error:'Planer-Sitzung abgelaufen. Bitte erneut anmelden.'},401);if(input.action==='planner-knowledge'){if(input.op==='download')return downloadPortalDocument(db,'knowledge',input.id,headers);return reply(await plannerKnowledge(db,input));}if(input.action==='planner-projects'){if(input.op==='download')return downloadPortalDocument(db,'projects',input.id,headers);return reply(await plannerProjects(db,input));}if(input.action==='calculator-projects')return reply(await calculatorProjects(db,input,'Planer'));return reply(input.action==='access'?{allowed:true}:{html:bundle})}
   if(['planner-projects','planner-knowledge'].includes(input.action))return reply({error:'Planer-Anmeldung erforderlich.'},401)
   const token=req.headers.get('x-monteur-token')||'';if(!/^[A-Za-z0-9_-]{43}$/.test(token))return reply({error:'Bitte mit deinem persönlichen Portalzugang anmelden.'},401)
   const {data,error}=await db.from('monteur_access').select('id').eq('token_hash',await hash(token)).eq('active',true).maybeSingle()
   if(error)return reply({error:'Zugriff konnte nicht geprüft werden.'},503)
   if(!data)return reply({error:'Dieser Zugang ist nicht gültig.'},401)
   if(!allowedIds.has(data.id))return reply({error:'Der Kalkulator ist nur für Samuel, Petra, Ruben und den Planer freigegeben.'},403)
   if(input.action==='calculator-projects')return reply(await calculatorProjects(db,input,({'994074e0-5c81-4501-a9a0-02e84a9ee418':'Ruben','a03b5927-affb-4cca-b57d-c603712d2784':'Samuel','d97f7944-5969-4c72-82c1-7759fe8537cb':'Petra'})[data.id]));
   return reply(input.action==='access'?{allowed:true}:{html:bundle})
  }catch{return reply({error:'Anfrage konnte nicht verarbeitet werden.'},400)}
 }
}

