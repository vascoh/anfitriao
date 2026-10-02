export type RegistoDns = {
  tipo: 'A' | 'CNAME' | 'TXT'
  nome: string
  valor: string
  motivo?: string
}

export type DominioProprio = {
  dominio: string
  slug: string
  verificado: boolean
  configurado: boolean
  estado: 'pendente' | 'ativo' | 'erro'
  dns: RegistoDns[]
  ultimo_erro?: string | null
  atualizado_em?: string
}

const HOST_LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/

/**
 * Recebe aquilo que uma pessoa tende a colar (URL, domínio ou domínio com
 * uma barra final) e devolve apenas o hostname canónico. Não aceitamos paths:
 * a associação é sempre do domínio inteiro, nunca de uma página.
 */
export function normalizarDominio(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const cru = valor.trim().toLowerCase()
  if (!cru) return null

  try {
    const url = new URL(cru.includes('://') ? cru : `https://${cru}`)
    if (url.username || url.password || url.port) return null
    if (url.pathname !== '/' || url.search || url.hash) return null
    return url.hostname.replace(/\.$/, '')
  } catch {
    return null
  }
}

export function problemaDominio(dominio: string | null): string | null {
  if (!dominio) return 'Indica um domínio válido, por exemplo casadomar.pt.'
  if (dominio.length > 253 || dominio.includes('*')) return 'Este domínio não é válido.'
  if (dominio === 'localhost' || dominio.endsWith('.localhost')) return 'Não podes ligar um domínio local.'
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(dominio) || dominio.includes(':')) {
    return 'Indica um domínio, não um endereço IP.'
  }
  const partes = dominio.split('.')
  if (partes.length < 2 || partes.some(p => !HOST_LABEL.test(p))) {
    return 'Indica um domínio válido, por exemplo casadomar.pt.'
  }
  if (partes.at(-1)!.length < 2) return 'A extensão do domínio não parece válida.'
  return null
}

export function dominioDaPlataforma(dominio: string): boolean {
  const appHost = (() => {
    try { return new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://anfitrioes.pt').hostname }
    catch { return 'anfitrioes.pt' }
  })()
  return dominio === appHost || dominio.endsWith(`.${appHost}`) ||
    dominio === 'anfitrioes.pt' || dominio.endsWith('.anfitrioes.pt') ||
    dominio.endsWith('.vercel.app')
}

export function estadoDominio(verificado: boolean, configurado: boolean, erro?: string | null): DominioProprio['estado'] {
  if (verificado && configurado) return 'ativo'
  if (erro) return 'erro'
  return 'pendente'
}
