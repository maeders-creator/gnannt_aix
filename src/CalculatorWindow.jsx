import {useEffect,useRef,useState} from 'react'
import {ArrowLeft,Save} from 'lucide-react'
import Calculator from './Calculator'
import {readMonteurToken} from './monteurApi'
export default function CalculatorWindow(){
 const mode=new URLSearchParams(window.location.search).get('calculator'),calcRef=useRef(null)
 const [auth]=useState(()=>{try{return mode==='planer'?{plannerSession:sessionStorage.getItem('gnannt_planner_session_v1')||''}:{token:readMonteurToken()}}catch{return {}}})
 const [state,setState]=useState({active:false,dirty:false,name:''}),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('')
 useEffect(()=>{document.title='Gnannt · Fensterkalkulator'},[])
 const save=async()=>{setBusy(true);setError('');setMessage('');try{await calcRef.current.save();setMessage('Projekt gespeichert.');return true}catch(e){setError(e.message);return false}finally{setBusy(false)}}
 const back=async()=>{if(state.active&&!await save())return;try{if(window.opener&&!window.opener.closed){window.opener.focus();window.close();return}}catch{}window.location.assign(mode==='planer'?'/#buero':'/#monteur')}
 return <main className="calculator-window"><header className="calculator-window-toolbar"><button className="btn outline" disabled={busy} onClick={back}><ArrowLeft size={17}/> Zurück ins Portal</button><div><strong>{state.name||'Fensterkalkulator'}</strong><small role="status">{error||message||(state.dirty?'Änderungen werden gespeichert…':'Projekte und Positionen im Portal speichern')}</small></div><button className="btn primary" disabled={busy||!state.active} onClick={save}><Save size={17}/>{busy?'Speichert…':'Speichern'}</button></header>{auth.token||auth.plannerSession?<Calculator ref={calcRef} {...auth} fullWindow onState={setState}/>:<section className="panel" role="alert">Bitte den Kalkulator aus deinem angemeldeten Portalzugang öffnen.</section>}</main>
}
