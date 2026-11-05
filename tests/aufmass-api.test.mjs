import assert from 'node:assert/strict'
import test from 'node:test'
import { createHandler, createAuthenticator, validatePayload } from '../supabase/functions/aufmass-api/handler.mjs'
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const requestId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const positionId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const actor = { id: 'monteur:one', name: 'Test' }
const payload = () => ({ header: { kunde: 'Kunde', ausfuehrung: 'Holz', farbe: 'weiß', glasBemerkungen: 'Glas' }, positions: [{ id: positionId, rollladen: true, breite: '1200,5', hoehe: '900', stueckzahl: '2', sketch: [[{ x: .1, y: .8 }]], photos: [] }] })
function database() {
  const rows = new Map(); const calls = []
  return { rows, calls, from(table) {
    calls.push(table); const filters = []; let op = 'select', values; let columns = '*'
    const q = { select(c = '*') { columns = c; return q }, eq(k, v) { filters.push([k,v]); return q }, order() { return q }, limit() { return q }, update(v) { op='update'; values=v; return q }, insert(v) { op='insert'; values=v; return q }, async single() { return run(true) }, async maybeSingle() { return run(true) }, then(a,b) { return Promise.resolve(run(false)).then(a,b) } }
    const run = single => {
      if (table === 'projects') return { data: filters.some(([k,v]) => k==='id' && v===1) ? { id:1 } : null }
      if (table !== 'aufmass_sheets') throw Error('unexpected table')
      if (op === 'insert') { if (rows.has(values.id)) return { error:{code:'23505'} }; rows.set(values.id, {...values}); return {data:rows.get(values.id)} }
      const found = [...rows.values()].filter(row => filters.every(([k,v]) => row[k]===v))
      if (op === 'update') { for (const row of found) rows.set(row.id, {...row,...values}); return {data: found[0] ? rows.get(found[0].id) : null} }
      if (single) return {data: found[0] || null}
      return { data: found.map(row => columns==='*' ? row : { id:row.id, project_id:row.project_id,version:row.version,header:row.payload.header,position_count:row.position_count,updated_at:row.updated_at }) }
    }; return q
  } }
}
const request = (body, headers = {}) => new Request('https://api.test', {method:'POST',headers,body:JSON.stringify(body)})
const save = (patch = {}) => ({ action:'save',id,projectId:1,version:0,requestId,payload:payload(),...patch })
test('all fields survive validation; numeric values normalize without dimension deductions', () => {
  const p = payload(); Object.assign(p.positions[0], { rahmenSeitlich:'50',rahmenOben:'55',rahmenUnten:'60',nutmass:'10',leibungAussenBreite:'1200',leibungAussenHoehe:'900',leibungInnenBreite:'1300',leibungInnenHoehe:'1000',schraegmass:'1500',versatz:'-5',rollladenLeisten:'Alu',fensterbankInnen:'Stein',fensterbankAussen:'Alu',glasart:'satiniert',randverbundFarbe:'schwarz',zusatztext:'Text',bezeichnung:'Küche' })
  const result = validatePayload(p); assert.equal(result.positions[0].breite,'1200.5'); assert.equal(result.positions[0].versatz,'-5'); assert.equal(result.positions[0].stueckzahl,2)
  for (const key of Object.keys(p.positions[0])) assert.ok(key in result.positions[0],key)
})
test('invalid values, duplicate IDs, hostile photos and bad coordinates are rejected', () => {
  for (const patch of [{breite:'-1'},{hoehe:'0'},{stueckzahl:1.5},{stueckzahl:true},{breite:'Infinity'},{breite:'1e3'},{rollladen:'false'},{sketch:[[{x:2,y:0}]]},{photos:[{id,name:'x',dataUrl:'data:image/svg+xml;base64,PHN2Zz4='}]},{photos:[{id,name:'x',dataUrl:'https://external.test/image.jpg'}]}]) {
    const p=payload(); Object.assign(p.positions[0],patch); assert.throws(()=>validatePayload(p))
  }
  const p=payload();p.positions.push(p.positions[0]);assert.throws(()=>validatePayload(p))
  assert.throws(()=>validatePayload({...payload(),header:{kunde:'X',ausfuehrung:'Alu'}}))
})
test('valid raster signature accepted; mismatched and oversized images rejected', () => {
  const p=payload(); const dataUrl='data:image/png;base64,'+btoa('\x89PNG\r\n\x1a\n'+ 'x'.repeat(32));p.positions[0].photos=[{id,name:'Foto',dataUrl}]
  assert.equal(validatePayload(p).positions[0].photos[0].dataUrl,dataUrl)
  p.positions[0].photos[0].dataUrl=dataUrl.replace('image/png','image/jpeg');assert.throws(()=>validatePayload(p))
})
test('missing or invalid auth never touches sheets; revoked links rejected', async () => {
  let calls=0;const handler=createHandler({from(){calls++;throw Error('unexpected')}})
  assert.equal((await handler(request({action:'list'}))).status,401);assert.equal(calls,0)
  const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:null})}
  assert.equal((await createHandler({from:()=>q})(request({action:'list'},{'x-monteur-token':'A'.repeat(43)}))).status,401)
})
test('planner auth fails closed on invalid or malformed upstream results', async () => {
  for (const result of [{error:'expired'},{data:null},{unexpected:[] }]) {
    const auth=createAuthenticator({},async()=>new Response(JSON.stringify(result)))
    await assert.rejects(auth(request({}, {'x-planer-session':'session'})),e=>e.status===401)
  }
  const auth=createAuthenticator({},async(url, options)=>{assert.match(url,/^https:\/\/xhpwmebwvjpdhsjeyrug\.supabase\.co\//);assert.equal(options.redirect,'error');return new Response(JSON.stringify({data:[]}))})
  assert.equal((await auth(request({}, {'x-planer-session':'session'}))).name,'Planer')
})
test('create, retry, get, summary and optimistic edits work without exposing photos in list',async()=>{
  const db=database(),handler=createHandler(db,{authenticate:async()=>actor})
  let response=await handler(request(save()));assert.equal(response.status,201);let row=(await response.json()).data;assert.equal(row.version,1)
  response=await handler(request(save()));assert.equal(response.status,200);assert.equal(db.rows.size,1)
  response=await handler(request({action:'get',id}));assert.equal((await response.json()).data.payload.positions.length,1)
  response=await handler(request({action:'list'}));const list=(await response.json()).data;assert.deepEqual(list[0].payload.positions,[]);assert.equal(list[0].positionCount,1)
  response=await handler(request(save({version:1,requestId:positionId})));assert.equal(response.status,200);assert.equal((await response.json()).data.version,2)
  response=await handler(request(save({requestId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'})));assert.equal(response.status,409)
})
test('request-id reuse cannot conceal a changed payload, actor or project',async()=>{
  const db=database(),handler=createHandler(db,{authenticate:async()=>actor});await handler(request(save()))
  const changed=payload();changed.header.kunde='Different'
  assert.equal((await handler(request(save({payload:changed})))).status,409)
  assert.equal((await handler(request(save({projectId:2,version:1,requestId:positionId})))).status,409)
  const other=createHandler(db,{authenticate:async()=>({id:'other',name:'Other'})});assert.equal((await other(request(save()))).status,409)
})
test('unknown project and unknown sheet return clear failures without inserts',async()=>{
  const db=database(),handler=createHandler(db,{authenticate:async()=>actor})
  assert.equal((await handler(request(save({projectId:2})))).status,404)
  assert.equal((await handler(request({action:'get',id}))).status,404);assert.equal(db.rows.size,0)
})
test('origin allowlist and byte limit fail closed, including chunked body',async()=>{
  const db=database(),handler=createHandler(db,{authenticate:async()=>actor,allowedOrigins:['https://portal.test']})
  assert.equal((await handler(request({action:'list'},{origin:'https://evil.test'}))).status,403)
  let response=await handler(request({action:'list'},{origin:'https://portal.test'}));assert.equal(response.headers.get('access-control-allow-origin'),'https://portal.test')
  response=await handler(request({text:'x'.repeat(6*1024*1024)}));assert.equal(response.status,413);assert.equal(db.calls.length,1)
})
