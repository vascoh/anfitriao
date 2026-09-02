import { auth } from '@clerk/nextjs/server'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase'
import { carregarTudo } from '@/lib/supabase-tudo'
import { today, addDays, fmtDate } from '@/lib/utils'
import { montarDossie, type ReservaDossie, type SubmissaoDossie } from '@/lib/dossie-asae'
import type { EstadoItem } from '@/lib/compliance'
import { BotaoImprimir } from '../../cartaz/[propertyId]/botao-imprimir'

export const metadata: Metadata = {
  title: 'Dossiê de conformidade',
  robots: { index: false, follow: false },
}

/* A leitura das reservas de um ano pode passar as mil linhas que o PostgREST
 * devolve sem avisar, e um dossiê a que faltam estadias conta uma história
 * errada com ar de completa. */
export const maxDuration = 30

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/

const ROTULO: Record<EstadoItem, string> = {
  ok: 'Em dia',
  a_expirar: 'A expirar',
  expirado: 'Expirado',
  em_falta: 'Em falta',
}

function dataHora(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })
}

/**
 * Dossiê de conformidade para inspeção, pronto a imprimir.
 *
 * Sem biblioteca de PDF, pela mesma decisão do cartaz do Livro de Reclamações:
 * é uma página com CSS de impressão e usa-se «Imprimir → Guardar como PDF» do
 * browser. Evita uma dependência binária nova para um ganho marginal.
 *
 * O que o documento diz e o que **não** diz está em `lib/dossie-asae.ts`. O
 * resumo: é uma compilação dos registos do próprio anfitrião, diz isso na
 * primeira linha, e mostra o que está por cumprir em vez de o esconder.
 */
export default async function DossiePage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>
  searchParams: Promise<{ de?: string; ate?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { propertyId } = await params
  const q = await searchParams
  const supabase = createAdminClient()

  const hoje = today()
  // Um ano é o período que uma inspeção costuma cobrir, e é o que se assume
  // quando ninguém escolhe outro.
  const ate = q.ate && DATA_RE.test(q.ate) ? q.ate : hoje
  const de = q.de && DATA_RE.test(q.de) ? q.de : addDays(ate, -365)

  const { data: p } = await supabase
    .from('properties')
    .select('nome, endereco, cidade, owner_id, rnal_numero, rnal_data, seguro_seguradora, seguro_apolice, seguro_validade, livro_reclamacoes_registado, certificado_energetico_validade, siba_nipc, siba_estabelecimento')
    .eq('id', propertyId)
    .maybeSingle()

  if (!p) notFound()
  if (p.owner_id !== null && p.owner_id !== userId) notFound()

  /* As duas leituras paginadas: um dossiê incompleto é pior do que nenhum,
   * porque não se nota que lhe falta alguma coisa. Ambas presas ao `owner_id`
   * além do alojamento — o `propertyId` sozinho já foi verificado acima, mas
   * a defesa em profundidade custa uma cláusula. */
  const [reservas, submissoes] = await Promise.all([
    carregarTudo<ReservaDossie>(() =>
      supabase
        .from('bookings')
        .select('id, check_in, check_out, num_hospedes, estado, siba_status, siba_submitted_at, siba_reference, siba_error, siba_metodo')
        .eq('propriedade_id', propertyId)
        .eq('owner_id', userId)
        .gte('check_in', de)
        .lte('check_in', ate)
        .order('check_in', { ascending: true })
        .order('id', { ascending: true }),
    ),
    carregarTudo<SubmissaoDossie>(() =>
      supabase
        .from('siba_submissoes')
        .select('numero_ficheiro, hash_envio, sucesso, codigo_retorno, mensagem, booking_ids, tentativas, criado_em')
        .eq('property_id', propertyId)
        .eq('owner_id', userId)
        /* Só o limite de baixo: quem recorta o período com precisão é
         * `montarDossie`, e é lá que isso está testado. Aqui corta-se o
         * grosso — os anos anteriores — sem arriscar que as duas regras
         * discordem numa fronteira. */
        .gte('criado_em', de)
        .order('criado_em', { ascending: false })
        .order('numero_ficheiro', { ascending: true }),
    ),
  ])

  /* Uma leitura falhada não vira um dossiê com menos linhas: quem o imprime
   * não tem como saber que lhe falta metade, e é a completude que dá valor ao
   * documento. */
  if (reservas.erro || submissoes.erro) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight">Dossiê de conformidade</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Não foi possível ler os registos completos deste alojamento, e um dossiê a que
          faltem estadias não serve para o que existe. Tenta outra vez daqui a pouco.
        </p>
      </div>
    )
  }

  const d = montarDossie({
    estabelecimento: p,
    reservas: reservas.linhas,
    submissoes: submissoes.linhas,
    de, ate, hoje,
    emitidoEm: new Date().toISOString(),
  })

  const semCumprir = d.comunicacao.porComunicar + d.comunicacao.falhadas

  return (
    <>
      <div className="mx-auto max-w-4xl print:hidden">
        <h1 className="text-2xl font-bold tracking-tight">Dossiê de conformidade</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Os teus registos deste alojamento, pela ordem por que costumam ser pedidos numa
          inspeção. Para guardar em PDF, escolhe &laquo;Guardar como PDF&raquo; no destino
          de impressão.
        </p>
        <BotaoImprimir />
      </div>

      <article className="mx-auto mt-8 max-w-4xl rounded-2xl border border-border bg-white p-10 text-black shadow-sm print:mt-0 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        {/* ── Cabeçalho ──────────────────────────────────────────── */}
        <header className="border-b border-neutral-300 pb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Dossiê de conformidade · Alojamento Local
          </p>
          <h2 className="mt-3 text-2xl font-bold leading-tight">{p.nome}</h2>

          <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1.5 text-[13px] sm:grid-cols-3">
            {p.endereco && <Par termo="Morada" valor={`${p.endereco}${p.cidade ? `, ${p.cidade}` : ''}`} />}
            <Par termo="Registo (RNAL)" valor={p.rnal_numero || 'Não registado na aplicação'} />
            {p.siba_nipc && (
              <Par
                termo="Unidade SIBA"
                valor={`NIPC ${p.siba_nipc}${p.siba_estabelecimento ? ` · estab. ${p.siba_estabelecimento}` : ''}`}
              />
            )}
            <Par termo="Período" valor={`${fmtDate(de, { dateStyle: 'short' })} a ${fmtDate(ate, { dateStyle: 'short' })}`} />
            <Par termo="Emitido em" valor={dataHora(d.emitidoEm)} />
          </dl>

          <p className="mt-4 rounded-lg bg-neutral-100 px-3 py-2 text-[11px] leading-relaxed text-neutral-600">
            Documento gerado pelo titular a partir dos seus próprios registos.
            <strong className="font-semibold"> Não é emitido, validado nem reconhecido por nenhuma entidade oficial.</strong>
          </p>
        </header>

        {/* ── 1. Obrigações ──────────────────────────────────────── */}
        <Seccao numero="1" titulo="Obrigações legais">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-neutral-300 text-left text-[11px] uppercase tracking-wider text-neutral-500">
                <th className="pb-2 font-semibold">Obrigação</th>
                <th className="pb-2 font-semibold">Base legal</th>
                <th className="pb-2 font-semibold">Situação</th>
              </tr>
            </thead>
            <tbody>
              {d.conformidade.map(item => (
                <tr key={item.chave} className="border-b border-neutral-200 align-top">
                  <td className="py-2.5 pr-4">
                    <span className="font-semibold">{item.titulo}</span>
                    {!item.obrigatorio && (
                      <span className="ml-1.5 text-[11px] text-neutral-500">(facultativo)</span>
                    )}
                    <span className="mt-0.5 block text-[12px] text-neutral-600">{item.detalhe}</span>
                  </td>
                  <td className="py-2.5 pr-4 text-[12px] text-neutral-600">{item.base}</td>
                  <td className="py-2.5 whitespace-nowrap font-semibold">{ROTULO[item.estado]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Seccao>

        {/* ── 2. Comunicação de hóspedes ─────────────────────────── */}
        <Seccao numero="2" titulo="Comunicação de hóspedes (SIBA)">
          <div className="mb-4 flex flex-wrap gap-x-8 gap-y-2 text-[13px]">
            <Numero rotulo="Estadias no período" valor={d.comunicacao.reservas} />
            <Numero rotulo="Comunicadas" valor={d.comunicacao.comunicadas} />
            <Numero rotulo="Por comunicar" valor={d.comunicacao.porComunicar} />
            <Numero rotulo="Falhadas" valor={d.comunicacao.falhadas} />
            <Numero rotulo="Em atraso" valor={d.comunicacao.emAtraso} />
          </div>

          {d.linhas.length === 0 ? (
            <p className="text-[13px] text-neutral-600">Sem estadias registadas neste período.</p>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-neutral-300 text-left text-[11px] uppercase tracking-wider text-neutral-500">
                  <th className="pb-2 font-semibold">Entrada</th>
                  <th className="pb-2 font-semibold">Saída</th>
                  <th className="pb-2 font-semibold">Pessoas</th>
                  <th className="pb-2 font-semibold">Comunicação</th>
                </tr>
              </thead>
              <tbody>
                {d.linhas.map(l => (
                  <tr key={l.bookingId} className="border-b border-neutral-200">
                    <td className="py-1.5 whitespace-nowrap">{fmtDate(l.check_in, { dateStyle: 'short' })}</td>
                    <td className="py-1.5 whitespace-nowrap">
                      {l.check_out ? fmtDate(l.check_out, { dateStyle: 'short' }) : '—'}
                    </td>
                    <td className="py-1.5">{l.pessoas}</td>
                    <td className="py-1.5">
                      <span className="font-semibold">{l.estado}</span>
                      {l.emAtraso && <span className="ml-1.5 font-semibold">· fora de prazo</span>}
                      {l.detalhe && <span className="block text-[11px] text-neutral-600">{l.detalhe}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Seccao>

        {/* ── 3. Prova de envio ──────────────────────────────────── */}
        <Seccao numero="3" titulo="Registos de envio ao SIBA">
          <p className="mb-3 text-[12px] leading-relaxed text-neutral-600">
            Cada envio ficou registado com o resumo criptográfico (SHA-256) do conteúdo
            enviado e a resposta do serviço. Os envios que falharam constam também — é o que
            distingue ter tentado de não ter tentado.
          </p>

          {d.submissoes.length === 0 ? (
            <p className="text-[13px] text-neutral-600">
              Sem registos de envio por esta aplicação neste período.
            </p>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-neutral-300 text-left text-[11px] uppercase tracking-wider text-neutral-500">
                  <th className="pb-2 font-semibold">Data</th>
                  <th className="pb-2 font-semibold">Ficheiro</th>
                  <th className="pb-2 font-semibold">Boletins</th>
                  <th className="pb-2 font-semibold">Resultado</th>
                  <th className="pb-2 font-semibold">SHA-256 do enviado</th>
                </tr>
              </thead>
              <tbody>
                {d.submissoes.map(s => (
                  <tr key={`${s.numero_ficheiro}-${s.criado_em}`} className="border-b border-neutral-200 align-top">
                    <td className="py-1.5 whitespace-nowrap">{dataHora(s.criado_em)}</td>
                    <td className="py-1.5">n.º {s.numero_ficheiro}</td>
                    <td className="py-1.5">{s.booking_ids?.length ?? 0}</td>
                    <td className="py-1.5">
                      <span className="font-semibold">{s.sucesso ? 'Aceite' : 'Recusado'}</span>
                      {s.codigo_retorno && (
                        <span className="block text-[11px] text-neutral-600">código {s.codigo_retorno}</span>
                      )}
                      {s.mensagem && <span className="block text-[11px] text-neutral-600">{s.mensagem}</span>}
                    </td>
                    <td className="py-1.5 font-mono text-[10px] break-all text-neutral-600">{s.hash_envio}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Seccao>

        {/* ── 4. Limitações ──────────────────────────────────────── */}
        <Seccao numero="4" titulo="O que este documento não prova">
          <ul className="space-y-1.5 text-[12px] leading-relaxed text-neutral-700">
            {d.limitacoes.map((nota, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden="true">—</span>
                <span>{nota}</span>
              </li>
            ))}
          </ul>
        </Seccao>

        <footer className="mt-8 border-t border-neutral-300 pt-4 text-[10px] leading-relaxed text-neutral-500">
          {d.resumoConformidade.criticos > 0 || semCumprir > 0 ? (
            <p>
              À data de emissão há {d.resumoConformidade.criticos > 0
                ? `${d.resumoConformidade.criticos} ${d.resumoConformidade.criticos === 1 ? 'obrigação' : 'obrigações'} por cumprir`
                : ''}
              {d.resumoConformidade.criticos > 0 && semCumprir > 0 ? ' e ' : ''}
              {semCumprir > 0
                ? `${semCumprir} ${semCumprir === 1 ? 'estadia' : 'estadias'} sem comunicação entregue`
                : ''}
              . Ver as secções 1 e 2.
            </p>
          ) : (
            <p>
              À data de emissão não há obrigações por cumprir nem estadias sem comunicação
              entregue, de acordo com os registos desta aplicação.
            </p>
          )}
          <p className="mt-1">
            Gerado por anfitrioes.pt. As referências legais são indicativas e não constituem
            aconselhamento jurídico.
          </p>
        </footer>
      </article>
    </>
  )
}

function Par({ termo, valor }: { termo: string; valor: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-neutral-500">{termo}</dt>
      <dd className="font-medium">{valor}</dd>
    </div>
  )
}

function Numero({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div>
      <span className="block text-[11px] uppercase tracking-wider text-neutral-500">{rotulo}</span>
      <span className="text-lg font-bold">{valor}</span>
    </div>
  )
}

function Seccao({ numero, titulo, children }: { numero: string; titulo: string; children: React.ReactNode }) {
  // `break-inside-avoid` mantém cada secção inteira numa página sempre que
  // couber: uma tabela de prova cortada a meio lê-se como se faltasse.
  return (
    <section className="mt-8 print:break-inside-avoid">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wider">
        <span className="text-neutral-400">{numero}.</span> {titulo}
      </h3>
      {children}
    </section>
  )
}
