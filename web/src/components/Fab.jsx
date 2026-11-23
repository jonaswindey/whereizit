import { useState } from 'react'
import Icon from './Icon.jsx'
import { ActionSheet } from './Sheet.jsx'
import { t } from '../lib/i18n.jsx'

// Floating "+" for adding things; one action runs directly, several open a sheet.
export default function Fab ({ actions }) {
  const [open, setOpen] = useState(false)
  const list = actions.filter(Boolean)
  if (!list.length) return null
  const onClick = () => (list.length === 1 ? list[0].onClick() : setOpen(true))
  return (
    <>
      <button className='fab' onClick={onClick} aria-label={t('fab.add')}><Icon name='plus' size={28} /></button>
      {open && <ActionSheet title={t('fab.add')} actions={list} onClose={() => setOpen(false)} />}
    </>
  )
}
