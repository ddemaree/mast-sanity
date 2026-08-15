'use client'

import {useSyncExternalStore} from 'react'

/** Framework-free useSearchParam for hosts without a router hook (Astro). */
export function useWindowSearchParam(key: string): string | null {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener('popstate', onChange)
      window.addEventListener('mast:locationchange', onChange)
      return () => {
        window.removeEventListener('popstate', onChange)
        window.removeEventListener('mast:locationchange', onChange)
      }
    },
    () => new URLSearchParams(window.location.search).get(key),
    () => null,
  )
}
