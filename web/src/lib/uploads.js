import { useSyncExternalStore } from 'react'

// Background queue so the camera loop never waits on the network.
let state = { pending: 0, failed: [] }
let nextId = 1
const listeners = new Set()

const set = next => {
  state = next
  listeners.forEach(l => l())
}

export function enqueue (label, task, onSettled) {
  set({ ...state, pending: state.pending + 1 })
  task()
    .then(
      () => set({ ...state, pending: state.pending - 1 }),
      err => set({
        pending: state.pending - 1,
        failed: [...state.failed, {
          id: nextId++,
          label,
          message: err?.message ?? String(err),
          retry: () => enqueue(label, task, onSettled)
        }]
      })
    )
    .finally(() => onSettled?.())
}

export const dismiss = id => set({ ...state, failed: state.failed.filter(f => f.id !== id) })

const subscribe = cb => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export const useUploads = () => useSyncExternalStore(subscribe, () => state)
