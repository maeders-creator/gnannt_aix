export function createPlannerClient(session, endpoint = 'https://xhpwmebwvjpdhsjeyrug.supabase.co/functions/v1/gnannt-calculator') {
  return {
    async appendComment(id, text) {
      const comment = typeof text === 'string' ? text.trim() : ''
      if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Bitte einen gültigen Auftrag öffnen.')
      if (!comment) throw new Error('Bitte Kommentar eintragen.')
      if (comment.length > 2000) throw new Error('Ein Kommentar darf höchstens 2.000 Zeichen enthalten.')
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-planer-session': session },
        body: JSON.stringify({ action: 'planner-projects', op: 'comment', id, comment })
      })
      const result = await response.json()
      if (!response.ok || result.error) throw new Error(result.error?.message || result.error || 'Kommentar konnte nicht gespeichert werden.')
      if (!result.data) throw new Error('Auftrag nicht gefunden. Bitte die Liste aktualisieren.')
      return result.data
    },
    from(table){
    if(table!=='projects')throw new Error('Diese Tabelle ist für den Planer nicht freigegeben.')
    const input={action:'planner-projects',op:'select',filters:[],selection:'*'}
    const query={
      select(columns='*'){input.selection=columns;input.returning=true;return query},
      insert(values){input.op='insert';input.values=values;return query},
      update(values){input.op='update';input.values=values;return query},
      eq(column,value){input.filters.push({method:'eq',column,value});return query},
      is(column,value){input.filters.push({method:'is',column,value});return query},
      order(){return query},
      single(){input.single=true;return query},
      maybeSingle(){input.maybeSingle=true;return query},
      then(resolve,reject){return fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','x-planer-session':session},body:JSON.stringify(input)}).then(async response=>{const result=await response.json();if(!response.ok)return {data:null,error:{message:typeof result.error==='string'?result.error:'Planer-Zugang konnte nicht geprüft werden.'}};return result}).catch(error=>({data:null,error:{message:error.message||'Verbindung fehlgeschlagen.'}})).then(resolve,reject)}
    };return query
  }}
}
