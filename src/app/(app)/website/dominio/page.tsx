'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Clipboard, ExternalLink, Globe2, Loader2, RefreshCw, ShieldCheck, ShoppingBag, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { DominioProprio, RegistoDns } from '@/lib/dominios'

type Resposta = { dominio: DominioProprio | null; integracaoConfigurada: boolean; error?: string }

async function lerResposta(res: Response): Promise<Resposta> {
  const data = await res.json().catch(() => ({})) as Resposta
  if (!res.ok) throw new Error(data.error || 'Ocorreu um erro. Tenta novamente.')
  return data
}

async function escrever(init: RequestInit): Promise<Resposta> {
  const res = await fetch('/api/dominio', init)
  return lerResposta(res)
}

export default function DominioPage() {
  const [dados, setDados] = useState<Resposta | null>(null)
  const [valor, setValor] = useState('')
  const [aTrabalhar, setATrabalhar] = useState(false)
  const [copiado, setCopiado] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    fetch('/api/dominio', { cache: 'no-store' })
      .then(lerResposta)
      .then(novo => { if (ativo) setDados(novo) })
      .catch(erro => { if (ativo) toast.error(erro instanceof Error ? erro.message : 'Não foi possível carregar o domínio.') })
    return () => { ativo = false }
  }, [])

  async function ligar() {
    if (!valor.trim()) return toast.error('Escreve o domínio que queres ligar.')
    setATrabalhar(true)
    try {
      const novo = await escrever({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dominio: valor }),
      })
      setDados(novo)
      toast.success('Domínio adicionado. Falta confirmar o DNS.')
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : 'Não foi possível ligar o domínio.')
    } finally { setATrabalhar(false) }
  }

  async function verificar() {
    setATrabalhar(true)
    try {
      const novo = await escrever({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'verificar' }),
      })
      setDados(novo)
      if (novo.dominio?.estado === 'ativo') toast.success('Domínio ativo e protegido por SSL.')
      else toast.info('O DNS ainda está a propagar. Confirma os registos abaixo.')
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : 'Não foi possível verificar.')
    } finally { setATrabalhar(false) }
  }

  async function remover() {
    if (!confirm('Remover este domínio do site? O domínio continua a ser teu, mas deixa de abrir o site.')) return
    setATrabalhar(true)
    try {
      await escrever({ method: 'DELETE' })
      setDados(prev => ({ dominio: null, integracaoConfigurada: prev?.integracaoConfigurada ?? false }))
      setValor('')
      toast.success('Domínio removido do site.')
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : 'Não foi possível remover.')
    } finally { setATrabalhar(false) }
  }

  async function copiar(registo: RegistoDns, campo: 'nome' | 'valor') {
    const chave = `${registo.tipo}-${campo}`
    await navigator.clipboard.writeText(registo[campo])
    setCopiado(chave)
    setTimeout(() => setCopiado(null), 1500)
  }

  const dominio = dados?.dominio

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10 pb-28 flex flex-col gap-6">
      <div>
        <Link href="/website" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-3.5 w-3.5" /> Site de reservas
        </Link>
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><Globe2 className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Domínio próprio</h1>
            <p className="text-sm text-muted-foreground mt-1">O teu site num endereço independente, como casadomar.pt.</p>
          </div>
        </div>
      </div>

      {!dados ? (
        <div className="rounded-xl border border-border bg-card p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : dominio ? (
        <>
          <section className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Domínio ligado</p>
                <p className="font-semibold mt-0.5">{dominio.dominio}</p>
              </div>
              <span className={`self-start inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${dominio.estado === 'ativo' ? 'bg-emerald-500/10 text-emerald-700' : dominio.estado === 'erro' ? 'bg-red-500/10 text-red-700' : 'bg-amber-500/10 text-amber-700'}`}>
                {dominio.estado === 'ativo' && <Check className="h-3.5 w-3.5" />}
                {dominio.estado === 'ativo' ? 'Ativo' : dominio.estado === 'erro' ? 'Precisa de atenção' : 'A aguardar DNS'}
              </span>
            </div>

            {dominio.estado === 'ativo' ? (
              <div className="rounded-lg bg-emerald-500/8 border border-emerald-500/20 p-3 text-sm text-emerald-800 flex gap-2.5">
                <ShieldCheck className="h-5 w-5 shrink-0" />
                <div><p className="font-medium">Site online e certificado SSL ativo</p><p className="text-xs mt-0.5 opacity-80">O domínio abre o site certo e a ligação é segura.</p></div>
              </div>
            ) : (
              <div className="rounded-lg bg-muted/60 p-3 text-sm">
                <p className="font-medium">No fornecedor onde compraste o domínio, cria os registos abaixo.</p>
                <p className="text-xs text-muted-foreground mt-1">A propagação pode demorar alguns minutos e, em certos fornecedores, até 48 horas.</p>
              </div>
            )}

            {dominio.dns.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Nome</th><th className="px-3 py-2">Valor</th></tr></thead>
                  <tbody>
                    {dominio.dns.map((r, i) => (
                      <tr key={`${r.tipo}-${r.nome}-${i}`} className="border-t border-border">
                        <td className="px-3 py-2 font-mono text-xs">{r.tipo}</td>
                        <td className="px-3 py-2"><button onClick={() => copiar(r, 'nome')} className="font-mono text-xs inline-flex gap-1.5 items-center hover:text-primary">{r.nome}<Clipboard className="h-3 w-3" />{copiado === `${r.tipo}-nome` && <span className="sr-only">Copiado</span>}</button></td>
                        <td className="px-3 py-2"><button onClick={() => copiar(r, 'valor')} className="font-mono text-xs break-all text-left inline-flex gap-1.5 items-center hover:text-primary">{r.valor}<Clipboard className="h-3 w-3 shrink-0" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {dominio.ultimo_erro && <p className="text-xs text-red-600">{dominio.ultimo_erro}</p>}

            <div className="flex flex-wrap gap-2 pt-1">
              {dominio.estado === 'ativo' && <a href={`https://${dominio.dominio}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-3.5 py-2 text-sm font-medium"><ExternalLink className="h-4 w-4" /> Abrir site</a>}
              <button onClick={verificar} disabled={aTrabalhar} className="inline-flex items-center gap-2 rounded-lg border border-input px-3.5 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${aTrabalhar ? 'animate-spin' : ''}`} /> Verificar novamente</button>
              <button onClick={remover} disabled={aTrabalhar} className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm text-red-600 hover:bg-red-500/5 disabled:opacity-50 sm:ml-auto"><Trash2 className="h-4 w-4" /> Remover</button>
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
            <div><h2 className="font-semibold">Já tens um domínio?</h2><p className="text-sm text-muted-foreground mt-1">Pode ter sido comprado em qualquer fornecedor. Não é transferido nem fica preso ao Anfitrião.</p></div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input value={valor} onChange={e => setValor(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void ligar() }} placeholder="casadomar.pt" autoCapitalize="none" autoCorrect="off" className="flex-1 rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
              <button onClick={ligar} disabled={aTrabalhar || !dados.integracaoConfigurada} className="inline-flex justify-center items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{aTrabalhar && <Loader2 className="h-4 w-4 animate-spin" />} Ligar domínio</button>
            </div>
            {!dados.integracaoConfigurada && <p className="text-xs text-amber-700">A ativação automática está a ser preparada pelo administrador da plataforma.</p>}
          </section>

          <section className="rounded-xl border border-border bg-card p-5 flex flex-col sm:flex-row gap-4 sm:items-center">
            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0"><ShoppingBag className="h-5 w-5" /></div>
            <div className="flex-1"><h2 className="font-semibold">Ainda não tens domínio?</h2><p className="text-sm text-muted-foreground mt-1">Nós tratamos da pesquisa, compra e configuração. O domínio fica registado em nome do cliente.</p></div>
            <a href="mailto:suporte@anfitrioes.pt?subject=Quero%20comprar%20um%20dom%C3%ADnio" className="rounded-lg border border-input px-3.5 py-2 text-sm font-medium text-center hover:bg-muted">Pedir proposta</a>
          </section>
        </>
      )}

      <div className="grid sm:grid-cols-3 gap-3 text-xs text-muted-foreground">
        <p><strong className="block text-foreground mb-1">1. Liga</strong>Indica o domínio comprado onde quiseres.</p>
        <p><strong className="block text-foreground mb-1">2. Configura</strong>Copia os registos DNS apresentados.</p>
        <p><strong className="block text-foreground mb-1">3. Publica</strong>SSL e encaminhamento são automáticos.</p>
      </div>
    </div>
  )
}
