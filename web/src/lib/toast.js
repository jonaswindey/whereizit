import { useSyncExternalStore } from 'react'

// One transient message at a time, optionally with an action (e.g. Undo).
let current = null
let timer
const listeners = new Set()
const emit = () => listeners.forEach(l => l())

export function showToast (message, action, ms = 6000) {
  clearTimeout(timer)
  current = { message, action, id: Date.now() }
  emit()
  timer = setTimeout(hideToast, ms)
}

export function hideToast () {
  current = null
  emit()
}

const subscribe = cb => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export const useToast = () => useSyncExternalStore(subscribe, () => current)
