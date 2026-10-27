import { useEffect, useState } from 'react'
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
  const [html,setHtml] = useState(''), [error,setError] = useState('')
  useEffect(()=>{const controller=new AbortController();setHtml('');setError('');fetch(endpoint,{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json',...(token?{'x-monteur-token':token}:{}),...(plannerSession?{'x-planer-session':plannerSession}:{})},body:JSON.stringify({action:'calculator'})}).then(async r=>{const body=await r.json();if(!r.ok)throw new Error(body.error||'Kein Zugriff.');setHtml(body.html)}).catch(e=>{if(e.name!=='AbortError')setError(e.message)});return()=>controller.abort()},[token,plannerSession])
  if(error)return <section className="panel" role="alert">{error}</section>
  if(!html)return <section className="panel">Kalkulator wird geladen…</section>
  return <iframe title="Gnannt Fensterkalkulator" srcDoc={html} sandbox="allow-scripts allow-same-origin allow-downloads allow-modals allow-popups allow-popups-to-escape-sandbox" style={{width:'100%',height:'85vh',border:0,borderRadius:12,background:'#f3f5ef'}} />
}
