import {createImageHelpers, linkResolver as packageLinkResolver} from '@mast/blocks'
import {Link} from '@/sanity.types'
import {dataset, projectId} from '@/sanity/lib/api'

const {urlForImage, getBlurDataUrl, getImageWithBlur} = createImageHelpers({
  projectId,
  dataset,
})

export {urlForImage, getBlurDataUrl, getImageWithBlur}

export function resolveOpenGraphImage(image: any, width = 1200, height = 627) {
  if (!image) return
  const url = urlForImage(image)?.width(1200).height(627).fit('crop').url()
  if (!url) return
  return {url, alt: image?.alt as string, width, height}
}

export function linkResolver(link: Link | any | undefined): string | null {
  return packageLinkResolver(link)
}
