import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
// Fonts are bundled (no Google Fonts request leaves the network). Fraunces with its soft axis.
import '@fontsource-variable/fraunces/soft.css'
import '@fontsource-variable/nunito-sans'
import './styles.css'
import { getPref } from './lib/recent.js'

// Theme choice is per device (More › Settings); 'auto' follows the phone.
const theme = getPref('theme', 'auto')
if (theme !== 'auto') document.documentElement.dataset.theme = theme
// Text size scales everything sized in rem (most of the UI), on top of the phone's own setting.
document.documentElement.style.fontSize = getPref('textSize', '100%')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)

// Not in dev: a caching worker fights Vite's hot reload.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(err => console.warn('service worker:', err.message))
}
