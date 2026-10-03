'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker in production only.
 *
 * In dev an unthrottled service worker caches stale chunks and makes hot reload
 * look broken, so it is skipped entirely.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch((err) => {
        console.error('[sw] registration failed', err)
      })
    }

    if (document.readyState === 'complete') {
      register()
    } else {
      window.addEventListener('load', register)
      return () => window.removeEventListener('load', register)
    }
  }, [])

  return null
}