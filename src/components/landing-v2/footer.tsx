import Link from 'next/link'
import { Home, Lock } from 'lucide-react'
import { CONCORRENTES } from '@/lib/comparacoes'

/**
 * Só destinos que existem e são públicos. As âncoras são absolutas (`/#...`)
 * porque o rodapé também aparece nas páginas legais, onde um `#precos` isolado
 * não levaria a lado nenhum. `/blog` e `/ajuda` continuam de fora até existirem.
 */
const COLUNAS = [
  {
    titulo: 'Produto',
    links: [
      { label: 'Plataforma', href: '/#plataforma' },
      { label: 'Funcionalidades', href: '/#funcionalidades' },
      { label: 'Preços', href: '/#precos' },
    ],
  },
  {
    titulo: 'Conta',
    links: [
      { label: 'Entrar', href: '/sign-in' },
      { label: 'Criar conta', href: '/sign-up' },
    ],
  },
  {
    titulo: 'Legal',
    links: [
      { label: 'Termos', href: '/termos' },
      { label: 'Privacidade', href: '/privacidade' },
      { label: 'Cookies', href: '/cookies' },
    ],
  },
  {
    titulo: 'Apoio',
    links: [{ label: 'suporte@anfitrioes.pt', href: 'mailto:suporte@anfitrioes.pt' }],
  },
]

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-slate-950">
      <div className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
          <div>
            <Link
              href="/"
              className="flex items-center gap-2 text-lg font-bold tracking-tight text-white"
            >
              <span className="grid size-8 place-items-center rounded-xl bg-cyan-500/15 ring-1 ring-cyan-500/30">
                <Home className="size-4 text-cyan-400" aria-hidden />
              </span>
              Anfitri<span className="-ml-[0.5ch] text-cyan-400">ão</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
              Plataforma de anfitriões, para anfitriões.
            </p>
            {/* Redes sociais removidas: apontavam para a homepage do LinkedIn
                e do X, não para perfis do Anfitrião. Repor quando existirem
                (os ícones SVG estão no histórico do git). */}
          </div>

          <nav aria-label="Rodapé" className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {COLUNAS.map((coluna) => (
              <div key={coluna.titulo}>
                <h2 className="text-sm font-semibold text-white">{coluna.titulo}</h2>
                <ul className="mt-4 space-y-3">
                  {coluna.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-slate-400 transition-colors hover:text-cyan-400"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          {/* Newsletter retirada: o formulário confirmava uma subscrição que
              não chegava a acontecer (sem endpoint). Repor quando existir. */}
        </div>

        {/* Páginas de comparação — tráfego de alta intenção, herdadas da landing anterior */}
        <nav aria-labelledby="footer-comparacoes" className="mt-14 border-t border-white/10 pt-8">
          <h2 id="footer-comparacoes" className="text-sm font-semibold text-white">
            Anfitrião comparado
          </h2>
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
            {CONCORRENTES.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/vs/${c.slug}`}
                  className="text-sm text-slate-400 transition-colors hover:text-cyan-400"
                >
                  Anfitrião vs {c.nome}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-12 flex flex-col gap-5 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} Anfitrião. Todos os direitos reservados.
          </p>
          <ul className="flex flex-wrap gap-4">
            <li className="flex items-center gap-1.5 text-xs text-slate-400">
              <Lock className="size-3.5 text-emerald-400" aria-hidden />
              Ligação encriptada
            </li>
          </ul>
        </div>
      </div>
    </footer>
  )
}
