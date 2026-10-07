import 'server-only'

import { auth } from '@clerk/nextjs/server'
import type { WebsiteSettings } from './types'

/** O utilizador com sessão é o dono deste site. */
export async function eDonoDoSite(settings: Pick<WebsiteSettings, 'owner_id'>): Promise<boolean> {
  if (!settings.owner_id) return false
  const { userId } = await auth()
  return Boolean(userId) && userId === settings.owner_id
}

/**
 * Quem pode ver uma página do site do anfitrião.
 *
 * Publicado (e página visível no mapa): toda a gente. Desligado, ou página
 * escondida: só o próprio anfitrião, com sessão iniciada — para poder montar o
 * site no editor antes de o pôr no ar. Antes disto a pré-visualização de um
 * site desligado mostrava «em manutenção» na inicial e 404 nas outras
 * páginas, ou seja: era preciso publicar para ver o que se estava a fazer.
 *
 * Num domínio próprio não há sessão da plataforma, por isso lá vale só a
 * primeira regra — que é a certa para um hóspede.
 */
export async function acessoAoSite(
  settings: Pick<WebsiteSettings, 'enabled' | 'owner_id'>,
  paginaVisivel = true,
): Promise<{ pode: boolean }> {
  if (settings.enabled && paginaVisivel) return { pode: true }
  return { pode: await eDonoDoSite(settings) }
}
