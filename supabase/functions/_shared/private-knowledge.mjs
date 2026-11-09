export const UPLOAD_BUCKET = 'uploads'
export const UPLOAD_URL = 'https://xhpwmebwvjpdhsjeyrug.supabase.co/storage/v1/object/public/uploads/'
export function storagePath(url, scope) {
  if (typeof url !== 'string' || !url.startsWith(UPLOAD_URL)) return null
  const path = url.slice(UPLOAD_URL.length)
  return new RegExp(`^${scope}/[A-Za-z0-9_.-]+$`).test(path) && path.length <= 350 ? path : null
}
// Invoke only AFTER the existing planner-session or active installer-token check.
// Streaming authenticated bytes avoids shareable bearer download URLs.
export async function downloadPortalDocument(db, scope, id, headers) {
  const failure = (message,status) => new Response(JSON.stringify({error:message}),{status,headers})
  if (!['knowledge','projects'].includes(scope) || !Number.isSafeInteger(id) || id <= 0) return failure('Ungültiges Dokument.',400)
  const hub=scope==='knowledge'
  const row = await db.from(hub?'knowledge_docs':'projects').select(hub?'id,url,file_name':'id,attachment_url,attachment_name').eq('id',id).maybeSingle()
  if(row.error) return failure('Dokument konnte nicht geladen werden.',503)
  const path=storagePath(hub?row.data?.url:row.data?.attachment_url,scope)
  if(!path) return failure('Dokument nicht gefunden.',404)
  const file=await db.storage.from(UPLOAD_BUCKET).download(path)
  if(file.error || !file.data) return failure('Dokument konnte nicht geladen werden.',503)
  const filename=(hub?row.data.file_name:row.data.attachment_name)||path.split('/').pop()
  return new Response(file.data,{headers:{...headers,'Content-Type':file.data.type||'application/octet-stream','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}})
}
