import { Calendar, ShieldCheck, FileText, TrendingUp, type LucideIcon } from 'lucide-react'
import { ANTETITULO, CARTAO, CONTENTOR, FAIXA, LEAD, SECCAO, TITULO_SECCAO } from './estilos'

type Feature = {
  icon: LucideIcon
  titulo: string
  descricao: string
}

/**
 * Regra desta lista: **só entra o que já está no produto hoje**.
 *
 * Uma funcionalidade prometida aqui e ausente lá dentro custa mais do que
 * ganha — converte pior (quem conhece o mercado deteta) e churna muito pior
 * (quem assina descobre). Se for preciso escrever "em breve", não entra.
 */
const FEATURES: Feature[] = [
  {
    icon: Calendar,
    titulo: 'Calendário unificado',
    descricao: 'Airbnb, Booking e Vrbo no mesmo calendário, sincronizados de 15 em 15 minutos. Ou à mão, quando não podes esperar.',
  },
  {
    icon: ShieldCheck,
    titulo: 'Conformidade portuguesa',
    descricao: 'Boletins do SIBA prontos a entregar, taxa turística calculada por concelho, mapa do INE e alertas de seguro e RNAL.',
  },
  {
    icon: FileText,
    titulo: 'Check-in online',
    descricao: 'O hóspede preenche os dados do documento antes de chegar, em português ou inglês. Chega com o boletim já feito.',
  },
  {
    icon: TrendingUp,
    titulo: 'Receita e despesas',
    descricao: 'Ocupação, RevPAR, comissões retidas pelas plataformas e lucro líquido por alojamento.',
  },
]

export function Features() {
  return (
    <section id="funcionalidades" className={`${SECCAO} ${FAIXA} scroll-mt-16`}>
      <div className={CONTENTOR}>
        <div className="reveal max-w-2xl">
          <p className={ANTETITULO}>Funcionalidades</p>
          <h2 className={`mt-3 ${TITULO_SECCAO}`}>O essencial, sem a papelada</h2>
          <p className={`mt-4 ${LEAD}`}>
            Quatro ferramentas que substituem meia dúzia de separadores abertos.
          </p>
        </div>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, titulo, descricao }) => (
            <li key={titulo} className={`reveal lift ${CARTAO} p-6`}>
              <span className="grid size-11 place-items-center rounded-xl bg-primary/10">
                <Icon className="size-5 text-primary" aria-hidden />
              </span>
              <h3 className="mt-5 text-base font-semibold text-foreground">{titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{descricao}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
