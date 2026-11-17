'use client'

import { useMemo } from 'react'
import { codigoDePais, listaPaises, nomePais, type LinguaPaises } from '@/lib/paises'

/**
 * Seletor de país (check-in e fichas do hóspede). Mostra os nomes na língua
 * pedida e grava o nome em português — é a forma que o resto da aplicação já lê (relatório do INE,
 * CSV do SIBA, país da fatura no InvoiceXpress) e que `codigoPais` traduz para
 * o código do boletim.
 *
 * Um valor antigo que não corresponde a país nenhum continua visível como
 * opção, para não se perder em silêncio ao abrir a página.
 *
 * Os países de onde vem a maioria dos hóspedes em Portugal aparecem primeiro:
 * no telemóvel, descer 180 opções até «Portugal» ou «Reino Unido» é o passo
 * mais lento da ficha. A lista completa continua por baixo.
 */
export const PAISES_FREQUENTES = ['PRT', 'ESP', 'FRA', 'GBR', 'DEU', 'USA', 'BRA', 'NLD', 'ITA'] as const

const ROTULO_FREQUENTES = { pt: 'Mais frequentes', en: 'Most common' } as const
const ROTULO_TODOS = { pt: 'Todos os países', en: 'All countries' } as const
export function CampoPais({ id, valor, aoMudar, lingua = 'pt', rotuloVazio = 'Selecionar...', className, autoComplete }: {
  id: string
  valor: string
  aoMudar: (v: string) => void
  lingua?: LinguaPaises
  rotuloVazio?: string
  className: string
  autoComplete?: string
}) {
  const paises = useMemo(() => listaPaises(lingua), [lingua])
  const codigo = codigoDePais(valor)
  const atual = codigo ? nomePais(codigo, 'pt') : valor

  return (
    <select id={id} value={atual} autoComplete={autoComplete} className={className}
      onChange={e => aoMudar(e.target.value)}>
      <option value="">{rotuloVazio}</option>
      {valor && !codigo && <option value={valor}>{valor}</option>}
      <optgroup label={ROTULO_FREQUENTES[lingua]}>
        {PAISES_FREQUENTES.map(c => (
          <option key={`f-${c}`} value={nomePais(c, 'pt')}>{nomePais(c, lingua)}</option>
        ))}
      </optgroup>
      <optgroup label={ROTULO_TODOS[lingua]}>
        {paises.map(p => (
          <option key={p.codigo} value={nomePais(p.codigo, 'pt')}>{p.nome}</option>
        ))}
      </optgroup>
    </select>
  )
}
