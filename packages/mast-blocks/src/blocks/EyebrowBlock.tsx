'use client'

import {stegaClean} from '@sanity/client/stega'
import {Eyebrow} from '../ui/eyebrow'
import {parseCustomStyle} from '../lib/parseCustomStyle'
import {resolveSmartString} from '../lib/resolveContentVariable'
import type {SmartString} from '../types'

interface EyebrowBlockProps {
  block: {
    _key: string
    _type: string
    text?: SmartString | string
    variant?: 'text' | 'overline' | 'pill'
    color?: 'default' | 'brand' | 'blue' | 'muted'
    align?: 'left' | 'center' | 'right'
    customStyle?: string
  }
  index: number
}

const alignClasses: Record<string, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

export default function EyebrowBlock({block}: EyebrowBlockProps) {
  const {text, variant = 'text', color = 'default', align = 'left', customStyle} = block

  // Resolve SmartString to text value (handles both static text and variable references)
  const resolvedText = resolveSmartString(text, '')

  if (!resolvedText) return null

  const cleanVariant = stegaClean(variant)
  const cleanColor = stegaClean(color)
  const cleanAlign = stegaClean(align)

  const alignClass = alignClasses[cleanAlign] || alignClasses.left
  const inlineStyle = parseCustomStyle(customStyle)

  return (
    <div className={alignClass} style={inlineStyle}>
      <Eyebrow variant={cleanVariant} color={cleanColor}>
        {resolvedText}
      </Eyebrow>
    </div>
  )
}
