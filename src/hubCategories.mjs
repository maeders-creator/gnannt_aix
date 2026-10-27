export const HUB_CATEGORIES = [
  {title:'Montage Akademie',icon:'🛠️'},
  {title:'Sicherheitsunterweisung',icon:'🦺'},
  {title:'Aufmaß',icon:'📏'},
  {title:'Dokumente & Videos',icon:'📚'}
]
export const HUB_DOWNLOAD_CATEGORIES = ["Dokumente & Videos / Bestellformulare", "Dokumente & Videos / Fenstersysteme / KÖMMERLING 76 AD", "Dokumente & Videos / Fenstersysteme / KÖMMERLING 88 MD", "Dokumente & Videos / Fenstersysteme / VEKA Softline 82 AD + MD", "Dokumente & Videos / Fenstersysteme / VEKA AluConnect", "Dokumente & Videos / Fenstersysteme / Winkhaus Beschläge", "Dokumente & Videos / Türsysteme / Kömmerling 76 AD", "Dokumente & Videos / Türsysteme / Kömmerling 88 MD", "Dokumente & Videos / Türsysteme / VEKA Softline 82", "Dokumente & Videos / Türsysteme / Veka AluConnect", "Dokumente & Videos / Hebe-Schiebetür-Systeme / KÖMMERLING Premidoor 76", "Dokumente & Videos / Hebe-Schiebetür-Systeme / KÖMMERLING Premidoor 88", "Dokumente & Videos / Hebe-Schiebetür-Systeme / VEKA Vekamotion 82 + max", "Dokumente & Videos / Allgemein / KÖMMERLING Allgemein", "Dokumente & Videos / Allgemein / VEKA Allgemein", "Dokumente & Videos / Haustüren"]
export const hubPath = doc => String(doc.category || '').trim() || 'Dokumente & Videos'
export const hubCategory = doc => hubPath(doc).split(' / ')[0]
export function hubCategories(docs) {
 const known=new Set(HUB_CATEGORIES.map(c=>c.title))
 return [...HUB_CATEGORIES,...[...new Set(docs.map(hubCategory))].filter(name=>!known.has(name)).sort((a,b)=>a.localeCompare(b,'de')).map(title=>({title,icon:'📁'}))]
}
export function hubEntryCategories(docs){return [...new Set([...HUB_CATEGORIES.map(c=>c.title),...HUB_DOWNLOAD_CATEGORIES.map(p=>p.split(' / ').slice(0,2).join(' / ')),...HUB_DOWNLOAD_CATEGORIES,...docs.map(hubPath)])]}
export function hubDocumentSections(docs){return [...new Set([...HUB_DOWNLOAD_CATEGORIES,...docs.map(hubPath)].filter(p=>p.startsWith('Dokumente & Videos / ')).map(p=>p.split(' / ')[1]))]}
export function hubDocumentSystems(docs,section){return [...new Set([...HUB_DOWNLOAD_CATEGORIES,...docs.map(hubPath)].filter(p=>p.startsWith('Dokumente & Videos / '+section+' / ')).map(p=>p.split(' / ').slice(2).join(' / ')))]}
export function groupedHubDocuments(docs,category='ALLE',search='',section='ALLE',system='ALLE') {
 const needle=search.trim().toLocaleLowerCase('de'),rootOrder=hubCategories(docs).map(c=>c.title)
 const paths=[...new Set(docs.map(hubPath))].sort((a,b)=>{const root=rootOrder.indexOf(a.split(' / ')[0])-rootOrder.indexOf(b.split(' / ')[0]);if(root)return root;const ai=HUB_DOWNLOAD_CATEGORIES.indexOf(a),bi=HUB_DOWNLOAD_CATEGORIES.indexOf(b);return (ai<0?999:ai)-(bi<0?999:bi)||a.localeCompare(b,'de')})
 return paths.map(path=>({title:path,icon:hubCategories(docs).find(c=>c.title===path.split(' / ')[0])?.icon||'📁',documents:docs.filter(d=>{const parts=hubPath(d).split(' / ');return hubPath(d)===path&&(category==='ALLE'||hubCategory(d)===category||hubPath(d)===category)&&(section==='ALLE'||parts[1]===section)&&(system==='ALLE'||parts.slice(2).join(' / ')===system)&&[d.title,d.file_name,d.url,hubPath(d)].join(' ').toLocaleLowerCase('de').includes(needle)}).sort((a,b)=>(a.title||'').localeCompare(b.title||'','de',{numeric:true}))})).filter(g=>g.documents.length)
}
