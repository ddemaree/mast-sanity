'use client'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import {useSearchParams} from 'next/navigation'
import {createClient} from 'next-sanity'
import type {MastHostAdapter, MastImageProps, MastLinkProps} from '@mast/blocks'
import {apiVersion, dataset, projectId, studioUrl} from '@/sanity/lib/api'

function NextMastImage({
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
  return (
    <Image
      src={src}
      alt={alt}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      fill={fill}
      sizes={sizes}
      className={className}
      style={style}
      loading={loading}
      fetchPriority={fetchPriority}
      placeholder={blurDataURL ? 'blur' : 'empty'}
      blurDataURL={blurDataURL}
      draggable={draggable}
    />
  )
}

function NextMastLink({href, prefetch, children, ...rest}: MastLinkProps) {
  return (
    <Link href={href} prefetch={prefetch} {...rest}>
      {children}
    </Link>
  )
}

function useNextSearchParam(key: string): string | null {
  const searchParams = useSearchParams()
  return searchParams.get(key)
}

const blogClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true,
  perspective: 'published',
})

const SliderBlock = dynamic(() => import('@mast/blocks/blocks/SliderBlock'), {
  loading: () => <div className="w-full aspect-video bg-muted-background animate-pulse rounded" />,
})
const TabsBlock = dynamic(() => import('@mast/blocks/blocks/TabsBlock'), {
  loading: () => <div className="w-full h-48 bg-muted-background animate-pulse rounded" />,
})
const ModalBlock = dynamic(() => import('@mast/blocks/blocks/ModalBlock'), {
  loading: () => null,
})

export function createNextMastAdapter(options: {
  visualEditingEnabled?: boolean
}): MastHostAdapter {
  return {
    Image: NextMastImage,
    Link: NextMastLink,
    useSearchParam: useNextSearchParam,
    sanity: {
      projectId,
      dataset,
      apiVersion,
      studioUrl,
    },
    client: blogClient,
    registryOverrides: {
      sliderBlock: SliderBlock,
      tabsBlock: TabsBlock,
      modalBlock: ModalBlock,
    },
    visualEditingEnabled: Boolean(options.visualEditingEnabled),
  }
}
