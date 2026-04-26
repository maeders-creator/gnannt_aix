import { useState } from 'react'

export default function App() {
  const [items, setItems] = useState([])
  const [text, setText] = useState('')

  function addItem() {
    if (!text) return
    setItems([{ id: Date.now(), name: text }, ...items])
    setText('')
  }

  return (
    <div className="wrap">
      <h1>GNANNT_AIx</h1>
      <p>Produktionsplanung live</p>

      <div className="box">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Projekt eingeben"
        />
        <button onClick={addItem}>Neu</button>
      </div>

      {items.map((item) => (
        <div key={item.id} className="card">
          {item.name}
        </div>
      ))}
    </div>
  )
}
