import test from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs'
import {createRequire} from 'node:module'
import path from 'node:path'
import React from 'react'
import Renderer,{act} from 'react-test-renderer'
const directory=mkdtempSync(path.resolve('tests/.cache-ui-test-'))
const compiled=await build({entryPoints:['src/PrivateCacheMaintenance.jsx'],bundle:true,write:false,format:'cjs',platform:'node',jsx:'automatic',external:['react','react/jsx-runtime']})
const filename=path.join(directory,'cache.cjs');writeFileSync(filename,compiled.outputFiles[0].text)
const Maintenance=createRequire(import.meta.url)(filename).default
process.on('exit',()=>rmSync(directory,{recursive:true,force:true}))
test('maintenance is absent without authenticated client capability',()=>{
 let view;act(()=>{view=Renderer.create(React.createElement(Maintenance,{}))});assert.equal(view.toJSON(),null);act(()=>view.unmount())
})
test('repeated clicks run one purge and show truthful propagation and local-copy limits',async()=>{
 let view,finish,calls=0,pending;const purge=()=>{calls++;return new Promise(resolve=>{finish=resolve})}
 act(()=>{view=Renderer.create(React.createElement(Maintenance,{purge}))})
 act(()=>{pending=view.root.findByType('button').props.onClick();view.root.findByType('button').props.onClick()});assert.equal(calls,1);assert.equal(view.root.findByType('button').props.disabled,true)
 await act(async()=>{finish({data:{purged:true}});await pending})
 assert.match(view.root.findByProps({role:'status'}).children.join(''),/60 Sekunden/);assert.match(view.root.findByProps({role:'status'}).children.join(''),/heruntergeladene Kopien/);act(()=>view.unmount())
})
test('failed purge leaves a retryable button and never claims success',async()=>{
 let view;act(()=>{view=Renderer.create(React.createElement(Maintenance,{purge:async()=>({error:{message:'Sitzung abgelaufen'}})}))})
 await act(async()=>view.root.findByType('button').props.onClick());assert.equal(view.root.findByType('button').props.disabled,false);assert.match(view.root.findByProps({role:'status'}).children.join(''),/abgelaufen/);act(()=>view.unmount())
})
