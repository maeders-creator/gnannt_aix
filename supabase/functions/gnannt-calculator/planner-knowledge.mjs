import trainingVideos from '../_shared/training-videos.json' with {type:'json'}
const publicStorage='https://xhpwmebwvjpdhsjeyrug.supabase.co/storage/v1/object/public/uploads/';
export async function plannerKnowledge(db,input){
 const {op,values,path}=input;
 // This operation is reachable only after the handler verifies the existing planner session.
 // It invalidates CDN copies only; objects, metadata, permissions and credentials stay unchanged.
 if(op==='purge-public-cache'){
  const bucket=await db.storage.getBucket('uploads');
  if(bucket.error||bucket.data?.id!=='uploads'||bucket.data?.public!==false)throw Error('Die Dateiablage muss zuerst privat geschaltet sein.');
  const result=await db.storage.purgeBucketCache('uploads');
  if(result.error)throw Error('Der öffentliche Dateicache konnte nicht geleert werden. Bitte im Büro prüfen lassen.');
  return {data:{purged:true},error:null};
 }
 if(op==='training-videos')return {data:trainingVideos,error:null};
 if(op==='list')return await db.from('knowledge_docs').select('id,title,category,type,file_name,url,created_at').order('created_at',{ascending:false}).limit(1000);
 if(op==='upload-url'){
  if(typeof path!=='string'||!/^knowledge\/[A-Za-z0-9_.-]+\.(pdf|png|jpe?g|webp|gif|mp4|mov|webm|m4v)$/i.test(path)||path.length>350)throw Error('Dateiformat oder Dateiname prüfen.');
  const result=await db.storage.from('uploads').createSignedUploadUrl(path);if(result.error)return result;
  return {data:{signedUrl:result.data.signedUrl,publicUrl:publicStorage+path},error:null};
 }
 if(op!=='create'||!values||Object.keys(values).some(k=>!['title','category','type','file_name','url'].includes(k)))throw Error('Ungültige Hub-Aktion.');
 const out={};for(const [k,max] of [['title',300],['category',250],['file_name',300],['url',2500]]){if(typeof values[k]!=='string'||values[k].length>max)throw Error('Hub-Eingabe prüfen.');out[k]=values[k].trim();}
 if(!out.title||!out.category||!['file','link'].includes(values.type))throw Error('Titel und Kategorie sind erforderlich.');
 if(out.url){const u=new URL(out.url);if(!['http:','https:'].includes(u.protocol))throw Error('Link muss mit http oder https beginnen.');}
 if(values.type==='file'&&(!out.url.startsWith(publicStorage+'knowledge/')||!out.file_name))throw Error('Datei zuerst im Portal hochladen.');
 return await db.from('knowledge_docs').insert({...out,type:values.type}).select('id,title,category,type,file_name,url,created_at').single();
}
