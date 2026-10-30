const columns = new Set(['projekt','kunde','adresse','ort','telefon','email_kunde','gewerk','lead','mitarbeiter','status','termin','uhrzeit','prioritaet','notiz','attachment_name','attachment_url','push_enabled'])
export async function plannerProjects(db, input) {
  const {op,filters=[],values,selection='*',single=false,maybeSingle=false}=input
  // Called only after the existing planner session signature and expiry check.
  // The backend-only RPC fixes the account name and appends atomically.
  if (op === 'comment') {
    if (!Number.isSafeInteger(input.id) || input.id <= 0) throw Error('Ungültige Projekt-ID.')
    if (typeof input.comment !== 'string' || !input.comment.trim() || input.comment.trim().length > 2000) throw Error('Bitte Kommentar prüfen (1–2.000 Zeichen).')
    return await db.rpc('planner_append_comment', { p_project_id: input.id, p_comment: input.comment.trim() }).maybeSingle()
  }
  if(!['select','insert','update'].includes(op)||!Array.isArray(filters)||filters.length>4)throw Error('Ungültige Projektaktion.')
  if(!['*','id,notiz'].includes(selection))throw Error('Ungültige Feldauswahl.')
  for(const f of filters)if(!['id','notiz','status'].includes(f.column)||!['eq','is'].includes(f.method)||(f.method==='is'&&f.value!==null)||!(f.value===null||['string','number'].includes(typeof f.value)))throw Error('Ungültiger Projektfilter.')
  if(op==='update'&&!filters.some(f=>f.column==='id'&&f.method==='eq'&&/^\d+$/.test(String(f.value))))throw Error('Projekt-ID erforderlich.')
  let query=db.from('projects')
  if(op!=='select'){
    if(!values||typeof values!=='object'||Array.isArray(values)||!Object.keys(values).length)throw Error('Projektdaten fehlen.')
    for(const [key,value] of Object.entries(values)){
      if(!columns.has(key))throw Error('Projektfeld nicht freigegeben.')
      if(key==='push_enabled'){if(typeof value!=='boolean')throw Error('Ungültiger Wert.')}else if(value!==null&&(typeof value!=='string'||value.length>(key==='notiz'?16000:2000)))throw Error('Ungültiger Projektwert.')
    }
    if(op==='insert'&&!String(values.projekt||'').trim())throw Error('Projektname fehlt.')
    query=op==='insert'?query.insert({...values,created_by_name:'Planer'}):query.update({...values,details_updated_by:'Planer'})
  }
  if(op==='select')query=query.select(selection)
  for(const f of filters)query=query[f.method](f.column,f.value)
  if(op==='select'&&!filters.length)query=query.order('created_at',{ascending:false}).limit(1000)
  if(op!=='select'&&(single||maybeSingle||input.returning))query=query.select(selection)
  if(single)query=query.single();else if(maybeSingle)query=query.maybeSingle()
  return await query
}

