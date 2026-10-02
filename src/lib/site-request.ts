import 'server-only'

import { headers } from 'next/headers'
import { APP_URL } from './config'

export async function basePathDoSite(slug: string): Promise<string> {
  return (await headers()).get('x-anfitriao-custom-domain') ? '' : `/r/${slug}`
}

export async function baseUrlDoSite(slug: string): Promise<string> {
  const host = (await headers()).get('x-anfitriao-custom-domain')
  return host ? `https://${host}` : `${APP_URL}/r/${slug}`
}
