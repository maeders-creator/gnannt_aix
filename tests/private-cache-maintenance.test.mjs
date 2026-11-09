import test from 'node:test'
import assert from 'node:assert/strict'
import {createHmac} from 'node:crypto'
import {createHandler} from '../supabase/functions/gnannt-calculator/handler.mjs'
import {plannerKnowledge} from '../supabase/functions/gnannt-calculator/planner-knowledge.mjs'
import {createKnowledgeClient} from '../src/knowledgeClient.mjs'

const secret='unit-test-only-not-real'
function session(){const body='planer.'+(Date.now()+60000);return body+'.'+createHmac('sha256',secret).update(body).digest('hex')}
const request=credential=>new Request('https://test.invalid',{method:'POST',headers:credential?{'x-planer-session':credential}:{},body:JSON.stringify({action:'planner-knowledge',op:'purge-public-cache'})})
function db({publicBucket=false,lookupError=false,purgeError=false}={}){const calls=[];return {calls,storage:{async getBucket(id){calls.push(['getBucket',id]);return lookupError?{error:{message:'private backend error'}}:{data:{id,public:publicBucket}}},async purgeBucketCache(id){calls.push(['purgeBucketCache',id]);return purgeError?{error:{message:'private backend error'}}:{data:{message:'success'},error:null}}}}}
test('cache purge rejects anonymous and invalid planner sessions before storage access',async()=>{
 for(const token of ['',session()+'invalid']){const client=db();const response=await createHandler(client,'','',secret)(request(token));assert.equal(response.status,401);assert.deepEqual(client.calls,[])}
})
test('authenticated purge operates only on private uploads and returns no storage credentials',async()=>{
 const client=db();const response=await createHandler(client,'','',secret)(request(session()));assert.equal(response.status,200);assert.deepEqual(await response.json(),{data:{purged:true},error:null});assert.deepEqual(client.calls,[['getBucket','uploads'],['purgeBucketCache','uploads']])
})
test('public bucket, bucket error and purge error fail closed without exposing backend details',async()=>{
 for(const options of [{publicBucket:true},{lookupError:true},{purgeError:true}]){const client=db(options);await assert.rejects(()=>plannerKnowledge(client,{op:'purge-public-cache',bucket:'other-bucket'}),error=>!error.message.includes('private backend error'));assert.ok(client.calls.every(call=>call[1]==='uploads'));if(!options.purgeError)assert.equal(client.calls.length,1)}
})
test('client uses the existing planner session and a fixed maintenance operation',async t=>{
 let sent;t.mock.method(globalThis,'fetch',async(url,options)=>{sent={url,options};return Response.json({data:{purged:true},error:null})});assert.equal((await createKnowledgeClient('test-session').purgePublicCache()).data.purged,true);assert.equal(sent.options.headers['x-planer-session'],'test-session');assert.deepEqual(JSON.parse(sent.options.body),{action:'planner-knowledge',op:'purge-public-cache'})
})
