import { resizeImage } from '../lib/image.js'

// A <label> around a hidden capture input: opens the rear camera on phones, file picker on desktop.
export default function PhotoButton ({ onPhoto, className = 'btn', children, ref }) {
  const onChange = async e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onPhoto(await resizeImage(file))
  }
  return (
    <label className={className}>
      <input ref={ref} type='file' accept='image/*' capture='environment' hidden onChange={onChange} />
      {children}
    </label>
  )
}
