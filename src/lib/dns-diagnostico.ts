import 'server-only'

import { Resolver } from 'node:dns/promises'
import { dominioRaiz, identificarFornecedor, nomeRelativo, valorServe, type Fornecedor, type RegistoDns } from './dominios'

export type EstadoRegisto = 'certo' | 'em-falta' | 'diferente'

export type RegistoVerificado = RegistoDns & {
  /** Como se escreve no painel do fornecedor (`@`, `www`, `_vercel`). */
  nomeCurto: string
  estado: EstadoRegisto
  /** O que o DNS público responde hoje para este nome e tipo. */
  encontrado: string[]
}

export type Conflito = { tipo: string; nome: string; valor: string; motivo: string }

export type DiagnosticoDns = {
  raiz: string
  fornecedor: Fornecedor | null
  nameservers: string[]
  registos: RegistoVerificado[]
  conflitos: Conflito[]
  /** Falhou a consulta (rede, timeout) — não quer dizer que o DNS esteja mal. */
  indisponivel?: boolean
}

function resolver() {
  // Resolvedores públicos em vez dos do sistema: evitam respostas guardadas em
  // cache e são os que a maioria dos hóspedes vai acabar por consultar.
  const r = new Resolver({ timeout: 2500, tries: 1 })
  r.setServers(['1.1.1.1', '8.8.8.8'])
  return r
}

const vazio = (erro: unknown): string[] => {
  const code = (erro as { code?: string })?.code
  if (code === 'ENODATA' || code === 'ENOTFOUND' || code === 'ENOTIMP' || code === 'ESERVFAIL') return []
  throw erro
}

async function consultar(r: Resolver, tipo: RegistoDns['tipo'] | 'AAAA', nome: string): Promise<string[]> {
  try {
    if (tipo === 'A') return await r.resolve4(nome)
    if (tipo === 'AAAA') return await r.resolve6(nome)
    if (tipo === 'CNAME') return await r.resolveCname(nome)
    return (await r.resolveTxt(nome)).map(partes => partes.join(''))
  } catch (erro) {
    return vazio(erro)
  }
}

function nomeCompleto(nome: string, raiz: string): string {
  if (nome === '@') return raiz
  return nome === raiz || nome.endsWith(`.${raiz}`) ? nome : `${nome}.${raiz}`
}

/**
 * Lê o DNS público e compara-o, registo a registo, com o que o site precisa.
 * Serve para mostrar ao anfitrião *qual* linha está mal — a Vercel só diz
 * «mal configurado».
 */
export async function diagnosticarDns(dominio: string, necessarios: RegistoDns[]): Promise<DiagnosticoDns> {
  const raiz = dominioRaiz(dominio)
  const r = resolver()
  try {
    const nameservers = await r.resolveNs(raiz).catch(vazio)
    const registos = await Promise.all(necessarios.map(async (reg): Promise<RegistoVerificado> => {
      const completo = nomeCompleto(reg.nome, raiz)
      let encontrado = await consultar(r, reg.tipo, completo)
      // Um CNAME em falta pode estar a ser substituído por um A: mostrar isso.
      if (reg.tipo === 'CNAME' && encontrado.length === 0) {
        const comoA = await consultar(r, 'A', completo)
        if (comoA.length) encontrado = comoA.map(ip => `A ${ip}`)
      }
      const certo = reg.tipo === 'A'
        ? encontrado.length > 0 && encontrado.every(v => valorServe(reg, v))
        : encontrado.some(v => valorServe(reg, v))
      return {
        ...reg,
        nomeCurto: nomeRelativo(completo, raiz),
        estado: certo ? 'certo' : encontrado.length ? 'diferente' : 'em-falta',
        encontrado,
      }
    }))

    const conflitos: Conflito[] = []
    for (const reg of registos) {
      if (reg.tipo === 'A') {
        for (const v of reg.encontrado.filter(v => !valorServe(reg, v))) {
          conflitos.push({ tipo: 'A', nome: reg.nomeCurto, valor: v, motivo: 'Aponta para outro servidor (talvez o site antigo). Apaga-o ou substitui-o pelo valor acima.' })
        }
        const ipv6 = await consultar(r, 'AAAA', nomeCompleto(reg.nome, raiz))
        for (const v of ipv6) {
          conflitos.push({ tipo: 'AAAA', nome: reg.nomeCurto, valor: v, motivo: 'Com um registo IPv6 antigo, parte dos visitantes chega ao servidor errado. Apaga-o.' })
        }
      }
      if (reg.tipo === 'CNAME') {
        for (const v of reg.encontrado.filter(v => v.startsWith('A '))) {
          conflitos.push({ tipo: 'A', nome: reg.nomeCurto, valor: v.slice(2), motivo: 'Este nome tem um registo A. Apaga-o e cria o CNAME acima.' })
        }
      }
    }

    return { raiz, fornecedor: identificarFornecedor(nameservers), nameservers, registos, conflitos }
  } catch {
    return {
      raiz, fornecedor: null, nameservers: [], conflitos: [], indisponivel: true,
      registos: necessarios.map(reg => ({ ...reg, nomeCurto: nomeRelativo(nomeCompleto(reg.nome, raiz), raiz), estado: 'em-falta', encontrado: [] })),
    }
  }
}
