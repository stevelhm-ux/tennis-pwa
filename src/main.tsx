// src/main.tsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import AuthGate from './AuthGate'
import './index.css'

const rootEl = document.getElementById('root')!
createRoot(rootEl).render(
  <React.StrictMode>
    <AuthGate>
      <App />
    </AuthGate>
  </React.StrictMode>
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
