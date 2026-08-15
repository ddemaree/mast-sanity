import type {BlockRegistry} from './host/types'
import HeadingBlock from './blocks/HeadingBlock'
import RichTextBlock from './blocks/RichTextBlock'
import ImageBlock from './blocks/ImageBlock'
import ButtonBlock from './blocks/ButtonBlock'
import SpacerBlock from './blocks/SpacerBlock'
import DividerBlock from './blocks/DividerBlock'
import CardBlock from './blocks/CardBlock'
import EyebrowBlock from './blocks/EyebrowBlock'
import IconBlock from './blocks/IconBlock'
import AccordionBlock from './blocks/AccordionBlock'
import Row from './blocks/Row'
import BreadcrumbBlock from './blocks/BreadcrumbBlock'
import TableBlock from './blocks/TableBlock'
import SliderBlock from './blocks/SliderBlock'
import TabsBlock from './blocks/TabsBlock'
import ModalBlock from './blocks/ModalBlock'
import InlineVideoBlock from './blocks/InlineVideoBlock'
import MarqueeBlock from './blocks/MarqueeBlock'
import ContentWrap from './blocks/ContentWrap'
import BlogGridBlock from './blocks/BlogGridBlock'

export const defaultBlockRegistry: BlockRegistry = {
  headingBlock: HeadingBlock,
  richTextBlock: RichTextBlock,
  imageBlock: ImageBlock,
  buttonBlock: ButtonBlock,
  spacerBlock: SpacerBlock,
  dividerBlock: DividerBlock,
  cardBlock: CardBlock,
  eyebrowBlock: EyebrowBlock,
  iconBlock: IconBlock,
  accordionBlock: AccordionBlock,
  row: Row,
  breadcrumbBlock: BreadcrumbBlock,
  tableBlock: TableBlock,
  sliderBlock: SliderBlock,
  tabsBlock: TabsBlock,
  modalBlock: ModalBlock,
  inlineVideoBlock: InlineVideoBlock,
  marqueeBlock: MarqueeBlock,
  contentWrap: ContentWrap,
  blogGridBlock: BlogGridBlock,
}

/** Block types that require client hydration (the 9 'use client' blocks). */
export const HYDRATION_REQUIRED_BLOCK_TYPES = new Set([
  'tabsBlock',
  'sliderBlock',
  'modalBlock',
  'marqueeBlock',
  'tableBlock',
  'inlineVideoBlock',
  'blogGridBlock',
  'eyebrowBlock',
  'breadcrumbBlock',
])

/** Walk section → rows → columns → content (and nested rows/cards/tabs) for hydration need. */
export function sectionNeedsHydration(section: unknown): boolean {
  const visit = (node: unknown): boolean => {
    if (node == null) return false
    if (Array.isArray(node)) return node.some(visit)
    if (typeof node !== 'object') return false
    const obj = node as Record<string, unknown>
    if (typeof obj._type === 'string' && HYDRATION_REQUIRED_BLOCK_TYPES.has(obj._type)) {
      return true
    }
    return Object.values(obj).some(visit)
  }
  return visit(section)
}
