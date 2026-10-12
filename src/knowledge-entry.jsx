import React from 'react'
import { createRoot } from 'react-dom/client'
import TrainingVideos from './TrainingVideos'
let root = null
let host = null
function mountVideos() {
  const hub = document.querySelector('.knowledge-live .kb-layout')
  if (!hub) { if (root) { root.unmount(); root = null; host = null } return }
  if (host && host.isConnected) return
  host = document.createElement('div')
  host.className = 'knowledge-videos-integrated'
  host.style.gridColumn = '1 / -1'
  hub.prepend(host)
  root = createRoot(host)
  root.render(React.createElement(TrainingVideos))
}
const observer = new MutationObserver(() => { requestAnimationFrame(mountVideos) })
observer.observe(document.getElementById('root'), { childList: true, subtree: true })
mountVideos()
