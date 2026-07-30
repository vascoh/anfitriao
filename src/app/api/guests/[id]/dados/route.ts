import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import { exportarDadosHospede, anonimizarHospede } from '@/lib/retencao-server'
import { TODOS_OS_GRUPOS } from '@/lib/retencao'

const supabase = createAdminClient()

/**
 * Direitos do titular sobre os dados de um hóspede (RGPD art. 15.º, 17.º e 20.º).
 *
 * Quem exerce o direito é o hóspede, mas quem responde perante ele é o
 * anfitrião — é o responsável pelo tratamento (a plataforma é subcontratante,
 * ver /privacidade). Por isso estas rotas exigem sessão do anfitrião e só
 * atuam sobre hóspedes da conta dele; não há aqui nenhum acesso público.
 */

/** GET — exporta tudo o que temos sobre o hóspede, em JSON (art. 15.º e 20.º). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const { dados, error } = await exportarDadosHospede(id, userId)

  if (error === 'nao_encontrado') {
    return NextResponse.json({ error: 'Hóspede não encontrado.' }, { status: 404 })
  }
  if (error || !dados) {
    return NextResponse.json({ error: 'Erro ao exportar dados.' }, { status: 500 })
  }

  // Ficheiro, não corpo de página: o anfitrião reencaminha-o ao hóspede.
  return new NextResponse(JSON.stringify(dados, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="dados-hospede-${id}.json"`,
    },
  })
}

/**
 * DELETE — apaga os dados pessoais a pedido do titular (art. 17.º).
 *
 * Anonimiza em vez de eliminar a linha: a reserva tem de ser conservada por
 * obrigação fiscal (10 anos, art. 52.º do CIVA), e o art. 17.º n.º 3 al. b
 * ressalva precisamente o que a lei obriga a conservar. Ficam os valores e as
 * datas; sai tudo o que identifica a pessoa.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params

  const { data: hospede } = await supabase
    .from('guests')
    .select('id, anonimizado_grupos')
    .eq('id', id)
    .eq('owner_id', userId)
    .maybeSingle()

  if (!hospede) {
    return NextResponse.json({ error: 'Hóspede não encontrado.' }, { status: 404 })
  }

  const res = await anonimizarHospede({
    guestId: id,
    grupos: TODOS_OS_GRUPOS,
    jaFeitos: hospede.anonimizado_grupos,
    actorId: userId,
    motivo: 'pedido_do_titular',
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Erro ao apagar os dados.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
