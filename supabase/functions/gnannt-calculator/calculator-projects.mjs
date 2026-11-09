const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const summary='id,title,customer,revision,saved_by,created_at,updated_at';
export async function calculatorProjects(db,input,actor){
 const {op,id,payload,revision}=input;
 if(!['list','get','create','save','delete'].includes(op))throw Error('Ungültige Projektaktion.');
 if(op!=='list'&&!uuid.test(id||''))throw Error('Ungültige Projekt-ID.');
 let q=db.from('calculator_projects');
 if(op==='list')return await q.select(summary).is('deleted_at',null).order('updated_at',{ascending:false}).limit(1000);
 if(op==='get')return await q.select('*').eq('id',id).is('deleted_at',null).single();
 if(op==='delete'){
  if(!Number.isInteger(revision)||revision<1||typeof input.confirmationName!=='string'||!input.confirmationName.trim()||input.confirmationName.length>180)throw Error('Projektname zur Bestätigung eingeben.');
  const removed=await q.update({deleted_at:new Date().toISOString(),updated_at:new Date().toISOString(),revision:revision+1,saved_by:actor}).eq('id',id).eq('revision',revision).eq('title',input.confirmationName).is('deleted_at',null).select('id,revision').maybeSingle();
  if(!removed.error&&!removed.data)return {error:{message:'Projektname stimmt nicht überein oder das Projekt wurde inzwischen geändert. Projektliste neu laden.',code:'CONFLICT'}};
  return removed;
 }
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||!payload.config||!payload.settings||!Array.isArray(payload.positions)||payload.positions.length>1000||new TextEncoder().encode(JSON.stringify(payload)).length>5000000)throw Error('Ungültige Kalkulationsdaten.');
 const title=String(payload.projectName||'').trim(),customer=String(payload.customerName||'').trim();
 if(!title||title.length>180||customer.length>180)throw Error('Projektname und Kunde prüfen.');
 const values={title,customer,payload,saved_by:actor,updated_at:new Date().toISOString()};
 if(op==='create')return await q.insert({...values,id}).select(summary).single();
 if(!Number.isInteger(revision)||revision<1)throw Error('Projektstand fehlt.');
 const result=await q.update({...values,revision:revision+1}).eq('id',id).eq('revision',revision).is('deleted_at',null).select(summary).maybeSingle();
 if(!result.error&&!result.data)return {error:{message:'Dieses Projekt wurde zwischenzeitlich geändert. Bitte lokalen Stand exportieren und Projekt neu öffnen.',code:'CONFLICT'}};
 return result;
}

