import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import AuthGate from './AuthGate'

const el = document.getElementById('root')!

createRoot(document.getElementById('root')!).render(
  <AuthGate><App /></AuthGate>
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
