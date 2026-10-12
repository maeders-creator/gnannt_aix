import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import MonteurApp from './MonteurApp.jsx'
import './styles.css'

function Root() {
  const [hash, setHash] = useState(window.location.hash)
  const isMonteur = hash.startsWith('#monteur')
  useEffect(() => {
    const route = () => setHash(window.location.hash)
    window.addEventListener('hashchange', route)
    return () => window.removeEventListener('hashchange', route)
  }, [])
  useEffect(() => {
    document.title = isMonteur ? 'Gnannt Monteure' : 'Gnannt Produktionsplanung'
    document.querySelector('link[rel=manifest]').href = isMonteur ? '/monteur.webmanifest' : '/manifest.webmanifest'
  }, [isMonteur])
  return isMonteur ? <MonteurApp key={hash}/> : <App />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
