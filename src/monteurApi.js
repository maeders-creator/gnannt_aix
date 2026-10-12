export const MONTEUR_SESSION = 'gnannt_monteur_access_v1'
export function readMonteurToken() {
  const match = location.hash.match(/^#monteur=([A-Za-z0-9_-]{43})$/)
  if (match) {
    try { localStorage.setItem(MONTEUR_SESSION, match[1]) } catch {}
    return match[1]
  }
  try { return localStorage.getItem(MONTEUR_SESSION) || '' } catch { return '' }
}
export function createMonteurApi(token) {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  return async (action, data = {}) => {
    if (!navigator.onLine) throw new Error('Du bist offline. Deine Eingabe bleibt erhalten. Bitte mit Internet erneut speichern.')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20000)
    try {
      const response = await fetch(`${url}/functions/v1/monteur-api`, {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', apikey: key, 'x-monteur-token': token },
        body: JSON.stringify({ ...data, action })
      })
      const result = await response.json()
      if (!response.ok) { const error = new Error(result.error || 'Verbindung fehlgeschlagen. Bitte erneut versuchen.'); error.status = response.status; throw error }
      return result
    } catch (error) {
      if (error.name === 'AbortError' || error instanceof TypeError) throw new Error('Verbindung unterbrochen. Deine Eingabe bleibt erhalten; bitte erneut speichern.')
      throw error
    } finally { clearTimeout(timer) }
  }
}
