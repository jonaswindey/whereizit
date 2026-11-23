import { getPref } from './recent.js'

// Small synthesised sounds (no audio files): a soft shutter, a two-note "done", a little rising
// chime for finds. Off unless switched on per device under More › Settings.
let ctx
const on = () => getPref('sounds', '0') === '1'

function tone (freq, start, duration, type = 'sine', gain = 0.12) {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.value = freq
  g.gain.setValueAtTime(0, ctx.currentTime + start)
  g.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration)
  o.connect(g).connect(ctx.destination)
  o.start(ctx.currentTime + start)
  o.stop(ctx.currentTime + start + duration + 0.02)
}

export function play (name, force = false) {
  if (!force && !on()) return
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
    if (name === 'shutter') { tone(1800, 0, 0.04, 'square', 0.04); tone(900, 0.03, 0.06, 'triangle', 0.06) }
    if (name === 'tick') tone(880, 0, 0.09, 'sine', 0.08)
    if (name === 'done') { tone(660, 0, 0.16); tone(990, 0.12, 0.24) }
    if (name === 'found') { tone(523, 0, 0.14); tone(659, 0.1, 0.14); tone(784, 0.2, 0.14); tone(1047, 0.3, 0.3) }
  } catch (err) {
    console.warn('sound:', err.message)
  }
}
