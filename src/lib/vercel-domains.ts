import 'server-only'

import type { RegistoDns } from './dominios'

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

export async function removerDominioVercel(dominio: string): Promise<void> {
  await pedido(projectPath(dominio), { method: 'DELETE' })
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
  for (const verificacao of dominioInfo.verification ?? []) {
    if (verificacao.type === 'TXT' && verificacao.domain && verificacao.value) {
      dns.push({ tipo: 'TXT', nome: verificacao.domain, valor: verificacao.value, motivo: verificacao.reason })
    }
  }

  const apex = dominio.split('.').length === 2
  if (config.misconfigured) {
    const recomendado = apex
      ? primeiroValor(config.recommendedIPv4)
      : primeiroValor(config.recommendedCNAME)
    dns.push({
      tipo: apex ? 'A' : 'CNAME',
      nome: apex ? '@' : dominio.split('.')[0],
      valor: recomendado ?? (apex ? '76.76.21.21' : 'cname.vercel-dns.com'),
    })
  }

  return {
    verificado: dominioInfo.verified === true,
    configurado: config.misconfigured === false,
    dns,
  }
}
