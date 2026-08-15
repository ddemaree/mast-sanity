'use client'

import {createContext, useContext, useMemo} from 'react'
import type {MastHostAdapter} from './types'
import {createImageHelpers} from '../sanity/image'
import {createDataAttrHelper} from '../sanity/dataAttr'

const MastHostContext = createContext<MastHostAdapter | null>(null)

export function MastHostProvider(props: {adapter: MastHostAdapter; children: React.ReactNode}) {
  return <MastHostContext.Provider value={props.adapter}>{props.children}</MastHostContext.Provider>
}

export function useMastHost(): MastHostAdapter {
  const host = useContext(MastHostContext)
  if (!host) throw new Error('mast-blocks components must be rendered inside <MastHostProvider>')
  return host
}

/** Image helpers + dataAttr bound to the host's Sanity config. */
export function useMastSanity() {
  const host = useMastHost()
  return useMemo(() => {
    const imageHelpers = createImageHelpers(host.sanity)
    const dataAttr = createDataAttrHelper(host.sanity)
    return {
      ...imageHelpers,
      dataAttr,
      sanity: host.sanity,
      visualEditingEnabled: Boolean(host.visualEditingEnabled),
    }
  }, [host])
}
