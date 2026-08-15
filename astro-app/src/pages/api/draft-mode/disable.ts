import type {APIRoute} from 'astro'

export const prerender = false

export const GET: APIRoute = async ({cookies, redirect, url}) => {
  cookies.delete('mast_draft', {path: '/'})
  const next = url.searchParams.get('redirect') || '/'
  return redirect(next)
}
