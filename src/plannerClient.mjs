export function createPlannerClient(session, endpoint = 'https://xhpwmebwvjpdhsjeyrug.supabase.co/functions/v1/gnannt-calculator') {
  return {from(table){
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
