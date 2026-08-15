// Link-like object that may or may not have _type (navigation links don't have it)
type LinkLike = {
  linkType?: string
  href?: string
  openInNewTab?: boolean
  page?: string | {_ref: string; _type: 'reference'}
  post?: string | {_ref: string; _type: 'reference'}
  variable?: {
    _id?: string
    variableType?: 'link'
    linkValue?: LinkLike
  }
}

/** Resolve a Sanity link object to a path or URL. */
export function linkResolver(link: LinkLike | undefined): string | null {
  if (!link) return null

  // If linkType is not set but href is, set linkType to "href".
  // Comes into play when pasting links into the portable text editor.
  if (!link.linkType && link.href) {
    link.linkType = 'href'
  }

  const linkType = link.linkType as string
  switch (linkType) {
    case 'href':
    case 'external': // Legacy alias for 'href'
      return link.href || null
    case 'page':
      if (link?.page && typeof link.page === 'string') {
        return `/${link.page}`
      }
      return null
    case 'post':
      if (link?.post && typeof link.post === 'string') {
        return `/posts/${link.post}`
      }
      return null
    case 'variable':
      if (link?.variable?.linkValue) {
        return linkResolver(link.variable.linkValue)
      }
      return null
    default:
      return null
  }
}
