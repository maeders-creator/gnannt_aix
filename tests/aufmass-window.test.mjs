import test from 'node:test'
import assert from 'node:assert/strict'
import {openAufmassWindow, returnToPortal} from '../src/aufmassWindow.mjs'
test('window launch transfers auth without URL credentials, focuses repeats, and falls back when blocked',()=>{
 const saved=[];globalThis.sessionStorage={setItem:(...x)=>saved.push(x)};globalThis.localStorage={setItem:(...x)=>saved.push(x)}
 let calls=0,focus=0;const child={closed:false,focus(){focus++}}
 globalThis.window={open(url,target,features){calls++;assert.equal(url,'/?aufmass=planer');assert.equal(target,'_blank');assert.match(features,/popup/);return child}}
 assert.equal(openAufmassWindow({plannerSession:'synthetic'}),true);assert.deepEqual(saved,[['gnannt_planner_session_v1','synthetic']]);assert.equal(openAufmassWindow({plannerSession:'synthetic'}),true);assert.equal(calls,1);assert.equal(focus,2)
 child.closed=true;window.open=url=>{assert.equal(url,'/?aufmass=monteur');return null};assert.equal(openAufmassWindow({token:'test-token'}),false);assert.deepEqual(saved.at(-1),['gnannt_monteur_access_v1','test-token'])
 sessionStorage.setItem=()=>{throw Error('blocked')};assert.equal(openAufmassWindow({plannerSession:'synthetic'}),false)
})
test('return focuses and closes child or navigates to the correct portal when standalone',()=>{
 let focused=0,closed=0,url='';globalThis.window={opener:{closed:false,focus(){focused++}},closed:false,close(){closed++;this.closed=true},location:{assign(value){url=value}}}
 returnToPortal('monteur');assert.equal(focused,1);assert.equal(closed,1);assert.equal(url,'')
 window.opener=null;window.closed=false;returnToPortal('monteur');assert.equal(url,'/#monteur');returnToPortal('planer');assert.equal(url,'/#buero')
})
