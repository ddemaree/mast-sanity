'use client'

import React from 'react'
import {useMastHost} from '../host/context'
import {defaultBlockRegistry} from '../registry'

interface ContentBlockProps {
  block: {
    _key: string
    _type: string
    [key: string]: any
  }
  index: number
}

export default function ContentBlockRenderer({block, index}: ContentBlockProps) {
  const {registryOverrides} = useMastHost()
  const registry = {...defaultBlockRegistry, ...registryOverrides}
  const Component = registry[block._type]

  if (Component) {
    return <Component block={block} index={index} />
  }

  return (
    <div className="w-full bg-muted-background text-center text-muted-foreground p-4 rounded my-2">
      A &ldquo;{block._type}&rdquo; content block hasn&apos;t been created
    </div>
  )
}
