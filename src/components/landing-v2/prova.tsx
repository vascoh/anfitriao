import Link from 'next/link'
import { FileCheck2, Fingerprint, ListChecks } from 'lucide-react'
import { ANTETITULO, BOTAO_SECUNDARIO, CONTENTOR, LEAD, SECCAO, TITULO_SECCAO } from './estilos'

/**
 * O posicionamento numa secção: «a tua conformidade, com prova».
 *
 * Decisão do Vasco a 2026-11-16 (horizonte 3 do plano de evolução). É a única
 * vantagem que resistiu às duas verificações de mercado: o preço por conta
 * caiu com o TalkGuest, e SIBA por web service já há noutros. O que ninguém
 * mostra é o registo de cada envio — e é isso que se põe em cima da mesa
 * quando toca a campainha.
 *
 * A miniatura reproduz a estrutura do dossiê real
 * (`app/(app)/conformidade/dossie/[propertyId]`, `lib/dossie-asae.ts`), com
 * dados **fictícios e assinalados como tal**: ainda não há envios reais para
 * mostrar. Quando houver, troca-se por uma captura anonimizada (H2.5). Não
 * escrever aqui nada que o dossiê real não faça.
 */

const PONTOS = [
  {
    icon: Fingerprint,
    titulo: 'Cada envio ao SIBA fica registado',
    texto: 'Número do ficheiro, resposta do serviço e o resumo SHA-256 do que foi enviado. «Comunicou?» passa a ter resposta, envio a envio.',
  },
  {
    icon: ListChecks,
    titulo: 'Cada obrigação com a base legal ao lado',
    texto: 'RNAL, seguro, livro de reclamações, certificado energético. O que está em dia e o que caduca a seguir.',
  },
  {
    icon: FileCheck2,
    titulo: 'Diz o que falta, não esconde',
    texto: 'Um dossiê só com verde, que os registos não sustentam, é pior do que não ter dossiê. Este mostra o que está por fazer e o que não consegue provar.',
  },
] as const

const OBRIGACOES = [
  { titulo: 'Número de registo (RNAL)', base: 'DL 128/2014', estado: 'Em dia' },
  { titulo: 'Seguro de responsabilidade civil', base: 'DL 128/2014, art. 13.º-A', estado: 'Caduca em 41 dias' },
  { titulo: 'Livro de Reclamações Eletrónico', base: 'DL 74/2017', estado: 'Em dia' },
] as const

const ENVIOS = [
  { data: '12/10, 18:42', ficheiro: 'n.º 1027', resultado: 'Aceite', hash: '9f2c4e1a7b…d81e03' },
  { data: '05/10, 21:15', ficheiro: 'n.º 1026', resultado: 'Aceite', hash: '3a7d0c95e2…4b6f1c' },
] as const

export function Prova() {
  return (
    <section id="prova" aria-labelledby="prova-titulo" className={`${SECCAO} scroll-mt-16`}>
      <div className={`${CONTENTOR} grid items-center gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16`}>
        <div className="reveal">
          <p className={ANTETITULO}>Dossiê de conformidade</p>
          <h2 id="prova-titulo" className={`mt-3 ${TITULO_SECCAO}`}>
            Numa inspeção, não basta dizer que comunicaste.
          </h2>
          <p className={`mt-4 ${LEAD}`}>
            O Anfitrião junta os teus registos num documento, pela ordem por que
            costumam ser pedidos. Imprimes ou guardas em PDF quando precisares.
          </p>

          <ul className="mt-8 space-y-6">
            {PONTOS.map(({ icon: Icon, titulo, texto }) => (
              <li key={titulo} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10">
                  <Icon className="size-5 text-primary" aria-hidden />
                </span>
                <div>
                  <h3 className="font-semibold text-foreground">{titulo}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{texto}</p>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-8 text-sm leading-relaxed text-muted-foreground">
            O dossiê é gerado por ti a partir dos teus registos. Não é emitido nem
            validado por nenhuma entidade oficial, e diz isso na primeira linha.
          </p>
          <Link href="/sign-up" className={`${BOTAO_SECUNDARIO} mt-6 h-12 px-6`}>
            Experimentar grátis
          </Link>
        </div>

        {/* Miniatura do documento. Dados fictícios, e diz-se. */}
        <figure className="reveal">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7" aria-hidden="true">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Dossiê de conformidade · Alojamento Local
            </p>
            <p className="mt-2 text-lg font-semibold text-foreground">Casa do Exemplo</p>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">RNAL 000000/AL · Período 01/10 a 31/10</p>

            <p className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-foreground">1 · Obrigações legais</p>
            <ul className="mt-2 divide-y divide-border text-xs">
              {OBRIGACOES.map((o) => (
                <li key={o.titulo} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="font-medium text-foreground">{o.titulo}</span>
                    <span className="block text-[11px] text-muted-foreground">{o.base}</span>
                  </span>
                  <span className={`shrink-0 font-semibold ${o.estado === 'Em dia' ? 'text-sucesso' : 'text-aviso'}`}>{o.estado}</span>
                </li>
              ))}
            </ul>

            <p className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-foreground">2 · Comunicação de hóspedes (SIBA)</p>
            <dl className="mt-2 grid grid-cols-4 gap-2 text-center">
              {[
                ['Estadias', '9'],
                ['Comunicadas', '9'],
                ['Por comunicar', '0'],
                ['Em atraso', '0'],
              ].map(([rotulo, valor]) => (
                <div key={rotulo} className="rounded-lg bg-muted/60 px-1 py-2">
                  <dt className="text-[10px] leading-tight text-muted-foreground">{rotulo}</dt>
                  <dd className="mt-0.5 text-base font-semibold text-foreground tabular-nums">{valor}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-foreground">3 · Registos de envio ao SIBA</p>
            <ul className="mt-2 divide-y divide-border text-xs">
              {ENVIOS.map((e) => (
                <li key={e.ficheiro} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2">
                  <span className="tabular-nums text-muted-foreground">{e.data}</span>
                  <span className="text-foreground">{e.ficheiro}</span>
                  <span className="font-semibold text-sucesso">{e.resultado}</span>
                  <span className="w-full truncate font-mono text-[10px] text-muted-foreground sm:ml-auto sm:w-auto">SHA-256 {e.hash}</span>
                </li>
              ))}
            </ul>

            <p className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-foreground">4 · O que este documento não prova</p>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Diz o que foi comunicado, não quem estava obrigado a sê-lo.
            </p>
          </div>
          <figcaption className="mt-3 text-center text-xs text-muted-foreground">
            Exemplo com dados fictícios. O dossiê real usa os registos da tua conta.
          </figcaption>
        </figure>
      </div>
    </section>
  )
}
