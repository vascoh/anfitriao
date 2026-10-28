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

/** Um endereço do site no domínio próprio e o que lá abre. */
export type EnderecoDoSite = { caminho: string; titulo: string; grupo: 'pagina' | 'alojamento' | 'legal'; visivel: boolean }

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

/**
 * Sufixos com dois níveis em que se registam domínios. Não é a Public Suffix
 * List inteira — só os que um anfitrião em Portugal tende a usar. Sem isto,
 * `casadomar.com.pt` parecia um subdomínio de `com.pt`.
 */
const SUFIXOS_DUPLOS = new Set([
  'com.pt', 'org.pt', 'edu.pt', 'gov.pt', 'int.pt', 'net.pt', 'nome.pt', 'publ.pt',
  'co.uk', 'org.uk', 'com.br', 'com.es', 'nom.es', 'org.es', 'co.ao', 'co.mz', 'com.cv',
])

/** O domínio registado (a «zona» onde se criam os registos DNS). */
export function dominioRaiz(dominio: string): string {
  const partes = dominio.split('.')
  const niveis = SUFIXOS_DUPLOS.has(partes.slice(-2).join('.')) ? 3 : 2
  return partes.slice(-niveis).join('.')
}

export function eRaiz(dominio: string): boolean {
  return dominioRaiz(dominio) === dominio
}

/**
 * O nome tal como se escreve no painel do fornecedor: `@` para a raiz, `www`,
 * `_vercel`… Quase todos acrescentam o domínio sozinhos.
 */
export function nomeRelativo(nome: string, raiz: string): string {
  const limpo = nome.replace(/\.$/, '').toLowerCase()
  if (limpo === raiz || limpo === '@' || !limpo) return '@'
  return limpo.endsWith(`.${raiz}`) ? limpo.slice(0, -raiz.length - 1) : limpo
}

/** IP histórico da Vercel; continua válido ao lado do recomendado por projeto. */
export const IP_VERCEL = '76.76.21.21'
export const CNAME_VERCEL = 'cname.vercel-dns.com'
const CNAME_VERCEL_RE = /(^|\.)vercel-dns(-\d+)?\.com\.?$/

/** Um valor encontrado no DNS serve para o registo pedido? */
export function valorServe(registo: Pick<RegistoDns, 'tipo' | 'valor'>, encontrado: string): boolean {
  const v = encontrado.replace(/\.$/, '').toLowerCase()
  if (registo.tipo === 'A') return v === registo.valor || v === IP_VERCEL
  if (registo.tipo === 'CNAME') return v === registo.valor.toLowerCase() || CNAME_VERCEL_RE.test(v)
  return encontrado.replace(/^"|"$/g, '') === registo.valor
}

export type Fornecedor = {
  id: string
  nome: string
  /** O que costuma correr mal neste fornecedor. */
  dica?: string
}

const FORNECEDORES: Array<Fornecedor & { ns: RegExp }> = [
  { id: 'cloudflare', nome: 'Cloudflare', ns: /\.ns\.cloudflare\.com$/, dica: 'Deixa a nuvem cinzenta («Apenas DNS») nos registos do site. Com a nuvem laranja o certificado SSL não é emitido.' },
  { id: 'amen', nome: 'Amen', ns: /(^|\.)amen\.(pt|fr|es|nl)$|amenworld/ },
  { id: 'ptisp', nome: 'PTisp', ns: /(^|\.)ptisp\.(pt|com)$/ },
  { id: 'dominios-pt', nome: 'Dominios.pt', ns: /(^|\.)dominios\.pt$/ },
  { id: 'godaddy', nome: 'GoDaddy', ns: /\.domaincontrol\.com$/, dica: 'Se já existir um registo A «@» com o valor «Parked», edita-o em vez de criar outro.' },
  { id: 'ovh', nome: 'OVHcloud', ns: /\.ovh\.(net|ca)$|\.anycast\.me$/ },
  { id: 'namecheap', nome: 'Namecheap', ns: /\.registrar-servers\.com$/, dica: 'Em «Advanced DNS», apaga o «URL Redirect Record» que vem de origem.' },
  { id: 'hostinger', nome: 'Hostinger', ns: /\.dns-parking\.com$|hostinger/ },
  { id: 'ionos', nome: 'IONOS', ns: /\.ui-dns\.(com|de|org|biz)$/ },
  { id: 'squarespace', nome: 'Squarespace (antigo Google Domains)', ns: /googledomains\.com$|squarespacedns\.com$/ },
  { id: 'wix', nome: 'Wix', ns: /\.wixdns\.net$/, dica: 'O domínio pode estar ligado a um site Wix. Desliga-o do site Wix antes de alterares os registos.' },
  { id: 'route53', nome: 'Amazon Route 53', ns: /\.awsdns-\d+\./ },
  { id: 'vercel', nome: 'Vercel', ns: /\.vercel-dns\.com$/ },
]

/** Quem gere o DNS, a partir dos nameservers. */
export function identificarFornecedor(nameservers: string[]): Fornecedor | null {
  for (const ns of nameservers.map(n => n.replace(/\.$/, '').toLowerCase())) {
    const f = FORNECEDORES.find(f => f.ns.test(ns))
    if (f) return { id: f.id, nome: f.nome, dica: f.dica }
  }
  return null
}
