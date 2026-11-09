// Use the same same-origin storage handoff as the Fensterkalkulator.
let childWindow = null
let childAuth = null
export function openAufmassWindow({token, plannerSession} = {}) {
  const auth = token || plannerSession || ''
  if (childWindow && !childWindow.closed && childAuth === auth) {
    childWindow.focus()
    return true
  }
  try {
    if (plannerSession) sessionStorage.setItem('gnannt_planner_session_v1', plannerSession)
    if (token) localStorage.setItem('gnannt_monteur_access_v1', token)
  } catch { return false }
  const child = window.open('/?aufmass=' + (token ? 'monteur' : 'planer'), '_blank', 'popup,width=1440,height=1000')
  if (child) { childWindow = child; childAuth = auth; child.focus() }
  return Boolean(child)
}
export function returnToPortal(mode) {
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.focus()
      window.close()
      if (window.closed) return
    }
  } catch {}
  window.location.assign(mode === 'monteur' ? '/#monteur' : '/#buero')
}
