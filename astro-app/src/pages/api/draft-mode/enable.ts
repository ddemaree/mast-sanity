import type {APIRoute} from 'astro'
import {validatePreviewUrl} from '@sanity/preview-url-secret'
import {draftClient} from '../../../lib/sanity'

export const prerender = false

export const GET: APIRoute = async ({request, cookies, redirect, url}) => {
  const {isValid, redirectTo = '/'} = await validatePreviewUrl(draftClient, request.url)

  if (!isValid) {
    return new Response('Invalid secret', {status: 401})
  }

  const isSecure = url.protocol === 'https:'
  cookies.set('mast_draft', '1', {
    httpOnly: true,
    path: '/',
    sameSite: isSecure ? 'none' : 'lax',
    secure: isSecure,
  })

  return redirect(redirectTo)
}
