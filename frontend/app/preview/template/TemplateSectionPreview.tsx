'use client'

import {MastHostProvider, Section} from '@mast/blocks'
import {createNextMastAdapter} from '@/app/lib/mast-adapter'

export function TemplateSectionPreview({
  block,
  isDraftMode,
}: {
  block: any
  isDraftMode: boolean
}) {
  const adapter = createNextMastAdapter({visualEditingEnabled: isDraftMode})
  return (
    <MastHostProvider adapter={adapter}>
      <Section block={block} index={0} pageId={isDraftMode ? block?.sourceId : undefined} pageType={isDraftMode ? 'sectionTemplate' : undefined} />
    </MastHostProvider>
  )
}
