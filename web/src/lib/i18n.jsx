import { createContext, Fragment, useContext } from 'react'
import en from '../locales/en.js'
import nl from '../locales/nl.js'

// Tiny i18n: flat key → string dictionaries, {var} interpolation, {one, other} plurals via Intl.PluralRules.
// The active language lives in a module variable (so plain helpers like timeAgo can read it) and in
// context (so components re-render when it changes).
const dicts = { en, nl }
export const LANGUAGES = [{ code: 'en', name: 'English' }, { code: 'nl', name: 'Nederlands' }]

let current = 'en'
export const getLang = () => current

export function resolveLang (pref) {
  if (dicts[pref]) return pref
  return (navigator.language || 'en').toLowerCase().startsWith('nl') ? 'nl' : 'en'
}

function lookup (key, vars) {
  let v = dicts[current][key] ?? en[key]
  if (v === undefined) {
    console.warn('missing translation:', key)
    return key
  }
  if (typeof v === 'object') v = v[new Intl.PluralRules(current).select(vars.count ?? 0)] ?? v.other
  return v
}

export function t (key, vars = {}) {
  return lookup(key, vars).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')
}

// Like t(), but variables may be React nodes (links, <strong>): returns an array of fragments.
export function tx (key, vars = {}) {
  return lookup(key, vars).split(/(\{\w+\})/).map((part, i) => {
    const m = part.match(/^\{(\w+)\}$/)
    return <Fragment key={i}>{m ? vars[m[1]] : part}</Fragment>
  })
}

const LangContext = createContext('en')

export function LangProvider ({ lang, children }) {
  current = lang
  document.documentElement.lang = lang
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>
}

// Subscribes the component to language changes; t/tx themselves are plain functions.
export function useLang () {
  return useContext(LangContext)
}
