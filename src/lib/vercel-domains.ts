import 'server-only'

import { CNAME_VERCEL, IP_VERCEL, dominioRaiz, eRaiz, type RegistoDns } from './dominios'

type VerificacaoVercel = { type?: string; domain?: string; value?: string; reason?: string }
type DominioVercel = { name?: string; verified?: boolean; verification?: VerificacaoVercel[]; error?: { code?: string; message?: string } }
type ConfiguracaoVercel = {
  misconfigured?: boolean
  recommendedCNAME?: Array<{ value?: string }> | { value?: string }
  recommendedIPv4?: Array<{ value?: string }> | { value?: string }
  error?: { code?: string; message?: string }
}

function configuracao() {
  const token = process.env.VERCEL_API_TOKEN
  const projeto = process.env.VERCEL_PROJECT_ID
  const equipa = process.env.VERCEL_TEAM_ID
  if (!token || !projeto) return null
  return { token, projeto, equipa }
}

export function integracaoVercelConfigurada(): boolean {
  return configuracao() !== null
}

async function pedido<T>(path: string, init?: RequestInit): Promise<T> {
  const cfg = configuracao()
  if (!cfg) throw new Error('A ligação da plataforma à Vercel ainda não está configurada.')
  const separador = path.includes('?') ? '&' : '?'
  const url = `https://api.vercel.com${path}${cfg.equipa ? `${separador}teamId=${encodeURIComponent(cfg.equipa)}` : ''}`
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({})) as T & { error?: { message?: string } }
  if (!res.ok) throw new Error(data.error?.message || `A Vercel respondeu com o estado ${res.status}.`)
  return data
}

function projectPath(dominio: string) {
  const cfg = configuracao()
  if (!cfg) throw new Error('A ligação da plataforma à Vercel ainda não está configurada.')
  return `/v9/projects/${encodeURIComponent(cfg.projeto)}/domains/${encodeURIComponent(dominio)}`
}

export async function adicionarDominioVercel(dominio: string): Promise<DominioVercel> {
  const cfg = configuracao()
  if (!cfg) throw new Error('A ligação da plataforma à Vercel ainda não está configurada.')
  return pedido<DominioVercel>(`/v10/projects/${encodeURIComponent(cfg.projeto)}/domains`, {
    method: 'POST',
    body: JSON.stringify({ name: dominio }),
  })
}

/**
 * Quem escreve `www.casadomar.pt` tem de chegar ao mesmo site. A Vercel
 * redireciona na borda, por isso o proxy nunca vê o `www` — só a raiz fica em
 * `custom_domains`. Idempotente: se já existir, não faz nada.
 */
export async function garantirWwwVercel(dominio: string): Promise<void> {
  if (!eRaiz(dominio)) return
  const cfg = configuracao()
  if (!cfg) return
  const www = `www.${dominio}`
  try {
    await pedido(projectPath(www))
    return
  } catch { /* não existe: criar */ }
  await pedido(`/v10/projects/${encodeURIComponent(cfg.projeto)}/domains`, {
    method: 'POST',
    body: JSON.stringify({ name: www, redirect: dominio, redirectStatusCode: 308 }),
  })
}

export async function removerDominioVercel(dominio: string): Promise<void> {
  await pedido(projectPath(dominio), { method: 'DELETE' })
  if (eRaiz(dominio)) await pedido(projectPath(`www.${dominio}`), { method: 'DELETE' }).catch(() => undefined)
}

export async function verificarDominioVercel(dominio: string): Promise<DominioVercel> {
  try {
    return await pedido<DominioVercel>(`${projectPath(dominio)}/verify`, { method: 'POST' })
  } catch {
    // Se não houver challenge pendente, a rota de verificação pode recusar o
    // POST; o GET continua a ser a fonte do estado real.
    return pedido<DominioVercel>(projectPath(dominio))
  }
}

function primeiroValor(valor: ConfiguracaoVercel['recommendedCNAME']): string | undefined {
  if (Array.isArray(valor)) return valor.find(v => v.value)?.value
  return valor?.value
}

/**
 * Estado na Vercel e a lista *completa* de registos de que o domínio precisa
 * (não só os que faltam): a página verifica cada um no DNS público.
 */
export async function estadoNaVercel(dominio: string): Promise<{
  verificado: boolean
  configurado: boolean
  dns: RegistoDns[]
}> {
  const [dominioInfo, config] = await Promise.all([
    pedido<DominioVercel>(projectPath(dominio)),
    pedido<ConfiguracaoVercel>(`/v6/domains/${encodeURIComponent(dominio)}/config`),
  ])

  const dns: RegistoDns[] = []
  const raiz = dominioRaiz(dominio)
  const cname = primeiroValor(config.recommendedCNAME) ?? CNAME_VERCEL
  if (eRaiz(dominio)) {
    dns.push({ tipo: 'A', nome: '@', valor: primeiroValor(config.recommendedIPv4) ?? IP_VERCEL, motivo: 'Abre o site em ' + dominio })
    dns.push({ tipo: 'CNAME', nome: 'www', valor: cname, motivo: `Leva www.${dominio} para o mesmo site` })
  } else {
    dns.push({ tipo: 'CNAME', nome: dominio.slice(0, -raiz.length - 1), valor: cname, motivo: 'Abre o site em ' + dominio })
  }
  for (const verificacao of dominioInfo.verification ?? []) {
    if (verificacao.type === 'TXT' && verificacao.domain && verificacao.value) {
      dns.push({ tipo: 'TXT', nome: verificacao.domain, valor: verificacao.value, motivo: 'Prova que o domínio é teu' })
    }
  }

  return {
    verificado: dominioInfo.verified === true,
    configurado: config.misconfigured === false,
    dns,
  }
}
