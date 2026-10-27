import CalculatorWindow from './CalculatorWindow.jsx'
import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import MonteurApp from './MonteurApp.jsx'
import { MONTEUR_SESSION } from './monteurApi'
import './styles.css'

function Root() {
  const [hash, setHash] = useState(window.location.hash)
  let rememberedMonteur = false
  try { rememberedMonteur = Boolean(localStorage.getItem(MONTEUR_SESSION)) } catch {}
  const isMonteur = hash.startsWith('#monteur') || ((!hash || hash === '#') && rememberedMonteur)
  useEffect(() => {
    const route = () => setHash(window.location.hash)
    window.addEventListener('hashchange', route)
    return () => window.removeEventListener('hashchange', route)
  }, [])
  useEffect(() => {
    document.title = new URLSearchParams(window.location.search).has('calculator') ? 'Gnannt · Fensterkalkulator' : isMonteur ? 'Gnannt Monteure' : 'Gnannt Produktionsplanung'
    document.querySelector('link[rel=manifest]').href = isMonteur ? '/monteur.webmanifest' : '/manifest.webmanifest'
  }, [isMonteur])
  if(new URLSearchParams(window.location.search).has('calculator'))return <CalculatorWindow/>
  return isMonteur ? <MonteurApp key={hash}/> : <App />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
