import test from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs'
import {createRequire} from 'node:module'
import path from 'node:path'
import React from 'react'
import Renderer,{act} from 'react-test-renderer'
const directory=mkdtempSync(path.resolve('tests/.document-ui-test-'))
const compiled=await build({entryPoints:['src/PrivateDocumentButton.jsx'],bundle:true,write:false,format:'cjs',platform:'node',jsx:'automatic',external:['react','react/jsx-runtime']})
const filename=path.join(directory,'button.cjs');writeFileSync(filename,compiled.outputFiles[0].text)
const {default:Button,isPrivateDocument,ProjectDocument}=createRequire(import.meta.url)(filename)
process.on('exit',()=>rmSync(directory,{recursive:true,force:true}))
const prefix='https://xhpwmebwvjpdhsjeyrug.supabase.co/storage/v1/object/public/uploads/'
const render=(Component,props)=>{let view;act(()=>{view=Renderer.create(React.createElement(Component,props))});return view}
const close=view=>act(()=>view.unmount())
test('private markers and exact portal storage URLs use authenticated buttons; external links stay external',()=>{
 for(const url of ['gnannt-private:knowledge/test.pdf',prefix+'knowledge/test.pdf',prefix+'projects/test.pdf'])assert.equal(isPrivateDocument({url}),true)
 for(const url of ['https://manufacturer.example/file.pdf','https://evil.example/'+prefix+'projects/test.pdf',null])assert.equal(isPrivateDocument({url}),false)
 const privateView=render(ProjectDocument,{project:{id:1,attachment_url:prefix+'projects/test.pdf'}})
 assert.equal(privateView.root.findAllByType('a').length,0);assert.equal(privateView.root.findByType('button').props.type,'button');close(privateView)
 const external=render(ProjectDocument,{project:{attachment_url:'https://manufacturer.example/file.pdf'}})
 assert.equal(external.root.findByType('a').props.href,'https://manufacturer.example/file.pdf');close(external)
 const unsafe=render(ProjectDocument,{project:{attachment_url:'javascript:alert(1)'}});assert.equal(unsafe.toJSON(),null);close(unsafe)
})
test('expired access and unavailable login show errors rather than exposing a file URL',async()=>{
 for(const download of [undefined,async()=>{throw Error('Sitzung abgelaufen. Bitte erneut anmelden.')}]){
  const view=render(Button,{doc:{id:1},download})
  await act(async()=>view.root.findByType('button').props.onClick())
  assert.match(view.root.findByProps({role:'alert'}).children.join(''),/anmelden/)
  assert.equal(view.root.findByType('button').props.disabled,false);close(view)
 }
})
test('repeated click issues one request and an invalid response can be retried',async()=>{
 let resolve,calls=0
 const view=render(Button,{doc:{id:1},download:()=>{calls++;return new Promise(r=>{resolve=r})}})
 let first
 act(()=>{first=view.root.findByType('button').props.onClick();view.root.findByType('button').props.onClick()})
 assert.equal(calls,1);assert.equal(view.root.findByType('button').props.disabled,true)
 await act(async()=>{resolve(new Blob(['error'],{type:'application/json'}));await first})
 assert.match(view.root.findByProps({role:'alert'}).children.join(''),/Ungültige/)
 let retry;act(()=>{retry=view.root.findByType('button').props.onClick()});assert.equal(calls,2)
 await act(async()=>{resolve(new Blob([],{type:'application/pdf'}));await retry});close(view)
})
test('PDF, image and video responses create local downloads and revoke their object URLs',async t=>{
 const clicks=[],revoked=[],timers=[]
 t.mock.method(URL,'createObjectURL',()=> 'blob:local-test')
 t.mock.method(URL,'revokeObjectURL',url=>revoked.push(url))
 t.mock.method(globalThis,'setTimeout',fn=>{timers.push(fn);return 0})
 const oldDocument=globalThis.document
 globalThis.document={body:{append(){}},createElement(){return {click(){clicks.push({name:this.download,url:this.href})},remove(){}}}}
 t.after(()=>{if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument})
 for(const mime of ['application/pdf','image/png','video/mp4']){
  const view=render(Button,{doc:{id:1,file_name:'test-file'},download:async()=>new Blob(['bytes'],{type:mime})})
  await act(async()=>view.root.findByType('button').props.onClick())
  assert.equal(view.root.findAllByProps({role:'alert'}).length,0);close(view)
 }
 assert.equal(clicks.length,3);assert.ok(clicks.every(c=>c.name==='test-file'&&c.url==='blob:local-test'))
 timers.forEach(fn=>fn());assert.equal(revoked.length,3)
})
