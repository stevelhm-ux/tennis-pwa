// src/main.tsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import AuthGate from './AuthGate'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

// Render
const rootEl = document.getElementById('root')!
createRoot(rootEl).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthGate>
        <App />
      </AuthGate>
    </ErrorBoundary>
  </React.StrictMode>
)

// Surface crashes instead of blank screen
window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled rejection', e.reason)
})
window.addEventListener('error', (e) => {
  console.error('Unhandled error', (e as any).error || e.message)
})

// PWA: register service worker and auto-reload when a new one takes control
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // If there’s already a waiting worker (new build), nudge it to activate
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' })
        }
        // When a new worker is found, reload once it installs (so assets match)
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing
          if (!nw) return
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              location.reload()
            }
          })
        })
      })
      .catch((err) => {
        console.warn('Service worker registration failed:', err)
      })
  })
}
