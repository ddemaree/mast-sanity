'use client'

import {MastHostProvider} from '@mast/blocks'
import {createNextMastAdapter} from './mast-adapter'

export function MastHostBoundary({
  visualEditingEnabled,
  children,
}: {
  visualEditingEnabled: boolean
  children: React.ReactNode
}) {
  const adapter = createNextMastAdapter({visualEditingEnabled})
  return <MastHostProvider adapter={adapter}>{children}</MastHostProvider>
}
