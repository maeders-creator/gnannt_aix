import { useState } from 'react'
import { ShieldCheck, LockKeyhole, PackageSearch, ArrowRight } from 'lucide-react'
import './wuerthCatalog.css'

// Live launch remains unavailable until the dedicated OCI credential has been
// configured securely and the server-side session/callback integration tested.
// Never collect a Würth password or put customer prices into browser storage.
export default function WuerthCatalog() {
  const [details, setDetails] = useState(false)
  return <section className="wu-catalog" aria-labelledby="wu-title">
    <div className="wu-hero">
      <div className="wu-eyebrow">WÜRTH · EINKAUF & MATERIAL</div>
      <h2 id="wu-title">Eure Produkte. Eure Preise.</h2>
      <p>Der Würth-Katalog direkt aus dem Gnannt-Portal. Zum Start nur Artikel und persönliche Preise ansehen, ohne Bestellung.</p>
      <div className="wu-mode"><ShieldCheck size={18} aria-hidden="true"/> Katalogmodus · Keine Bestellung aus diesem Portal</div>
    </div>
    <div className="wu-layout">
      <div className="wu-panel">
        <div className="wu-icon"><PackageSearch size={28} aria-hidden="true"/></div>
        <h3>Würth-Katalog verbinden</h3>
        <p>Die OCI-Anbindung ist vorbereitet. Für den Zugriff auf eure vereinbarten Preise fehlt noch die sichere Einrichtung des eigenen OCI-Zugangs.</p>
        <div className="wu-status" role="status"><span aria-hidden="true"/> Noch nicht verbunden</div>
        <button type="button" className="wu-connect" disabled aria-describedby="wu-blocker"><LockKeyhole size={17} aria-hidden="true"/> Katalog öffnen</button>
        <p id="wu-blocker" className="wu-small">Sobald der OCI-Zugang eingerichtet und geprüft ist, wird der Katalog hier freigeschaltet. Es werden noch keine Live-Preise angezeigt.</p>
      </div>
      <div className="wu-panel wu-steps">
        <h3>So funktioniert die Anbindung</h3>
        <ol>
          <li><strong>Katalog öffnen</strong><span>Mit eurem eigenen Würth-OCI-Zugang.</span></li>
          <li><strong>Artikel und Preise ansehen</strong><span>Eure Konditionen direkt im Würth-Katalog prüfen.</span></li>
          <li><strong>Auswahl zurückholen</strong><span>Geplant: Artikel als Katalogvorschau ins Portal übernehmen. Keine Bestellung.</span></li>
        </ol>
        <button type="button" className="wu-details-button" aria-expanded={details} aria-controls="wu-setup-details" onClick={() => setDetails(value => !value)}>{details ? 'Details ausblenden' : 'Was fehlt noch?'}<ArrowRight size={16} aria-hidden="true"/></button>
        {details && <div id="wu-setup-details" className="wu-details">
          <p>Die Bestellauslösung wurde nach eurer Rückmeldung bei Würth deaktiviert.</p>
          <p>Benötigt wird jetzt der separate OCI-Zugang, nicht das normale Shop-Login. Das Passwort wird ausschließlich über einen sicheren Einrichtungsweg hinterlegt, nicht hier im Portal oder im Chat.</p>
          <p>Danach prüfen wir Anmeldung, persönliche Preise und die Rückgabe der Auswahl, ohne eine Bestellung auszulösen.</p>
        </div>}
      </div>
    </div>
  </section>
}
