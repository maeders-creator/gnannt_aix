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
test('setup details toggle repeatedly and reset on reopening tab',async()=>{
  let view;await act(async()=>{view=Renderer.create(React.createElement(Catalog))})
  const toggle=()=>view.root.findAllByType('button').find(n=>n.props['aria-controls']==='wu-setup-details')
  for(let i=0;i<3;i++){
    assert.equal(toggle().props['aria-expanded'],false)
    await act(async()=>toggle().props.onClick())
    assert.equal(toggle().props['aria-expanded'],true)
    assert.match(text(view.root),/separate OCI-Zugang/)
    assert.match(text(view.root),/nach eurer Rückmeldung/)
    await act(async()=>toggle().props.onClick())
    assert.equal(view.root.findAllByProps({id:'wu-setup-details'}).length,0)
  }
  await act(async()=>view.unmount())
  await act(async()=>{view=Renderer.create(React.createElement(Catalog))})
  assert.equal(toggle().props['aria-expanded'],false)
  await act(async()=>view.unmount())
})
test('tab is registered inside authenticated app and does not appear on public screen path',()=>{
  const source=readFileSync('src/App.jsx','utf8')
  assert.match(source,/\['wuerth','Würth'\]/)
  assert.match(source,/tab === 'wuerth' \? <WuerthCatalog\/>/)
  assert.ok(source.indexOf("if (tab === 'screen') return")<source.indexOf("['wuerth','Würth']"))
  assert.ok(source.indexOf('if (!user)')<source.indexOf("['wuerth','Würth']"))
})
