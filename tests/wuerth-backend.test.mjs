import test from 'node:test'
import assert from 'node:assert/strict'
import {createHandler,plannerAuth,API,PORTAL,readBounded} from '../supabase/functions/wuerth-oci/handler.mjs'
import {readFileSync} from 'node:fs'
const token='fake-planner-session'
const env={WUERTH_OCI_ORGANIZATION:'DEMO',WUERTH_OCI_NAME:'DEMO',WUERTH_OCI_PASSWORD:'synthetic-password',WUERTH_OCI_ENABLED:'true',WUERTH_OCI_CATALOG_ONLY:'true'}
const body=new URLSearchParams({'NEW_ITEM-DESCRIPTION[1]':'Testartikel','NEW_ITEM-QUANTITY[1]':'2','NEW_ITEM-UNIT[1]':'ST','NEW_ITEM-PRICE[1]':'10.25','NEW_ITEM-CURRENCY[1]':'EUR','NEW_ITEM-PRICEUNIT[1]':'100'}).toString()
function fixture(config=env){
 const rows=new Map();let writes=0
 const store={
  async create(row){writes++;const expires_at=new Date(Date.now()+900000).toISOString();rows.set(row.id,{...row,expires_at,status:'pending',cart:null});return expires_at},
  async receive(hash,cart){const row=[...rows.values()].find(r=>r.stateHash===hash&&r.status==='pending'&&Date.parse(r.expires_at)>Date.now());if(!row)return null;writes++;row.status='returned';row.cart=cart;return row.id},
  async get(id,owner){const row=rows.get(id);return row?.ownerHash===owner?row:null}
 }
 const authenticate=plannerAuth(async(_url,options)=>{
  const input=JSON.parse(options.body)
  assert.equal(input.selection,'id,notiz');assert.equal(input.filters[0].value,-1)
  return new Response(JSON.stringify(options.headers['x-planer-session']===token?{data:[]}:{error:'no'}),{status:options.headers['x-planer-session']===token?200:401})
 })
 const handler=createHandler({store,env:key=>config[key],authenticate})
 const request=(input,session=token,origin=PORTAL)=>new Request(API,{method:'POST',headers:{'content-type':'application/json','x-planer-session':session,origin},body:JSON.stringify(input)})
 return {handler,request,rows,writes:()=>writes}
}
test('authentication is required before setup status, session or database access',async()=>{
 const f=fixture();for(const session of ['', 'invalid']){const r=await f.handler(f.request({action:'launch'},session));assert.equal(r.status,401)}assert.equal(f.writes(),0)
})
test('status never returns credentials and launch remains disabled until all gates are configured',async()=>{
 for(const missing of Object.keys(env)){
  const f=fixture({...env,[missing]:''});const status=await (await f.handler(f.request({action:'status'}))).json()
  assert.equal(status.configured,false);assert.equal(JSON.stringify(status).includes('synthetic'),false)
  assert.equal((await f.handler(f.request({action:'launch'}))).status,503);assert.equal(f.writes(),0)
 }
})
test('launch, single callback and owner-bound result work without ordering',async()=>{
 const f=fixture();const response=await f.handler(f.request({action:'launch'}));assert.equal(response.headers.get('cache-control'),'no-store, max-age=0')
 const launch=await response.json();assert.equal(launch.ordered,false);assert.equal(launch.launch.method,'POST')
 assert.equal(JSON.stringify([...f.rows.values()]).includes('synthetic-password'),false)
 const callback=()=>new Request(launch.launch.fields.HOOK_URL,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',origin:'https://eshop.wuerth.de'},body})
 const results=await Promise.all([f.handler(callback()),f.handler(callback())]);assert.deepEqual(results.map(r=>r.status).sort(),[303,409])
 assert.equal(results.find(r=>r.status===303).headers.get('location'),PORTAL+'/?wuerth=1&oci_session='+launch.id)
 const preview=await (await f.handler(f.request({action:'result',id:launch.id}))).json()
 assert.equal(preview.cart.items[0].priceUnit,'100');assert.equal(preview.cart.priceSource,'unverified_browser_return');assert.equal(preview.ordered,false)
 const other=createHandler({store:{get:async()=>null},authenticate:async()=> 'other-owner'})
 assert.equal((await other(f.request({action:'result',id:launch.id}))).status,404)
})
test('expired callback/result and malicious origin cannot alter sessions',async()=>{
 const f=fixture();const launch=await (await f.handler(f.request({action:'launch'}))).json();f.rows.get(launch.id).expires_at=new Date(0).toISOString()
 const r=await f.handler(new Request(launch.launch.fields.HOOK_URL,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body}));assert.equal(r.status,409)
 assert.equal((await f.handler(f.request({action:'result',id:launch.id}))).status,410)
 assert.equal((await f.handler(f.request({action:'launch'},token,'https://evil.invalid'))).status,403)
})
test('callback rejects bad content, GET, wrong origin and invalid payload before write',async()=>{
 const f=fixture();const launch=await (await f.handler(f.request({action:'launch'}))).json()
 for(const [method,content,origin,expected] of [['GET','application/x-www-form-urlencoded','',405],['POST','application/json','',415],['POST','application/x-www-form-urlencoded','https://evil.invalid',403]]){
  const r=await f.handler(new Request(launch.launch.fields.HOOK_URL,{method,headers:{'content-type':content,...(origin?{origin}:{})},...(method==='POST'?{body}:{})}));assert.equal(r.status,expected)
 }
 const r=await f.handler(new Request(launch.launch.fields.HOOK_URL,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'bad=cart'}));assert.equal(r.status,400);assert.equal(f.writes(),1)
})
test('bounded reader protects chunked bodies; internal errors and secrets are never echoed',async()=>{
 await assert.rejects(readBounded(new Request(API,{method:'POST',body:'a'.repeat(5000)}),4096),e=>e.status===413)
 const f=fixture();const bad=createHandler({store:{create:async()=>{throw new Error('SECRET demo-password')}},env:key=>env[key],authenticate:async()=> 'a'.repeat(64)})
 const r=await bad(f.request({action:'launch'}));assert.equal(r.status,503);assert.equal(await r.text(),'{"error":"SERVICE_UNAVAILABLE"}')
})
test('SQL uses invoker privileges, service-only grants, atomic expiry check and launch throttling',()=>{
 const sql=readFileSync('supabase/WUERTH_SCHEMA.sql','utf8')
 assert.ok(!/security definer/i.test(sql));assert.match(sql,/enable row level security/i)
 assert.match(sql,/revoke all on public.wuerth_oci_sessions from public,anon,authenticated/)
 assert.match(sql,/status='pending' and expires_at>now\(\)/)
 assert.match(sql,/pg_advisory_xact_lock/);assert.match(sql,/RATE_LIMIT/)
 const config=readFileSync('supabase/config.toml','utf8');assert.match(config,/\[functions.wuerth-oci\]\s+verify_jwt = false/)
})

test('products require portal login, are no-store and do not depend on OCI credentials',async()=>{
 let reads=0
 const data=[{article_number:'000123',description:'Demo',product_group:'Gruppe',source_row:3}]
 const authenticate=plannerAuth(async(_url,options)=>new Response(JSON.stringify(options.headers['x-planer-session']===token?{data:[]}:{error:'no'})))
 const handler=createHandler({store:{products:async()=>{reads++;return data}},authenticate})
 const request=session=>new Request(API,{method:'POST',headers:{'content-type':'application/json',origin:PORTAL,...(session?{'x-planer-session':session}:{})},body:JSON.stringify({action:'products'})})
 for(const session of ['', 'bad'])assert.equal((await handler(request(session))).status,401)
 assert.equal(reads,0)
 const response=await handler(request(token));assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/)
 const result=await response.json();assert.deepEqual(result.products,data);assert.equal(result.count,1);assert.equal(result.ordered,false);assert.equal(reads,1)
})
test('product table is service-read-only, RLS protected, and contains no prices',()=>{
 const sql=readFileSync('supabase/WUERTH_PRODUCTS.sql','utf8')
 assert.match(sql,/enable row level security/);assert.match(sql,/revoke all on public.wuerth_products from public, anon, authenticated/)
 assert.match(sql,/grant select on public.wuerth_products to service_role/)
 assert.doesNotMatch(sql,/grant .*?(insert|update|delete)|price|Umsatz|Fakturamenge/i)
})

test('persistent catalog import remains service-only, exact-supplier-matched and atomic with callback acceptance',()=>{
 const sql=readFileSync('supabase/WUERTH_PRODUCT_CATALOG.sql','utf8')
 assert.doesNotMatch(sql,/security definer/i)
 assert.match(sql,/enable row level security/)
 assert.match(sql,/revoke all on public.wuerth_product_catalog from public,anon,authenticated/)
 assert.match(sql,/status='pending' and expires_at>now\(\)/)
 assert.ok(sql.indexOf('if session_id is null then return null')<sql.indexOf('insert into public.wuerth_product_catalog'))
 assert.match(sql,/supplierArticle/);assert.doesNotMatch(sql,/materialNumber/)
 assert.match(sql,/jsonb_agg\(i.item order by i.position\)/)
 assert.match(sql,/on conflict\(source_key,article_number\)/)
 assert.match(sql,/security invoker set search_path=''/)
})
test('database product reads include protected catalog snapshots and sanitize stored image URLs',async()=>{
 const {databaseStore}=await import('../supabase/functions/wuerth-oci/handler.mjs')
 const queried=[]
 const db={from(name){queried.push(name);const query={select(){return query},eq(){return query},order(){return query},limit:async()=>({data:name==='wuerth_products'?[{article_number:'001',description:'Demo'}]:[{article_number:'001',imported_at:'2026-11-09T12:00:00Z',items:[{supplierArticle:'001',price:'0',priceUnit:'100',unit:'ST',currency:'EUR',imageUrl:'https://evil.invalid/p.jpg',imageStatus:'unsupported'}]}]})};return query}}
 const products=await databaseStore(db).products()
 assert.deepEqual(queried,['wuerth_products','wuerth_product_catalog'])
 assert.equal(products[0].catalog.items[0].price,'0')
 assert.equal(products[0].catalog.items[0].imageUrl,null)
 assert.equal(products[0].catalog.importedAt,'2026-11-09T12:00:00Z')
 assert.equal(products[0].catalog.source,'unverified_browser_return')
})
