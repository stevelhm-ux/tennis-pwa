// src/main.tsx (bottom)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => r.unregister())
  })
  // TEMP: do NOT register a SW while recovering
  // window.addEventListener('load', () => {
  //   navigator.serviceWorker.register('/sw.js').catch(() => {})
  // })
}
