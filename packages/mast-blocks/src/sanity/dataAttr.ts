import {
  createDataAttribute,
  type CreateDataAttributeProps,
} from '@sanity/visual-editing/create-data-attribute'
import type {MastSanityConfig} from '../host/types'

type DataAttributeConfig = CreateDataAttributeProps &
  Required<Pick<CreateDataAttributeProps, 'id' | 'type' | 'path'>>

export function createDataAttrHelper(config: MastSanityConfig) {
  return (attr: DataAttributeConfig) =>
    createDataAttribute({
      projectId: config.projectId,
      dataset: config.dataset,
      baseUrl: config.studioUrl,
    }).combine(attr)
}
