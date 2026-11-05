import { createContext, use, useEffect, useRef, useState, type ReactNode } from 'react'

import { BUNDLED_PROMOS, fetchRemotePromos, type Promo } from '@renderer/utils/promos'

const PromosContext = createContext<readonly Promo[]>(BUNDLED_PROMOS)

export function PromosProvider({ children }: { children: ReactNode }) {
  const [promos, setPromos] = useState<readonly Promo[]>(BUNDLED_PROMOS)
  const requestStarted = useRef(false)

  useEffect(() => {
    if (requestStarted.current) return
    requestStarted.current = true
    void fetchRemotePromos().then(setPromos)
  }, [])

  return <PromosContext value={promos}>{children}</PromosContext>
}

export function usePromos(): readonly Promo[] {
  return use(PromosContext)
}
