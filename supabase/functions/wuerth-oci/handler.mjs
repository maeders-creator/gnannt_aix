import { parseOciCart, buildCatalogLaunch, hashState, WUERTH_OCI_ENDPOINT, MAX_BODY_BYTES, OciError, safeProductImageUrl } from './oci.mjs'
export const PORTAL = 'https://gnannt-aix-83xs.vercel.app'
export const API = 'https://xhpwmebwvjpdhsjeyrug.supabase.co/functions/v1/wuerth-oci'
const ORIGINS = [PORTAL,'https://gnannt-aix-83xs-maeders-9026s-projects.vercel.app','https://gnannt-aix-83xs-git-main-maeders-9026s-projects.vercel.app']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
class HttpError extends Error { constructor(code,status=400){super(code);this.status=status} }
const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('')
const randomState = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')
export async function readBounded(req,limit) {
  if(Number(req.headers.get('content-length')||0)>limit)throw new HttpError('BODY_TOO_LARGE',413)
  const reader=req.body?.getReader();if(!reader)throw new HttpError('EMPTY_BODY')
  const chunks=[];let size=0
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new HttpError('BODY_TOO_LARGE',413)}chunks.push(value)}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{throw new HttpError('INVALID_ENCODING')}
}
export function plannerAuth(fetcher=fetch) {
  return async req=>{
    const token=req.headers.get('x-planer-session')||''
    if(!token||token.length>4096)throw new HttpError('LOGIN_REQUIRED',401)
    const response=await fetcher('https://xhpwmebwvjpdhsjeyrug.supabase.co/functions/v1/gnannt-calculator',{
      method:'POST',headers:{'Content-Type':'application/json','x-planer-session':token},
      body:JSON.stringify({action:'planner-projects',op:'select',selection:'id,notiz',filters:[{method:'eq',column:'id',value:-1}]}),
      signal:AbortSignal.timeout(10000),redirect:'error'
    })
    let result;try{result=await response.json()}catch{throw new HttpError('AUTH_UNAVAILABLE',503)}
    if(!response.ok||result.error||!Array.isArray(result.data))throw new HttpError('LOGIN_REQUIRED',401)
    return digest(token) // Per validated login session, not user-supplied identity.
  }
}
export function databaseStore(db) {
  return {
    async products(){
      const r=await db.from('wuerth_products').select('article_number,description,product_group,source_row').eq('source_key','top-artikel-fensterbau').order('product_group').order('description').limit(1000)
      if(r.error)throw new Error('products failed')
      const snapshots=await db.from('wuerth_product_catalog').select('article_number,items,imported_at').eq('source_key','top-artikel-fensterbau').limit(1000)
      if(snapshots.error)throw new Error('catalog read failed')
      const byArticle=new Map((snapshots.data||[]).map(row=>[row.article_number,{
        items:row.items.map(item=>({...item,imageUrl:safeProductImageUrl(item.imageUrl),imageStatus:safeProductImageUrl(item.imageUrl)?'available':item.imageStatus==='unsupported'?'unsupported':'not_supplied'})),
        importedAt:row.imported_at,source:'unverified_browser_return'
      }]))
      return r.data.map(product=>({...product,catalog:byArticle.get(product.article_number)||null}))
    },
    async create({id,ownerHash,stateHash}){
      const r=await db.rpc('wuerth_create_session',{p_id:id,p_owner:ownerHash,p_state:stateHash})
      if(r.error){if(r.error.message?.includes('RATE_LIMIT'))throw new HttpError('RATE_LIMIT',429);throw new Error('create failed')}
      return r.data
    },
    async receive(stateHash,cart){
      const r=await db.rpc('wuerth_receive_cart',{p_state:stateHash,p_cart:cart})
      if(r.error)throw new Error('return failed')
      return r.data
    },
    async get(id,ownerHash){
      const r=await db.from('wuerth_oci_sessions').select('id,status,expires_at,cart').eq('id',id).eq('owner_hash',ownerHash).maybeSingle()
      if(r.error)throw new Error('read failed')
      return r.data
    }
  }
}
export function createHandler({store,env=()=>undefined,authenticate=plannerAuth(),now=()=>Date.now()}) {
  return async req=>{
    const url=new URL(req.url),origin=req.headers.get('origin')||''
    const callback=/\/wuerth-oci\/return\/([A-Za-z0-9_-]{43})$/.exec(url.pathname)
    const headers={'Content-Type':'application/json','Cache-Control':'no-store, max-age=0','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Vary':'Origin','Access-Control-Allow-Headers':'content-type, x-planer-session','Access-Control-Allow-Methods':'POST, OPTIONS'}
    if(ORIGINS.includes(origin))headers['Access-Control-Allow-Origin']=origin
    const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers})
    try {
      if(callback){
        if(req.method!=='POST')throw new HttpError('METHOD_NOT_ALLOWED',405)
        if(origin&&origin!=='https://eshop.wuerth.de')throw new HttpError('ORIGIN_NOT_ALLOWED',403)
        if(url.search)throw new HttpError('INVALID_CALLBACK')
        if(!/^application\/x-www-form-urlencoded(?:\s*;\s*charset\s*=\s*(?:UTF-8|"UTF-8"))?\s*$/i.test(req.headers.get('content-type')||''))throw new HttpError('UNSUPPORTED_CONTENT_TYPE',415)
        const cart=parseOciCart(await readBounded(req,MAX_BODY_BYTES))
        const id=await store.receive(await hashState(callback[1]),cart)
        if(!id||!UUID.test(id))throw new HttpError('SESSION_EXPIRED_OR_USED',409)
        return new Response(null,{status:303,headers:{...headers,Location:`${PORTAL}/?wuerth=1&oci_session=${id}`}})
      }
      if(!['/functions/v1/wuerth-oci','/wuerth-oci'].includes(url.pathname.replace(/\/$/,''))||url.search)throw new HttpError('NOT_FOUND',404)
      if(origin&&!ORIGINS.includes(origin))throw new HttpError('ORIGIN_NOT_ALLOWED',403)
      if(req.method==='OPTIONS')return new Response(null,{status:204,headers})
      if(req.method!=='POST')throw new HttpError('METHOD_NOT_ALLOWED',405)
      if(!/^application\/json(?:;.*)?$/i.test(req.headers.get('content-type')||''))throw new HttpError('UNSUPPORTED_CONTENT_TYPE',415)
      const ownerHash=await authenticate(req)
      const input=JSON.parse(await readBounded(req,4096))
      if(!input||typeof input!=='object'||Array.isArray(input))throw new HttpError('INVALID_INPUT')
      if(input.action==='products'){
        const products=await store.products()
        return reply({products,count:products.length,source:'Top-Artikel Fensterbau.xlsx',ordered:false})
      }
      const credentials={organization:env('WUERTH_OCI_ORGANIZATION'),name:env('WUERTH_OCI_NAME'),password:env('WUERTH_OCI_PASSWORD')}
      const configured=Object.values(credentials).every(x=>typeof x==='string'&&x.length>0)
      const approved=env('WUERTH_OCI_ENABLED')==='true'&&env('WUERTH_OCI_CATALOG_ONLY')==='true'
      if(input.action==='status')return reply({configured:configured&&approved,catalogOnly:true,ordered:false})
      if(input.action==='launch'){
        if(!configured||!approved)throw new HttpError('LIVE_SETUP_REQUIRED',503)
        const state=randomState(),id=crypto.randomUUID()
        const launch=buildCatalogLaunch({configuration:{enabled:true,catalogOnlyConfirmed:true,credentialUseApproved:true,endpoint:WUERTH_OCI_ENDPOINT,callbackBase:API+'/return'},credentials,callbackUrl:API+'/return/'+state})
        const expiresAt=await store.create({id,ownerHash,stateHash:await hashState(state)})
        return reply({id,expiresAt,launch:{method:launch.method,action:launch.action,fields:launch.fields},ordered:false})
      }
      if(input.action==='result'){
        if(!UUID.test(input.id||''))throw new HttpError('INVALID_SESSION')
        const row=await store.get(input.id,ownerHash)
        if(!row)throw new HttpError('SESSION_NOT_FOUND',404)
        if(Date.parse(row.expires_at)<=now())throw new HttpError('SESSION_EXPIRED',410)
        return reply({id:row.id,status:row.status,cart:row.cart,ordered:false})
      }
      throw new HttpError('UNKNOWN_ACTION')
    }catch(error){
      // Never include upstream errors, request bodies, URLs, or credentials.
      if(error instanceof HttpError)return reply({error:error.message},error.status)
      if(error instanceof OciError)return reply({error:error.code},400)
      if(error instanceof SyntaxError)return reply({error:'INVALID_INPUT'},400)
      return reply({error:'SERVICE_UNAVAILABLE'},503)
    }
  }
}
