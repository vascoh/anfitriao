'use client'

import { useState } from 'react'
import { Monitor, Smartphone, RefreshCw, ExternalLink, EyeOff } from 'lucide-react'

/**
 * Pré-visualização do site do anfitrião, ao lado do formulário.
 *
 * ## Porque é um iframe do site verdadeiro
 *
 * A alternativa — desenhar aqui uma imitação do site com os valores do
 * formulário — atualizaria a cada tecla, e mentiria no dia em que o site
 * mudasse e a imitação não. Este projeto já foi mordido três vezes por
 * previsões que não correspondiam ao produto (o mapa do INE, o aviso do SIBA,
 * a landing). Uma pré-visualização que mostra outra coisa é pior do que não
 * ter nenhuma, porque dá confiança em vez de a pedir.
 *
 * Por isso mostra-se a página real. O preço é não ver as alterações antes de
 * guardar — e a resposta a isso é dizê-lo, com o aviso de alterações por
 * guardar, em vez de fingir que já lá estão.
 */
export function WebsitePreview({
  url,
  activo,
  temSlug,
  porGuardar,
}: {
  url: string
  activo: boolean
  temSlug: boolean
  /** Há alterações no formulário que ainda não foram guardadas. */
  porGuardar: boolean
}) {
  const [dispositivo, setDispositivo] = useState<'telemovel' | 'computador'>('telemovel')
  const [versao, setVersao] = useState(0)

  const larguraTelemovel = dispositivo === 'telemovel'

  if (!temSlug) {
    return (
      <Moldura>
        <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
          <EyeOff className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium">Escolhe primeiro o endereço</p>
          <p className="text-xs text-muted-foreground">
            O site fica visível assim que definires o teu endereço aqui ao lado.
          </p>
        </div>
      </Moldura>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-lg border border-border p-0.5">
          {([
            ['telemovel', Smartphone, 'Telemóvel'],
            ['computador', Monitor, 'Computador'],
          ] as const).map(([valor, Icone, rotulo]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setDispositivo(valor)}
              aria-pressed={dispositivo === valor}
              title={rotulo}
              className={`rounded-md p-1.5 transition-colors ${
                dispositivo === valor ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icone className="h-3.5 w-3.5" />
              <span className="sr-only">{rotulo}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setVersao(v => v + 1)}
          className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </button>

        <div className="flex-1" />

        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-medium text-primary"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Abrir
        </a>
      </div>

      {porGuardar && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          Tens alterações por guardar — a pré-visualização mostra o site como está publicado.
        </p>
      )}

      {!activo && (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          O site está desativado: só tu o consegues ver.
        </p>
      )}

      <Moldura>
        <iframe
          key={`${versao}-${dispositivo}`}
          src={`${url}?pv=${versao}`}
          title="Pré-visualização do teu site"
          className={`h-full border-0 bg-white transition-all ${larguraTelemovel ? 'mx-auto w-[390px] max-w-full' : 'w-full'}`}
          loading="lazy"
        />
      </Moldura>
    </div>
  )
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-[70vh] min-h-[420px] overflow-hidden rounded-xl border border-border bg-muted/30">
      {children}
    </div>
  )
}
