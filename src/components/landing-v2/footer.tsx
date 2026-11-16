import Link from 'next/link'
import { Lock } from 'lucide-react'
import { Marca } from '@/components/marca'
import { CONCORRENTES } from '@/lib/comparacoes'

/**
 * Só destinos que existem e são públicos. As âncoras são absolutas (`/#...`)
 * porque o rodapé também aparece nas páginas legais, onde um `#precos` isolado
 * não levaria a lado nenhum. `/blog` e `/ajuda` continuam de fora até existirem.
 *
 * ⚠️ A coluna Legal está retirada de propósito: `/termos` e `/privacidade`
 * existem mas são rascunhos com campos [POR PREENCHER] e aviso de revisão.
 * Ligá-las do rodapé publicaria documentos legais por terminar. Repor este
 * bloco assim que estiverem revistas:
 *
 *   { titulo: 'Legal', links: [
 *       { label: 'Termos', href: '/termos' },
 *       { label: 'Privacidade', href: '/privacidade' },
 *       { label: 'Cookies', href: '/cookies' },
 *   ] },
 */
const COLUNAS = [
  {
    titulo: 'Produto',
    links: [
      { label: 'Plataforma', href: '/#plataforma' },
      { label: 'Dossiê de conformidade', href: '/#prova' },
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
    titulo: 'Apoio',
    links: [{ label: 'suporte@anfitrioes.pt', href: 'mailto:suporte@anfitrioes.pt' }],
  },
]

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
          <div>
            <Link href="/" aria-label="Anfitrião, início" className="inline-flex rounded-lg">
              <Marca />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Gestão de Alojamento Local feita em Portugal, para a lei portuguesa.
            </p>
            {/* Redes sociais removidas: apontavam para a homepage do LinkedIn
                e do X, não para perfis do Anfitrião. Repor quando existirem
                (os ícones SVG estão no histórico do git). */}
          </div>

          <nav aria-label="Rodapé" className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {COLUNAS.map((coluna) => (
              <div key={coluna.titulo}>
                <h2 className="text-sm font-semibold text-foreground">{coluna.titulo}</h2>
                <ul className="mt-3 space-y-1.5">
                  {coluna.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="inline-flex min-h-6 items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
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
        <nav aria-labelledby="footer-comparacoes" className="mt-14 border-t border-border pt-8">
          <h2 id="footer-comparacoes" className="text-sm font-semibold text-foreground">
            Anfitrião comparado
          </h2>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5">
            {CONCORRENTES.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/vs/${c.slug}`}
                  className="inline-flex min-h-6 items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Anfitrião vs {c.nome}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-12 flex flex-col gap-5 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Anfitrião. Todos os direitos reservados.
          </p>
          <ul className="flex flex-wrap gap-4">
            <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="size-3.5 text-primary" aria-hidden />
              Ligação encriptada
            </li>
          </ul>
        </div>
      </div>
    </footer>
  )
}
