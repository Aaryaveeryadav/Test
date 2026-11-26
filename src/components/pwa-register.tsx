'use client'

import { useEffect } from 'react'

/** Registers the offline service worker (PWA). Renders nothing. */
export function PWARegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Offline support is a progressive enhancement.
      })
    }
  }, [])
  return null
}
