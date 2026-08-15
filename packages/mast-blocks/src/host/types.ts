import type * as React from 'react'
import type {SanityClient} from '@sanity/client'

/** Serializable Sanity project config. No process.env reads inside the package. */
export interface MastSanityConfig {
  projectId: string
  dataset: string
  apiVersion: string
  /** Base URL of the Studio, used for edit-intent links and data attributes. */
  studioUrl: string
}

/**
 * Host-supplied image renderer.
 * `src` is always a finished Sanity CDN URL (urlForImage already applied
 * crop/hotspot/auto-format). The host decides how to optimize delivery.
 */
export interface MastImageProps {
  src: string
  alt: string
  /** Intrinsic dimensions; provided whenever fill is false. */
  width?: number
  height?: number
  /** Cover-position within a relatively-positioned parent (next/image fill semantics). */
  fill?: boolean
  sizes?: string
  className?: string
  style?: React.CSSProperties
  loading?: 'lazy' | 'eager'
  fetchPriority?: 'high' | 'auto'
  /** Tiny blurred data/CDN URL from getBlurDataUrl(); host may ignore. */
  blurDataURL?: string
  draggable?: boolean
}

/** Host-supplied link renderer. Superset of a plain anchor. */
export interface MastLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string
  /** Hint only; hosts without prefetch ignore it. */
  prefetch?: boolean
}

export type BlockProps<T extends {_key: string; _type: string} = any> = {
  block: T
  index: number
}
export type BlockComponent = React.ComponentType<BlockProps>
export type BlockRegistry = Record<string, BlockComponent>

export interface MastHostAdapter {
  Image: React.ComponentType<MastImageProps>
  Link: React.ComponentType<MastLinkProps>
  /** Reactive read of a URL search param (ModalBlock's ?modal=id). */
  useSearchParam: (key: string) => string | null
  sanity: MastSanityConfig
  /**
   * Client for blocks that fetch on the client (BlogGridBlock).
   * Published-perspective, CDN, no token. Required if blogGridBlock is used.
   */
  client?: SanityClient
  /** Per-host block substitutions merged over the default registry. */
  registryOverrides?: Partial<BlockRegistry>
  /** True only inside a draft-mode / Presentation render. Gates data-sanity attrs. */
  visualEditingEnabled?: boolean
}
