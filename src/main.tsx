// src/main.tsx (bottom part)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      // If there’s an updated worker waiting, reload when it activates
      if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' })
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing
        if (!nw) return
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            // new SW installed and will claim clients; reload to get fresh files
            location.reload()
          }
        })
      })
    }).catch(() => {})
  })
}
