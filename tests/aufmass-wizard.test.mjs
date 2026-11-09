import test from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs'
import {createRequire} from 'node:module'
import path from 'node:path'
import React from 'react'
import Renderer,{act} from 'react-test-renderer'
const directory=mkdtempSync(path.resolve('tests/.wizard-test-'))
const compiled=await build({entryPoints:['src/AufmassApp.jsx'],bundle:true,write:false,format:'cjs',platform:'node',jsx:'automatic',external:['react','react/jsx-runtime'],loader:{'.css':'empty'},define:{'import.meta.env.VITE_AUFMASS_API_URL':'"https://example.invalid/api"'}})
const filename=path.join(directory,'app.cjs');writeFileSync(filename,compiled.outputFiles[0].text)
const App=createRequire(import.meta.url)(filename).default
process.on('exit',()=>rmSync(directory,{recursive:true,force:true}))
const text=node=>typeof node==='string'?node:node.children?.map(text).join('')||''
const button=(root,fragment)=>root.findAllByType('button').find(b=>text(b).includes(fragment))
const field=(root,label,type='input')=>root.findAllByType('label').find(l=>text(l).startsWith(label)).findByType(type)
function environment(){globalThis.window={location:{origin:'http://localhost'},addEventListener(){},removeEventListener(){},scrollTo(){},confirm(){return true},print(){}};Object.defineProperty(globalThis.navigator,'onLine',{value:true,configurable:true})}
const props={projects:[{id:1,projekt:'Testprojekt',kunde:'Testkunde'}],plannerSession:'synthetic-test-session',employees:['Testperson'],onCreateProject:async()=>({id:2}),onRefreshProjects:async()=>{}}
const canvas={width:720,height:360,getContext:()=>({clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}})}
async function click(node){await act(async()=>node.props.onClick())}
async function enter(node,value){await act(async()=>node.props.onChange({target:{value}}))}
async function start(root){await enter(field(root,'Projekt auswählen','select'),'1');await click(button(root,'Kunststoff'));await click(button(root,'Weiter: Position'))}
test('wizard guides one position, preserves back/next edits, adds positions and saves all fields',async()=>{
 environment();let saved;
 globalThis.fetch=async(_url,options)=>{const input=JSON.parse(options.body);if(input.action==='save'){saved=input;return{ok:true,json:async()=>({data:{...input,version:input.version+1}})}}return{ok:true,json:async()=>({data:[]})}}
 let view;await act(async()=>{view=Renderer.create(React.createElement(App,props),{createNodeMock:e=>e.type==='canvas'?canvas:null})});const root=view.root
 await click(button(root,'Weiter: Position'));assert.ok(root.findAll(n=>n.props.role==='alert').some(n=>text(n).includes('Projekt')))
 await start(root);await enter(field(root,'Bezeichnung / Raum'),'Wohnzimmer links');await enter(field(root,'Glasart'),'satiniert');await click(button(root,'Weiter: Maße'))
 await enter(field(root,'Breite'),'1200');await enter(field(root,'Versatz'),'-12.5');await click(button(root,'← Zurück'));assert.equal(field(root,'Bezeichnung / Raum').props.value,'Wohnzimmer links');await click(button(root,'Weiter: Maße'));assert.equal(field(root,'Breite').props.value,'1200')
 await click(button(root,'Weiter: Foto'));await click(button(root,'Weiteres Fenster'));assert.equal(root.findByProps({className:'am-step-counter'}).children.join(''),'Schritt 2 von 5 · Position');assert.equal(field(root,'Aktuelle Position','select').props.value,1)
 const names=root.findAllByType('input').filter(n=>n.props.placeholder==='z. B. Wohnzimmer links');await enter(names[1],'Küche');await click(button(root,'Weiter: Maße'));await click(button(root,'Weiter: Foto'));await click(button(root,'Zur Übersicht'))
 assert.ok(root.findByProps({className:'am-review is-visible'}));await click(button(root,'Aufmaß speichern'));assert.equal(saved.payload.positions.length,2);assert.equal(saved.payload.positions[0].breite,'1200');assert.equal(saved.payload.positions[0].versatz,'-12.5');assert.equal(saved.payload.positions[0].glasart,'satiniert');assert.equal(saved.payload.positions[1].bezeichnung,'Küche');await act(async()=>view.unmount())
})
test('invalid quantity blocks next and removing a position keeps a valid active selection',async()=>{
 environment();globalThis.fetch=async()=>({ok:true,json:async()=>({data:[]})});let view;await act(async()=>{view=Renderer.create(React.createElement(App,props),{createNodeMock:e=>e.type==='canvas'?canvas:null})});const root=view.root;await start(root);await enter(field(root,'Stückzahl'),'0');await click(button(root,'Weiter: Maße'));assert.ok(root.findAll(n=>n.props.role==='alert').some(n=>text(n).includes('Stückzahl')));await enter(field(root,'Stückzahl'),'1');await click(button(root,'Weiter: Maße'));await click(button(root,'Weiter: Foto'));await click(button(root,'Weiteres Fenster'));const deletes=root.findAllByType('button').filter(b=>text(b)==='Diese Position entfernen');await click(deletes[1]);assert.equal(field(root,'Aktuelle Position','select').props.value,0);await act(async()=>view.unmount())
})
test('saved sheets reopen in review with complete photos/sketch and immutable project',async()=>{
 environment();const sheet={id:'6a87913f-3012-4bea-9c90-6117afaa0f53',projectId:1,version:2,payload:{header:{kunde:'Testkunde',ausfuehrung:'Holz',farbe:'weiß',glasBemerkungen:'Test'},positions:[{id:'8b213d6b-822e-4856-9e98-c82da518f047',bezeichnung:'Bestand',rollladen:true,stueckzahl:1,rollladenLeisten:'Leiste',fensterbankInnen:'Stein',fensterbankAussen:'Alu',glasart:'Float',randverbundFarbe:'schwarz',zusatztext:'Hinweis',breite:'900',hoehe:'1200',rahmenSeitlich:'68',rahmenOben:'68',rahmenUnten:'78',nutmass:'10',leibungAussenBreite:'920',leibungAussenHoehe:'1220',leibungInnenBreite:'950',leibungInnenHoehe:'1250',schraegmass:'1500',versatz:'-5',sketch:[[{x:0,y:0},{x:1,y:1}]],photos:[{id:'test-photo',name:'Testfoto',dataUrl:'data:image/jpeg;base64,test'}]}]}};
 globalThis.fetch=async(_url,options)=>({ok:true,json:async()=>({data:JSON.parse(options.body).action==='list'?[sheet]:sheet})});let view;await act(async()=>{view=Renderer.create(React.createElement(App,props),{createNodeMock:e=>e.type==='canvas'?canvas:null})});const root=view.root;await enter(field(root,'Vorhandenes Aufmaß öffnen','select'),sheet.id);assert.ok(root.findByProps({className:'am-review is-visible'}));assert.equal(field(root,'Projekt auswählen','select').props.disabled,true);assert.equal(root.findAllByType('polyline').length,1);await click(button(root,'Position bearbeiten'));assert.equal(field(root,'Bezeichnung / Raum').props.value,'Bestand');assert.equal(field(root,'Rollladen','select').props.value,'ja');await act(async()=>view.unmount())
})
test('separate window back stays on validation/save failure and saves dirty work before returning',async()=>{
 environment();let returned=0,attempts=0,fail=true
 globalThis.fetch=async(_url,options)=>{const input=JSON.parse(options.body);if(input.action==='save'){attempts++;return{ok:!fail,json:async()=>fail?{error:'Speichern fehlgeschlagen'}:{data:{...input,version:1}}}}return{ok:true,json:async()=>({data:[]})}}
 let view;await act(async()=>{view=Renderer.create(React.createElement(App,{...props,onBack:()=>returned++}),{createNodeMock:e=>e.type==='canvas'?canvas:null})});const root=view.root
 await enter(field(root,'Kunde'),'Kunde');await click(button(root,'Zurück ins Portal'));assert.equal(returned,0);assert.equal(attempts,0)
 await start(root);await click(button(root,'Zurück ins Portal'));assert.equal(returned,0);assert.equal(attempts,1);assert.ok(root.findAll(n=>n.props.role==='alert').some(n=>text(n).includes('Speichern fehlgeschlagen')))
 fail=false;await click(button(root,'Zurück ins Portal'));assert.equal(returned,1);assert.equal(attempts,2);await act(async()=>view.unmount())
})
