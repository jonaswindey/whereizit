import { useMemo, useSyncExternalStore } from 'react'
import { pb } from './pb.js'

const subscribe = cb => pb.authStore.onChange(cb)
// authStore.record is re-parsed from localStorage on every read (new object each time), which would
// make useSyncExternalStore loop forever; the token string is a stable snapshot.
// The record's `updated` is included so profile changes (e.g. language) are picked up too.
const tokenSnapshot = () => (pb.authStore.isValid ? `${pb.authStore.token}|${pb.authStore.record?.updated ?? ''}` : '')

export function useAuthUser () {
  const token = useSyncExternalStore(subscribe, tokenSnapshot)
  return useMemo(() => (token ? pb.authStore.record : null), [token])
}

export const displayName = (user, fallback = 'Someone') => user?.name || user?.email?.split('@')[0] || fallback
