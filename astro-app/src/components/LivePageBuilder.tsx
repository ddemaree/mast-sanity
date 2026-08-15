'use client'

import {
  MastHostProvider,
  PageBuilder,
  type MastPage,
  type MastSanityConfig,
} from '@mast/blocks'
import {
  VisualEditing,
} from '@sanity/visual-editing/react'
import {customOverlayComponents, BlockContextBridge} from '@mast/blocks/overlays'
import {buildAstroAdapter} from '../lib/mast-adapter'

export function LivePageBuilder({
  page,
  sanityConfig,
}: {
  page: MastPage
  sanityConfig: MastSanityConfig
}) {
  const adapter = buildAstroAdapter(sanityConfig, {visualEditingEnabled: true})

  return (
    <MastHostProvider adapter={adapter}>
      <PageBuilder page={page} isDraftMode />
      <VisualEditing
        portal
        components={customOverlayComponents}
        refresh={async () => {
          location.reload()
        }}
      />
      <BlockContextBridge />
    </MastHostProvider>
  )
}
