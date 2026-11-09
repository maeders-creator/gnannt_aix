import test from 'node:test'
import assert from 'node:assert/strict'
import {createHmac} from 'node:crypto'
import {createHandler as installerHandler} from '../supabase/functions/monteur-api/handler.mjs'
import {createHandler as plannerHandler} from '../supabase/functions/gnannt-calculator/handler.mjs'
import {downloadPortalDocument,storagePath,UPLOAD_URL} from '../supabase/functions/_shared/private-knowledge.mjs'
import {plannerProjects} from '../supabase/functions/gnannt-calculator/planner-projects.mjs'
function db(active=true,url=UPLOAD_URL+'knowledge/example.pdf'){
 const calls=[]
 const client={calls,from(table){calls.push(table);const q={select(){return q},eq(k,v){calls.push([k,v]);return q},async maybeSingle(){return {data:table==='monteur_access'?(active?{id:'installer-not-calculator-admin',name:'Installer'}:null):{id:1,url,file_name:'Beispiel.pdf',attachment_url:UPLOAD_URL+'projects/1_example.pdf',attachment_name:'Auftrag.pdf'}}}};return q},storage:{from(bucket){assert.equal(bucket,'uploads');return {async download(path){calls.push(['download',path]);return {data:new Blob(['%PDF-1.4\nprivate fixture'],{type:'application/pdf'})}},async createSignedUploadUrl(path){calls.push(['upload',path]);return {data:{signedUrl:'https://storage.test/upload-token'}}}}}}};return client
}
const request=(action,headers={},extra={})=>new Request('https://portal.test',{method:'POST',headers,body:JSON.stringify({action,id:1,...extra})})
test('private path parser refuses other hosts, scopes, traversal, query strings and malformed paths',()=>{
 assert.equal(storagePath(UPLOAD_URL+'knowledge/example.pdf','knowledge'),'knowledge/example.pdf')
 for(const url of ['https://evil.test/knowledge/example.pdf',UPLOAD_URL+'projects/a.pdf',UPLOAD_URL+'knowledge/../a.pdf',UPLOAD_URL+'knowledge/%2e%2e/a.pdf',UPLOAD_URL+'knowledge/a.pdf?x=1'])assert.equal(storagePath(url,'knowledge'),null)
})
test('anonymous installer downloads never query data or storage',async()=>{for(const action of ['hub-download','project-download']){const d=db();const r=await installerHandler(d)(request(action));assert.equal(r.status,401);assert.equal(d.calls.length,0)}})
test('inactive installer cannot download either kind',async()=>{for(const action of ['hub-download','project-download']){const d=db(false);const r=await installerHandler(d)(request(action,{'x-monteur-token':'A'.repeat(43)}));assert.equal(r.status,401);assert.deepEqual(d.calls.filter(x=>typeof x==='string'),['monteur_access'])}})
test('ordinary active installer downloads PDF with no-store after active check',async()=>{for(const action of ['hub-download','project-download']){const d=db();const r=await installerHandler(d)(request(action,{'x-monteur-token':'A'.repeat(43)}));assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('content-type'),'application/pdf');assert.match(await r.text(),/^%PDF/);assert.ok(d.calls.some(x=>Array.isArray(x)&&x[0]==='active'&&x[1]===true));assert.equal(d.calls.filter(x=>Array.isArray(x)&&x[0]==='download').length,1)}})
const secret='unit-test-only-not-a-real-credential'
function session(expiry=Date.now()+60000){const payload='planer.'+expiry;return payload+'.'+createHmac('sha256',secret).update(payload).digest('hex')}
test('planner rejects missing, invalid and expired credentials for both download routes',async()=>{for(const action of ['planner-knowledge','planner-projects'])for(const s of ['',session(1),session()+'invalid']){const d=db();const r=await plannerHandler(d,'','',secret)(request(action,{'x-planer-session':s},{op:'download'}));assert.equal(r.status,401);assert.equal(d.calls.length,0)}})
test('authenticated planner downloads knowledge and project files',async()=>{for(const action of ['planner-knowledge','planner-projects']){const d=db();const r=await plannerHandler(d,'','',secret)(request(action,{'x-planer-session':session()},{op:'download'}));assert.equal(r.status,200);assert.match(await r.text(),/^%PDF/)}})
test('file lookup cannot proxy external URLs or arbitrary IDs',async()=>{const d=db(true,'https://evil.test/file.pdf');const r=await downloadPortalDocument(d,'knowledge',1,{});assert.equal(r.status,404);assert.equal(d.calls.some(x=>Array.isArray(x)&&x[0]==='download'),false);assert.equal((await downloadPortalDocument(d,'knowledge','1',{})).status,400)})
test('project signed upload validates scope, filename and existing project',async()=>{for(const path of ['knowledge/a.pdf','projects/1_../../a.pdf','projects/1_file.html','projects/0_file.pdf'])await assert.rejects(()=>plannerProjects(db(),{op:'upload-url',path}));const d=db();const r=await plannerProjects(d,{op:'upload-url',path:'projects/1_example.pdf'});assert.equal(r.data.publicUrl,UPLOAD_URL+'projects/1_example.pdf');assert.ok(d.calls.some(x=>Array.isArray(x)&&x[0]==='upload'))})
test('catalog is served only after planner or active installer authentication',async()=>{
 for(const active of [true,false]){const d=db(active);const r=await installerHandler(d)(request('training-videos',{'x-monteur-token':'A'.repeat(43)}));assert.equal(r.status,active?200:401);if(active)assert.equal((await r.json()).data.length,11)}
 for(const s of ['',session(1),session()]){const d=db();const r=await plannerHandler(d,'','',secret)(request('planner-knowledge',{'x-planer-session':s},{op:'training-videos'}));assert.equal(r.status,s=== ''||s===session(1)?401:200);if(r.status===200)assert.equal((await r.json()).data.length,11)}
})
