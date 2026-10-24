import Link from 'next/link'
import Image from 'next/image'
import { BedDouble, Home, Users } from 'lucide-react'
import { fmtMoney } from '@/lib/utils'
import type { SiteLang } from '@/lib/i18n'
import { tr } from '@/lib/i18n-reserva'

export interface DadosCartao {
  id: string
  nome: string
  cidade?: string
  capacidade: number
  quartos: number
  preco: number
  /** O preço é o mais baixo de vários quartos. */
  desde?: boolean
  foto?: string | null
  cor: string
  numFotos: number
}

/** Fotografia do alojamento em primeiro plano; sem ela, a cor e o nome. */
export function CartaoAlojamento({ a, href, lang, grande }: { a: DadosCartao; href: string; lang: SiteLang; grande?: boolean }) {
  return (
    <Link href={href} className="group flex flex-col gap-3 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background">
      {/* Sem fotografia, o cartão grande encolhe: um bloco vazio do tamanho de uma foto de capa pesa mais do que diz. */}
      <div className={`relative overflow-hidden rounded-2xl bg-muted ${grande ? (a.foto ? 'aspect-[16/10]' : 'aspect-[16/5]') : 'aspect-[4/3]'}`}>
        {a.foto ? (
          <Image src={a.foto} alt={a.nome} fill
            sizes={grande ? '(max-width: 768px) 100vw, 960px' : '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px'}
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04] motion-reduce:transition-none" />
        ) : (
          <div aria-hidden className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: `${a.cor}1a` }}>
            {a.desde
              ? <Home className="h-10 w-10 opacity-70" strokeWidth={1.5} style={{ color: a.cor }} />
              : <BedDouble className="h-10 w-10 opacity-70" strokeWidth={1.5} style={{ color: a.cor }} />}
          </div>
        )}
        {a.numFotos > 1 && (
          <span className="site-num absolute bottom-3 right-3 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
            {a.numFotos} {lang === 'en' ? 'photos' : 'fotos'}
          </span>
        )}
      </div>
      <div className="flex items-start justify-between gap-4 px-0.5">
        <div className="min-w-0">
          <p className={`site-titulo truncate font-semibold ${grande ? 'text-xl' : 'text-base'}`}>{a.nome}</p>
          <p className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden />{a.capacidade}</span>
            {a.quartos > 0 && <span className="inline-flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" aria-hidden />{a.quartos}</span>}
            {a.cidade && <span className="truncate">{a.cidade}</span>}
          </p>
        </div>
        <p className="shrink-0 text-right text-xs text-muted-foreground">
          {a.desde && <span className="block">{tr(lang, 'desde')}</span>}
          <span className="site-num text-base font-semibold text-foreground">{fmtMoney(a.preco)}</span> / {tr(lang, 'noite')}
        </p>
      </div>
    </Link>
  )
}
