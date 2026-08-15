'use client'

import type {SanityDocument} from '@sanity/client'
import {useOptimistic} from '@sanity/visual-editing/react'

import BlockRenderer from './BlockRenderer'
import {useMastHost, useMastSanity} from './host/context'
import type {MastPage} from './types'

type PageBuilderPageProps = {
  page: MastPage | null
  isDraftMode?: boolean
}

type PageBuilderSection = {
  _key: string
  _type: string
}

type PageData = {
  _id: string
  _type: string
  pageBuilder?: PageBuilderSection[]
}

/**
 * The PageBuilder component is used to render the blocks from the `pageBuilder` field in the Page type in your Sanity Studio.
 */

function RenderSections({
  pageBuilderSections,
  page,
  isDraftMode,
}: {
  pageBuilderSections: PageBuilderSection[]
  page: MastPage
  isDraftMode?: boolean
}) {
  const {dataAttr, visualEditingEnabled} = useMastSanity()
  const emitAttrs = Boolean(isDraftMode && visualEditingEnabled)

  const dataSanityAttr = emitAttrs
    ? dataAttr({
        id: page._id,
        type: page._type,
        path: `pageBuilder`,
      }).toString()
    : undefined

  return (
    <div data-sanity={dataSanityAttr}>
      {pageBuilderSections.map((block: any, index: number) => (
        <BlockRenderer
          key={block._key}
          index={index}
          block={block}
          pageId={emitAttrs ? page._id : undefined}
          pageType={emitAttrs ? page._type : undefined}
        />
      ))}
    </div>
  )
}

function RenderEmptyState({page}: {page: MastPage | null}) {
  const {Link} = useMastHost()
  const {sanity} = useMastSanity()

  if (!page) {
    return null
  }
  return (
    <div className="container">
      <h1 className="text-4xl font-extrabold text-foreground tracking-tight sm:text-5xl">
        This page has no content!
      </h1>
      <p className="mt-2 text-base text-muted-foreground">
        Open the page in Sanity Studio to add content.
      </p>
      <div className="mt-10 flex">
        <Link
          className="rounded-[0.5rem] flex gap-2 mr-6 items-center bg-brand hover:bg-brand-dark focus:bg-brand-dark py-3 px-6 text-white transition-colors duration-300"
          href={`${sanity.studioUrl}/structure/intent/edit/template=page;type=page;path=pageBuilder;id=${page._id}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Add content to this page
        </Link>
      </div>
    </div>
  )
}

export default function PageBuilder({page, isDraftMode}: PageBuilderPageProps) {
  const pageBuilderSections = useOptimistic<
    PageBuilderSection[] | undefined,
    SanityDocument<PageData>
  >(page?.pageBuilder || [], (currentSections, action) => {
    if (action.id !== page?._id) {
      return currentSections
    }

    if (action.document.pageBuilder) {
      const currentKeys =
        currentSections
          ?.map((s) => s._key)
          .sort()
          .join(',') || ''
      const newKeys = action.document.pageBuilder
        .map((s: PageBuilderSection) => s._key)
        .sort()
        .join(',')
      const isReorder = currentKeys === newKeys && currentKeys.length > 0

      if (isReorder) {
        return action.document.pageBuilder.map(
          (section: PageBuilderSection) =>
            currentSections?.find((s) => s._key === section?._key) || section,
        )
      }

      return action.document.pageBuilder
    }

    return currentSections
  })

  if (!page) {
    return <RenderEmptyState page={page} />
  }

  if (pageBuilderSections && pageBuilderSections.length > 0) {
    return (
      <RenderSections
        pageBuilderSections={pageBuilderSections}
        page={page}
        isDraftMode={isDraftMode}
      />
    )
  }

  return <RenderEmptyState page={page} />
}
