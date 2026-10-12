import { useEffect, useState } from 'react'
const names = ['altbau-sanierung-montage-aussenanschlag','ausglasen-video-3','fenstertausch-sanierung','gnannt-regio-tv','haustuer-einbauen','nebeneingangstuer-haustuer-einbauen','roma-pento-xp-vorbaurollladen','roma-puro-aufsatzrollladen-montage','video-xXm0uaBbx4w','vorbaurollladen-elektrisch-montieren','vorbaurollladen-panzer-austauschen']
export default function TrainingVideos(){
 const [videos,setVideos]=useState([])
 const [search,setSearch]=useState('')
 useEffect(()=>{Promise.all(names.map(async name=>{try{const r=await fetch('/wissensdatenbank/'+name+'.json');return r.ok?await r.json():null}catch{return null}})).then(items=>setVideos(items.filter(Boolean)))},[])
 return <section className="kb-panel"><h3>Schulungsvideos ({videos.length})</h3><input className="input" placeholder="Video suchen" value={search} onChange={e=>setSearch(e.target.value)}/><div className="kb-list">{videos.filter(v=>(v.title+' '+v.category).toLowerCase().includes(search.toLowerCase())).map(v=><div className="kb-item" key={v.youtubeId}><img src={'https://i.ytimg.com/vi/'+v.youtubeId+'/mqdefault.jpg'} alt="" loading="lazy" style={{width:100,borderRadius:8}}/><div><strong>{v.title}</strong><p>{v.category}</p><a className="btn small outline" href={v.url} target="_blank" rel="noreferrer">Video ansehen</a></div></div>)}</div></section>
}
