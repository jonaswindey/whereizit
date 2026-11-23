// A short, quiet celebration: a few paper flecks in the room colours, gone in a second and a half.
// Skipped entirely when the phone asks for reduced motion.
import { play } from './sound.js'

export function celebrate () {
  play('found')
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const layer = document.createElement('div')
  layer.className = 'celebrate'
  for (let n = 0; n < 28; n++) {
    const fleck = document.createElement('span')
    fleck.style.setProperty('--x', `${Math.random() * 100}vw`)
    fleck.style.setProperty('--d', `${0.9 + Math.random() * 0.8}s`)
    fleck.style.setProperty('--r', `${Math.random() * 360}deg`)
    fleck.style.background = `var(--room-${(n % 8) + 1})`
    layer.appendChild(fleck)
  }
  document.body.appendChild(layer)
  navigator.vibrate?.([30, 40, 30])
  setTimeout(() => layer.remove(), 2000)
}
