import { useEffect, useState } from 'react'
import { pb } from './pb.js'

// Household members, fetched once per page load (names for missions and assignees).
let cache
export function useMembers () {
  const [members, setMembers] = useState([])
  useEffect(() => {
    cache ??= pb.collection('users').getFullList({ sort: 'name' }).catch(err => { cache = null; console.warn('members:', err.message); return [] })
    let active = true
    cache.then(m => active && setMembers(m))
    return () => { active = false }
  }, [])
  return members
}
