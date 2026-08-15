import {createClient, type QueryParams} from '@sanity/client'

const projectId = import.meta.env.PUBLIC_SANITY_PROJECT_ID || ''
const dataset = import.meta.env.PUBLIC_SANITY_DATASET || ''
const apiVersion = import.meta.env.PUBLIC_SANITY_API_VERSION || '2025-09-25'
const studioUrl = import.meta.env.PUBLIC_SANITY_STUDIO_URL || 'http://localhost:3334'
const token = import.meta.env.SANITY_API_READ_TOKEN

export const sanityConfig = {
  projectId,
  dataset,
  apiVersion,
  studioUrl,
} as const

export const publishedClient = createClient({
  projectId,
  dataset,
  apiVersion,
  // Skip CDN in local/dev so freshly published content is visible immediately
  useCdn: import.meta.env.PROD,
  perspective: 'published',
})

export const draftClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
  token,
  perspective: 'drafts',
  stega: {
    enabled: true,
    studioUrl,
  },
})

export async function sanityFetch<T>({
  query,
  params = {},
  draft = false,
}: {
  query: string
  params?: QueryParams
  draft?: boolean
}): Promise<T> {
  const client = draft ? draftClient : publishedClient
  return client.fetch<T>(query, params)
}
