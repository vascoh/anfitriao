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
 */
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
      {paises.map(p => (
        <option key={p.codigo} value={nomePais(p.codigo, 'pt')}>{p.nome}</option>
      ))}
    </select>
  )
}
