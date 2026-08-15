'use client'

import {VisualEditing} from 'next-sanity/visual-editing'
import {customOverlayComponents, BlockContextBridge} from '@mast/blocks/overlays'

export default function VisualEditingWithPlugins() {
  return (
    <>
      <VisualEditing components={customOverlayComponents} />
      <BlockContextBridge />
    </>
  )
}
