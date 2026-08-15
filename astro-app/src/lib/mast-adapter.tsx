'use client'

import type {MastHostAdapter, MastImageProps, MastLinkProps, MastSanityConfig} from '@mast/blocks'
import {useWindowSearchParam} from '@mast/blocks'
import {createClient} from '@sanity/client'

function AstroImage({
  src,
  alt,
  width,
  height,
  fill,
  sizes,
  className,
  style,
  loading,
  fetchPriority,
  blurDataURL,
  draggable,
}: MastImageProps) {
  if (fill) {
    return (
      <img
        src={src}
        alt={alt}
        sizes={sizes}
        className={className}
        loading={loading}
        fetchPriority={fetchPriority}
        draggable={draggable}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          ...(blurDataURL
            ? {
                backgroundImage: `url(${blurDataURL})`,
                backgroundSize: 'cover',
              }
            : null),
          ...style,
        }}
      />
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      className={className}
      loading={loading}
      fetchPriority={fetchPriority}
      draggable={draggable}
      style={{
        ...(blurDataURL
          ? {
              backgroundImage: `url(${blurDataURL})`,
              backgroundSize: 'cover',
            }
          : null),
        ...style,
      }}
    />
  )
}

function AstroLink({href, children, ...rest}: MastLinkProps) {
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  )
}

export function buildAstroAdapter(
  sanity: MastSanityConfig,
  options?: {visualEditingEnabled?: boolean},
): MastHostAdapter {
  const client = createClient({
    projectId: sanity.projectId,
    dataset: sanity.dataset,
    apiVersion: sanity.apiVersion,
    useCdn: true,
    perspective: 'published',
  })

  return {
    Image: AstroImage,
    Link: AstroLink,
    useSearchParam: useWindowSearchParam,
    sanity,
    client,
    visualEditingEnabled: Boolean(options?.visualEditingEnabled),
  }
}
