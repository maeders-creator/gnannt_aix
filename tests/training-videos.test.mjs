import test from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtempSync,writeFileSync,rmSync,readFileSync,existsSync} from 'node:fs'
import {createRequire} from 'node:module'
import path from 'node:path'
import React from 'react'
import Renderer,{act} from 'react-test-renderer'
import {createKnowledgeClient} from '../src/knowledgeClient.mjs'
const directory=mkdtempSync(path.resolve('tests/.training-test-'))
const compiled=await build({entryPoints:['src/TrainingVideos.jsx'],bundle:true,write:false,format:'cjs',platform:'node',jsx:'automatic',external:['react','react/jsx-runtime']})
const filename=path.join(directory,'videos.cjs');writeFileSync(filename,compiled.outputFiles[0].text)
const Videos=createRequire(import.meta.url)(filename).default
process.on('exit',()=>rmSync(directory,{recursive:true,force:true}))
const record={title:'Private catalog test',category:'Montage',url:'https://youtube.com/watch?v=abcdefghijk',youtubeId:'abcdefghijk'}
test('catalog is preserved server-side with no public static catalog or observer entry point',()=>{
 const catalog=JSON.parse(readFileSync('supabase/functions/_shared/training-videos.json','utf8'))
 assert.equal(catalog.length,11);assert.ok(catalog.every(v=>v.title&&v.url&&v.youtubeId))
 assert.equal(existsSync('public/wissensdatenbank'),false);assert.equal(existsSync('public/wissensdatenbank.html'),false)
 assert.doesNotMatch(readFileSync('index.html','utf8'),/knowledge-entry/)
 for(const file of ['src/KnowledgeBase.jsx','src/MonteurViews.jsx'])assert.match(readFileSync(file,'utf8'),/<TrainingVideos loadVideos=/)
})
test('planner catalog request uses the existing authenticated endpoint and session',async t=>{
 let request
 t.mock.method(globalThis,'fetch',async(url,options)=>{request={url,options};return Response.json({data:[record],error:null})})
 assert.deepEqual((await createKnowledgeClient('test-session').loadTrainingVideos()).data,[record])
 assert.equal(request.options.headers['x-planer-session'],'test-session')
 assert.deepEqual(JSON.parse(request.options.body),{op:'training-videos',action:'planner-knowledge'})
})
test('video UI fails closed without login and supports retry after an expired session',async()=>{
 let view
 await act(async()=>{view=Renderer.create(React.createElement(Videos,{}))})
 assert.match(view.root.findByProps({role:'alert'}).children.join(''),/anmelden/);assert.equal(view.root.findAllByType('a').length,0)
 let calls=0
 const loadVideos=async()=>{if(++calls===1)throw Error('Sitzung abgelaufen');return{data:[record]}}
 await act(async()=>view.update(React.createElement(Videos,{loadVideos})))
 assert.match(view.root.findByProps({role:'alert'}).children.join(''),/abgelaufen/)
 await act(async()=>view.root.findByType('button').props.onClick())
 assert.equal(view.root.findByType('a').props.href,record.url)
 await act(async()=>view.root.findByType('input').props.onChange({target:{value:'not-matching'}}))
 assert.equal(view.root.findAllByType('a').length,0)
 act(()=>view.unmount())
})
test('a stale catalog request cannot repopulate videos after login changes',async()=>{
 let resolve,view
 await act(async()=>{view=Renderer.create(React.createElement(Videos,{loadVideos:()=>new Promise(r=>{resolve=r})}))})
 await act(async()=>view.update(React.createElement(Videos,{loadVideos:async()=>{throw Error('Nicht angemeldet')}})))
 await act(async()=>resolve({data:[record]}))
 assert.equal(view.root.findAllByType('a').length,0);assert.match(view.root.findByProps({role:'alert'}).children.join(''),/Nicht angemeldet/)
 act(()=>view.unmount())
})
