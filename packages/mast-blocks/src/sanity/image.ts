import createImageUrlBuilder from '@sanity/image-url'
import {getImageDimensions} from '@sanity/asset-utils'
import type {MastSanityConfig} from '../host/types'

export function createImageHelpers(config: Pick<MastSanityConfig, 'projectId' | 'dataset'>) {
  const imageBuilder = createImageUrlBuilder({
    projectId: config.projectId || '',
    dataset: config.dataset || '',
  })

  const urlForImage = (source: any) => {
    if (!source?.asset?._ref) {
      return undefined
    }

    const imageRef = source?.asset?._ref
    const crop = source.crop

    const {width, height} = getImageDimensions(imageRef)

    if (Boolean(crop)) {
      const croppedWidth = Math.floor(width * (1 - (crop.right + crop.left)))
      const croppedHeight = Math.floor(height * (1 - (crop.top + crop.bottom)))
      const left = Math.floor(width * crop.left)
      const top = Math.floor(height * crop.top)

      return imageBuilder?.image(source).rect(left, top, croppedWidth, croppedHeight).auto('format')
    }

    return imageBuilder?.image(source).auto('format')
  }

  function getBlurDataUrl(source: any): string | undefined {
    if (!source?.asset?._ref) {
      return undefined
    }
    return urlForImage(source)?.width(20).blur(50).quality(30).url()
  }

  function getImageWithBlur(source: any) {
    if (!source?.asset?._ref) {
      return undefined
    }

    const imageRef = source?.asset?._ref
    const {width, height} = getImageDimensions(imageRef)

    return {
      urlBuilder: urlForImage(source),
      blurDataUrl: getBlurDataUrl(source),
      dimensions: {width, height},
    }
  }

  return {urlForImage, getBlurDataUrl, getImageWithBlur}
}
