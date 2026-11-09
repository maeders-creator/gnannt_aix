import test from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import path from 'node:path'
import React from 'react'
import Renderer,{act} from 'react-test-renderer'
const directory=mkdtempSync(path.resolve('tests/.wuerth-test-'))
const compiled=await build({entryPoints:['src/WuerthCatalog.jsx'],bundle:true,write:false,format:'cjs',platform:'node',jsx:'automatic',external:['react','react/jsx-runtime'],loader:{'.css':'empty'}})
const filename=path.join(directory,'app.cjs');writeFileSync(filename,compiled.outputFiles[0].text)
const Catalog=createRequire(import.meta.url)(filename).default
process.on('exit',()=>rmSync(directory,{recursive:true,force:true}))
const text=node=>typeof node==='string'?node:node.children?.map(text).join('')||''
test('catalog is truthful, disabled and does not request credentials or make network calls',async()=>{
  const original=globalThis.fetch;let calls=0;globalThis.fetch=()=>{calls++;throw new Error('No external calls expected')}
  let view
  try {
    await act(async()=>{view=Renderer.create(React.createElement(Catalog))})
    assert.match(text(view.root),/Noch nicht verbunden/)
    assert.match(text(view.root),/keine Live-Preise/)
    assert.equal(view.root.findAllByType('input').length,0)
    assert.equal(view.root.findAllByType('a').length,0)
    const launch=view.root.findAllByType('button').find(n=>text(n).includes('Katalog öffnen'))
    assert.equal(launch.props.disabled,true)
    assert.equal(launch.props.onClick,undefined)
    assert.equal(calls,0)
  } finally { await act(async()=>view?.unmount());globalThis.fetch=original }
})
test('help card and credential fields are absent',async()=>{
  let view;await act(async()=>{view=Renderer.create(React.createElement(Catalog))})
  assert.doesNotMatch(text(view.root),/So funktioniert die Anbindung|Was fehlt noch|Details ausblenden/)
  assert.equal(view.root.findAllByProps({type:'password'}).length,0)
  await act(async()=>view.unmount())
})
test('tab is registered inside authenticated app and does not appear on public screen path',()=>{
  const source=readFileSync('src/App.jsx','utf8')
  assert.match(source,/\['wuerth','Würth'\]/)
  assert.match(source,/tab === 'wuerth' \? <WuerthCatalog plannerSession=\{plannerSession\}\/>/)
  assert.ok(source.indexOf("if (tab === 'screen') return")<source.indexOf("['wuerth','Würth']"))
  assert.ok(source.indexOf('if (!user)')<source.indexOf("['wuerth','Würth']"))
})
const fakeLaunch={method:'POST',action:'https://eshop.wuerth.de/is-bin/INTERSHOP.enfinity/WFS/1401-B1-Site/de_DE/-/EUR/OCICatalogService-Inbound',fields:{ORGANIZATION:'DEMO',NAME:'DEMO',PASSWORD:'fake-test-only',HOOK_URL:'https://xhpwmebwvjpdhsjeyrug.supabase.co/functions/v1/wuerth-oci/return/'+'a'.repeat(43)}}
function fakePopup(){
 const popup={closed:false,focusCount:0,closeCount:0,focus(){this.focusCount++},close(){this.closed=true;this.closeCount++}}
 popup.document={title:'',head:{append(){}},body:{replaceChildren(){}},createElement(){return {append(){},submit(){}}}}
 return popup
}
test('repeated open focuses the tracked window and unmount closes it',async()=>{
 const previousFetch=globalThis.fetch,previousWindow=globalThis.window;let launches=0,opens=0;const popup=fakePopup()
 globalThis.window={open(){opens++;return popup}}
 globalThis.fetch=async(_url,options)=>{const action=JSON.parse(options.body).action;if(action==='launch')launches++;return {ok:true,json:async()=>action==='status'?{configured:true}:{id:'a1111111-1111-4111-8111-111111111111',launch:fakeLaunch}}}
 let view
 try{
  await act(async()=>{view=Renderer.create(React.createElement(Catalog,{plannerSession:'fake-login'}))})
  const button=()=>view.root.findAllByType('button').find(n=>text(n)===' Katalog öffnen')||view.root.findAllByType('button').find(n=>text(n).includes('Katalog öffnen'))
  await act(async()=>button().props.onClick());await act(async()=>button().props.onClick())
  assert.equal(opens,1);assert.equal(launches,1);assert.equal(popup.focusCount,1)
  await act(async()=>view.unmount());view=null;assert.equal(popup.closeCount,1)
 }finally{await act(async()=>view?.unmount());globalThis.fetch=previousFetch;globalThis.window=previousWindow}
})
test('session change cancels pending launch, clears busy and never submits stale credentials',async()=>{
 const previousFetch=globalThis.fetch,previousWindow=globalThis.window;const popup=fakePopup();let resolveLaunch
 globalThis.window={open:()=>popup}
 globalThis.fetch=async(_url,options)=>['status','products'].includes(JSON.parse(options.body).action)?{ok:true,json:async()=>({configured:true,products:[]})}:await new Promise(resolve=>{resolveLaunch=resolve})
 let view,pending
 try{
  await act(async()=>{view=Renderer.create(React.createElement(Catalog,{plannerSession:'old-login'}))})
  const button=()=>view.root.findAllByType('button').find(n=>text(n).includes('Katalog öffnen'))
  await act(async()=>{pending=button().props.onClick()})
  assert.equal(button().props.disabled,true)
  await act(async()=>view.update(React.createElement(Catalog,{plannerSession:'new-login'})))
  assert.equal(button().props.disabled,false);assert.equal(popup.closed,true)
  await act(async()=>{resolveLaunch({ok:true,json:async()=>({id:'a1111111-1111-4111-8111-111111111111',launch:fakeLaunch})});await pending})
  assert.equal(view.root.findAllByType('button').some(n=>text(n)==='Auswahl abrufen'),false)
 }finally{await act(async()=>view?.unmount());globalThis.fetch=previousFetch;globalThis.window=previousWindow}
})

const products=[{article_number:'001 AB',description:'Schraube',product_group:'Befestigung',source_row:2},{article_number:'002',description:'Dichtung',product_group:'Dichtstoffe',source_row:3}]
test('authenticated products load, filter by search/group, and clear on logout',async()=>{
 const original=globalThis.fetch;const calls=[]
 globalThis.fetch=async(_url,options)=>{calls.push(JSON.parse(options.body).action);return {ok:true,json:async()=>JSON.parse(options.body).action==='products'?{products,source:'Test.xlsx'}:{configured:false}}}
 let view
 try{
  await act(async()=>{view=Renderer.create(React.createElement(Catalog,{plannerSession:'test-login'}))})
  assert.deepEqual(calls.sort(),['products','status']);assert.match(text(view.root),/2 Artikel · 2 Produktgruppen/)
  assert.equal(view.root.findAllByType('summary').length,2)
  assert.match(text(view.root),/Noch kein OCI-Preis/)
  await act(async()=>view.root.findByType('input').props.onChange({target:{value:'001ab'}}))
  assert.equal(view.root.findAllByType('summary').length,1);assert.match(text(view.root),/Schraube/)
  await act(async()=>view.root.findByType('input').props.onChange({target:{value:''}}))
  await act(async()=>view.root.findByType('select').props.onChange({target:{value:'Dichtstoffe'}}))
  assert.equal(view.root.findAllByType('summary').length,1)
  await act(async()=>view.update(React.createElement(Catalog,{plannerSession:''})))
  assert.doesNotMatch(text(view.root),/Test.xlsx|Dichtung|Schraube/)
  assert.equal(view.root.findAllByType('input').length,0)
 }finally{await act(async()=>view?.unmount());globalThis.fetch=original}
})
test('late products response after logout cannot restore private products',async()=>{
 const original=globalThis.fetch;let resolveProducts;let view
 globalThis.fetch=async(_url,options)=>JSON.parse(options.body).action==='products'?await new Promise(resolve=>{resolveProducts=resolve}):{ok:true,json:async()=>({configured:false})}
 try{
  await act(async()=>{view=Renderer.create(React.createElement(Catalog,{plannerSession:'old-login'}))})
  await act(async()=>view.update(React.createElement(Catalog,{plannerSession:''})))
  await act(async()=>resolveProducts({ok:true,json:async()=>({products,source:'Private.xlsx'})}))
  assert.doesNotMatch(text(view.root),/Private.xlsx|Schraube|Dichtung/)
 }finally{await act(async()=>view?.unmount());globalThis.fetch=original}
})
test('product load failure can retry independently of OCI status',async()=>{
 const original=globalThis.fetch;let attempts=0;let view
 globalThis.fetch=async(_url,options)=>{if(JSON.parse(options.body).action==='status')throw new Error('offline');if(++attempts===1)throw new Error('offline');return {ok:true,json:async()=>({products,source:'Test.xlsx'})}}
 try{
  await act(async()=>{view=Renderer.create(React.createElement(Catalog,{plannerSession:'test-login'}))})
  assert.match(text(view.root),/Artikelliste konnte nicht geladen/)
  await act(async()=>view.root.findAllByType('button').find(n=>text(n)==='Artikelliste erneut laden').props.onClick())
  assert.match(text(view.root),/Schraube/);assert.equal(attempts,2)
 }finally{await act(async()=>view?.unmount());globalThis.fetch=original}
})
test('OCI rendering preserves zero and different duplicate prices, rejects material-number matching and clears cart on session change',async()=>{
 const originalFetch=globalThis.fetch,originalWindow=globalThis.window;let view
 globalThis.window={open:()=>fakePopup()}
 globalThis.fetch=async(_url,options)=>{const action=JSON.parse(options.body).action;return {ok:true,json:async()=>action==='products'?{products}:action==='status'?{configured:true}:action==='launch'?{id:'a1111111-1111-4111-8111-111111111111',launch:fakeLaunch}:{status:'returned',cart:{items:[{index:1,supplierArticle:'001AB',price:0,currency:'EUR',priceUnit:100,quantity:20,unit:'ST'},{index:2,supplierArticle:'001AB',price:7,currency:'EUR',priceUnit:1,quantity:5,unit:'ST'},{index:3,materialNumber:'002',price:99,currency:'EUR',priceUnit:1,quantity:1,unit:'ST'}]}}}}
 try{
  await act(async()=>{view=Renderer.create(React.createElement(Catalog,{plannerSession:'test-login'}))})
  const button=label=>view.root.findAllByType('button').find(n=>text(n).includes(label))
  await act(async()=>button('Katalog öffnen').props.onClick())
  await act(async()=>button('Auswahl abrufen').props.onClick())
  const entries=view.root.findAllByProps({className:'wu-product'})
  assert.match(text(entries[0]),/0 EUR je 100 ST/);assert.match(text(entries[0]),/7 EUR je 1 ST/);assert.match(text(entries[0]),/Menge 20 ST/);assert.match(text(entries[0]),/Mehrere OCI-Positionen/)
  assert.match(text(entries[1]),/Noch kein OCI-Preis/);assert.doesNotMatch(text(entries[1]),/99 EUR/)
  await act(async()=>view.update(React.createElement(Catalog,{plannerSession:'different-login'})))
  assert.doesNotMatch(text(view.root),/0 EUR je 100 ST|Deine Katalogauswahl/)
 }finally{await act(async()=>view?.unmount());globalThis.fetch=originalFetch;globalThis.window=originalWindow}
})
