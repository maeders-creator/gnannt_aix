import { useEffect, useState } from 'react'
const safeUrl = value => { try { const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:null } catch { return null } }
export default function TrainingVideos({loadVideos}) {
 const [videos,setVideos]=useState([]),[search,setSearch]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0)
 useEffect(()=>{
  let active=true
  setVideos([]);setError('');setLoading(true)
  Promise.resolve().then(()=>{
   if(typeof loadVideos!=='function')throw Error('Bitte im Portal anmelden, um Schulungsvideos zu laden.')
   return loadVideos()
  }).then(result=>{
   if(result?.error)throw Error(result.error.message||result.error)
   if(!Array.isArray(result?.data))throw Error('Schulungsvideos konnten nicht geladen werden.')
   if(active)setVideos(result.data)
  }).catch(e=>{if(active)setError(e.message||'Schulungsvideos konnten nicht geladen werden.')}).finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[loadVideos,retry])
 return <section className="kb-panel"><h3>Schulungsvideos ({videos.length})</h3>{loading&&<p role="status">Schulungsvideos werden geladen…</p>}{error&&<div role="alert" className="error">{error}<button type="button" className="btn small outline" onClick={()=>setRetry(n=>n+1)}>Erneut laden</button></div>}{!loading&&!error&&<><input className="input" placeholder="Video suchen" value={search} onChange={e=>setSearch(e.target.value)}/><div className="kb-list">{videos.filter(v=>(v.title+' '+v.category).toLowerCase().includes(search.toLowerCase())).map(v=><div className="kb-item" key={v.youtubeId||v.url}>{/^[A-Za-z0-9_-]{11}$/.test(v.youtubeId||'')&&<img src={'https://i.ytimg.com/vi/'+v.youtubeId+'/mqdefault.jpg'} alt="" loading="lazy" style={{width:100,borderRadius:8}}/>}<div><strong>{v.title}</strong><p>{v.category}</p>{v.verification&&/nicht|offen/i.test(v.verification)&&<p className="tiny">Videoinhalt noch nicht unabhängig geprüft</p>}{safeUrl(v.url)&&<a className="btn small outline" href={safeUrl(v.url)} target="_blank" rel="noreferrer">Video ansehen</a>}</div></div>)}</div></>}</section>
}
