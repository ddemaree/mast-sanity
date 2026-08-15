'use client'

import {MastHostProvider, Section} from '@mast/blocks'
import type {MastSanityConfig} from '@mast/blocks'
import {buildAstroAdapter} from '../lib/mast-adapter'

export function SectionIsland({
  block,
  index,
  sanityConfig,
  visualEditingEnabled = false,
}: {
  block: any
  index: number
  sanityConfig: MastSanityConfig
  visualEditingEnabled?: boolean
}) {
  const adapter = buildAstroAdapter(sanityConfig, {visualEditingEnabled})
  return (
    <MastHostProvider adapter={adapter}>
      <Section block={block} index={index} />
    </MastHostProvider>
  )
}
