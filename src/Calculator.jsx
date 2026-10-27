import { useEffect, useState, useRef } from 'react'
const endpoint = 'https://xhpwmebwvjpdhsjeyrug.supabase.co/functions/v1/gnannt-calculator'
export async function plannerCalculatorLogin(username, password) {
  const response = await fetch(endpoint, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'planner-login',username,password})})
  const result = await response.json()
  if(!response.ok) throw new Error(result.error || 'Anmeldung fehlgeschlagen.')
  return result.session
}
export async function hasCalculatorAccess(token) {
  try {const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','x-monteur-token':token},body:JSON.stringify({action:'access'})});return r.ok && (await r.json()).allowed === true} catch {return false}
}
export default function Calculator({ token, plannerSession }) {
  const frameRef = useRef(null)
  useEffect(()=>{
    const pending=new Set();let active=true
    const receive=async event=>{
      const frame=frameRef.current?.contentWindow
      if(event.source!==frame||event.origin!==window.location.origin||event.data?.type!=='gnannt-calculator-store')return
      const {requestId,operation,data={}}=event.data
      if(typeof requestId!=='string'||!['list','get','create','save'].includes(operation))return
      const controller=new AbortController();pending.add(controller)
      try {
        const r=await fetch(endpoint,{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json',...(token?{'x-monteur-token':token}:{}),...(plannerSession?{'x-planer-session':plannerSession}:{})},body:JSON.stringify({...data,action:'calculator-projects',op:operation})})
        const result=await r.json();if(!r.ok||result.error)throw Error(result.error?.message||result.error||'Projekte konnten nicht gespeichert werden.')
        if(active&&frame===frameRef.current?.contentWindow)frame.postMessage({type:'gnannt-calculator-store-result',requestId,data:result.data},window.location.origin)
      }catch(e){if(active&&frame===frameRef.current?.contentWindow)frame.postMessage({type:'gnannt-calculator-store-result',requestId,error:e.message},window.location.origin)}finally{pending.delete(controller)}
    }
    window.addEventListener('message',receive);return()=>{active=false;window.removeEventListener('message',receive);pending.forEach(c=>c.abort())}
  },[token,plannerSession])
  const [html,setHtml] = useState(''), [error,setError] = useState('')
  useEffect(()=>{const controller=new AbortController();setHtml('');setError('');fetch(endpoint,{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json',...(token?{'x-monteur-token':token}:{}),...(plannerSession?{'x-planer-session':plannerSession}:{})},body:JSON.stringify({action:'calculator'})}).then(async r=>{const body=await r.json();if(!r.ok)throw new Error(body.error||'Kein Zugriff.');setHtml(body.html)}).catch(e=>{if(e.name!=='AbortError')setError(e.message)});return()=>controller.abort()},[token,plannerSession])
  if(error)return <section className="panel" role="alert">{error}</section>
  if(!html)return <section className="panel">Kalkulator wird geladen…</section>
  return <iframe ref={frameRef} title="Gnannt Fensterkalkulator" srcDoc={html} sandbox="allow-scripts allow-same-origin allow-downloads allow-modals allow-popups allow-popups-to-escape-sandbox" style={{width:'100%',height:'85vh',border:0,borderRadius:12,background:'#f3f5ef'}} />
}
