'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Check, Copy, Mail, MessageCircle } from 'lucide-react'
import { ErroAoCarregar } from '@/components/erro-ao-carregar'
import { eliminar } from '@/lib/guardar'

interface Estado {
  ligado: boolean
  phone_number_id: string | null
  numero_exibido: string | null
  verify_token: string | null
  webhook: string
  cifraDisponivel: boolean
  rececaoEmail: boolean
}

function Copiar({ valor, rotulo }: { valor: string; rotulo: string }) {
  const [feito, setFeito] = useState(false)
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{rotulo}</span>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
        <code className="flex-1 min-w-0 truncate text-xs">{valor}</code>
        <button
          onClick={async () => {
            try { await navigator.clipboard.writeText(valor); setFeito(true); setTimeout(() => setFeito(false), 1500) }
            catch { toast.error('Não foi possível copiar.') }
          }}
          aria-label={`Copiar ${rotulo}`}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          {feito ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

export default function LigacoesMensagensPage() {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [erro, setErro] = useState(false)
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [token, setToken] = useState('')
  const [appSecret, setAppSecret] = useState('')
  const [aGravar, setAGravar] = useState(false)

  async function carregar() {
    try {
      const res = await fetch('/api/mensagens/whatsapp')
      if (!res.ok) throw new Error()
      const d = await res.json() as Estado
      setEstado(d)
      setPhoneNumberId(d.phone_number_id ?? '')
      setErro(false)
    } catch {
      setErro(true)
    }
  }

  useEffect(() => { const t = setTimeout(() => { carregar() }, 0); return () => clearTimeout(t) }, [])

  async function ligar(e: React.FormEvent) {
    e.preventDefault()
    setAGravar(true)
    let d: (Estado & { error?: string }) | null = null
    try {
      const res = await fetch('/api/mensagens/whatsapp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number_id: phoneNumberId, token, app_secret: appSecret }),
      })
      d = await res.json().catch(() => null)
      if (!res.ok || !d) { toast.error(d?.error ?? 'Não foi possível ligar o número.'); return }
    } catch {
      toast.error('Sem ligação. Verifica a internet e tenta outra vez.')
      return
    } finally {
      setAGravar(false)
    }
    setEstado(d); setToken(''); setAppSecret('')
    toast.success('Número ligado. Falta o último passo na Meta: o webhook.')
  }

  async function desligar() {
    if (!window.confirm('Desligar o número? As mensagens já recebidas ficam no histórico.')) return
    if (!await eliminar('/api/mensagens/whatsapp', { mensagemDeErro: 'Não foi possível desligar.' })) return
    toast.success('Número desligado')
    carregar()
  }

  const campo = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm'

  return (
    <div className="flex flex-col min-h-full pb-10">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-4 py-4 border-b border-border flex items-center gap-3">
        <Link href="/mensagens" aria-label="Voltar às mensagens" className="p-1 -ml-1 rounded-lg text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Canais de mensagens</h1>
      </header>

      {erro ? <ErroAoCarregar oQue="as ligações" aoTentar={carregar} /> : !estado ? (
        <div className="p-4 space-y-3 animate-pulse">{[0, 1].map(i => <div key={i} className="h-32 rounded-2xl bg-muted" />)}</div>
      ) : (
        <div className="p-4 max-w-2xl flex flex-col gap-6">
          <section className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-2">
            <h2 className="flex items-center gap-2 font-semibold"><Mail className="h-4 w-4" aria-hidden /> Email</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Os emails saem em nome do teu alojamento. {estado.rececaoEmail
                ? 'As respostas dos hóspedes voltam sozinhas à conversa certa.'
                : 'Por agora as respostas dos hóspedes chegam ao teu email; podes colá-las na conversa com «Registar».'}
            </p>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-semibold"><MessageCircle className="h-4 w-4" aria-hidden /> WhatsApp</h2>
              {estado.ligado && <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-full px-2 py-0.5">Ligado{estado.numero_exibido ? ` · ${estado.numero_exibido}` : ''}</span>}
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Sem ligar nada, «Enviar» abre o WhatsApp do teu telemóvel com a mensagem já escrita e guarda-a aqui.
              Ligando um número <strong>WhatsApp Business</strong> (Cloud API da Meta), as mensagens saem daqui
              e as dos hóspedes entram sozinhas na conversa da reserva.
            </p>

            {estado.ligado && estado.verify_token && (
              <div className="flex flex-col gap-3 rounded-xl bg-muted/40 p-3">
                <p className="text-sm font-medium">Último passo, na app da Meta → WhatsApp → Configuração → Webhook:</p>
                <Copiar rotulo="URL de retorno (Callback URL)" valor={estado.webhook} />
                <Copiar rotulo="Token de verificação (Verify token)" valor={estado.verify_token} />
                <p className="text-xs text-muted-foreground">Depois subscreve o campo <code>messages</code>.</p>
              </div>
            )}

            {!estado.cifraDisponivel ? (
              <p className="text-sm text-destructive">A cifra de segredos não está configurada no servidor — não é possível ligar um número.</p>
            ) : (
              <form onSubmit={ligar} className="flex flex-col gap-3">
                <details className="text-sm text-muted-foreground">
                  <summary className="cursor-pointer font-medium text-foreground">Onde encontro estes dados?</summary>
                  <ol className="list-decimal pl-5 mt-2 space-y-1 leading-relaxed">
                    <li>Em developers.facebook.com cria uma app do tipo «Empresa» e junta-lhe o produto WhatsApp.</li>
                    <li>Em WhatsApp → Configuração da API, adiciona o teu número e copia o <strong>Phone number ID</strong>.</li>
                    <li>No Business Manager cria um utilizador de sistema com permissão <code>whatsapp_business_messaging</code> e gera um <strong>token permanente</strong>.</li>
                    <li>Em Definições da app → Básico, copia a <strong>Chave secreta da app</strong> (App secret).</li>
                  </ol>
                </details>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">Phone number ID</span>
                  <input className={campo} value={phoneNumberId} onChange={e => setPhoneNumberId(e.target.value)} inputMode="numeric" required />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">Token de acesso permanente</span>
                  <input className={campo} value={token} onChange={e => setToken(e.target.value)} type="password" autoComplete="off" required
                    placeholder={estado.ligado ? 'Guardado — escreve só para trocar' : undefined} />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">App secret</span>
                  <input className={campo} value={appSecret} onChange={e => setAppSecret(e.target.value)} type="password" autoComplete="off" required
                    placeholder={estado.ligado ? 'Guardado — escreve só para trocar' : undefined} />
                </label>
                <p className="text-xs text-muted-foreground">Ficam cifrados; nunca voltam a aparecer neste ecrã.</p>
                <div className="flex items-center gap-2">
                  <button type="submit" disabled={aGravar}
                    className="rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
                    {aGravar ? 'A confirmar com a Meta…' : estado.ligado ? 'Atualizar ligação' : 'Ligar número'}
                  </button>
                  {estado.ligado && (
                    <button type="button" onClick={desligar} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">Desligar</button>
                  )}
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
