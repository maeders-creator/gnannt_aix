import test from 'node:test'
import assert from 'node:assert/strict'
import {createPlannerClient} from '../src/plannerClient.mjs'
const endpoint='https://example.invalid/api'
test('project download sends the planner session and returns bytes',async t=>{
 const calls=[]
 t.mock.method(globalThis,'fetch',async(url,options)=>{calls.push({url,options});return new Response('pdf',{headers:{'Content-Type':'application/pdf'}})})
 const blob=await createPlannerClient('test-session',endpoint).downloadProject(7)
 assert.equal(await blob.text(),'pdf');assert.equal(calls[0].url,endpoint)
 assert.equal(calls[0].options.headers['x-planer-session'],'test-session')
 assert.deepEqual(JSON.parse(calls[0].options.body),{action:'planner-projects',op:'download',id:7})
})
test('project upload obtains signed URL using login, PUTs bytes, and returns persisted reference',async t=>{
 const calls=[],file=new Blob(['pdf'],{type:'application/pdf'})
 const publicUrl='https://xhpwmebwvjpdhsjeyrug.supabase.co/storage/v1/object/public/uploads/projects/7_test.pdf'
 t.mock.method(globalThis,'fetch',async(url,options)=>{calls.push({url,options});return calls.length===1?Response.json({data:{signedUrl:'https://example.invalid/signed',publicUrl},error:null}):new Response('',{status:200})})
 assert.equal(await createPlannerClient('test-session',endpoint).uploadProject('projects/7_test.pdf',file),publicUrl)
 assert.equal(calls[0].options.headers['x-planer-session'],'test-session')
 assert.deepEqual(JSON.parse(calls[0].options.body),{action:'planner-projects',op:'upload-url',path:'projects/7_test.pdf'})
 assert.equal(calls[1].url,'https://example.invalid/signed');assert.equal(calls[1].options.method,'PUT');assert.equal(calls[1].options.body,file)
 assert.equal(calls[1].options.headers['Content-Type'],'application/pdf');assert.equal(calls[1].options.headers['x-planer-session'],undefined)
})
test('missing login, rejected sessions, invalid upload responses and failed PUTs fail closed',async t=>{
 let calls=0
 t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({error:'Sitzung abgelaufen'},{status:401})})
 await assert.rejects(()=>createPlannerClient('',endpoint).downloadProject(1),/anmelden/);assert.equal(calls,0)
 const client=createPlannerClient('test-session',endpoint)
 await assert.rejects(()=>client.downloadProject(1),/abgelaufen/)
 t.mock.method(globalThis,'fetch',async()=>Response.json({data:{}}))
 await assert.rejects(()=>client.uploadProject('projects/1_test.pdf',new Blob(['pdf'])),/vorbereitet/)
 t.mock.method(globalThis,'fetch',async url=>url===endpoint?Response.json({data:{signedUrl:'https://example.invalid/signed',publicUrl:'reference'}}):new Response('',{status:403}))
 await assert.rejects(()=>client.uploadProject('projects/1_test.pdf',new Blob(['pdf'])),/hochgeladen/)
})
