/**
 * Comparação de nomes de pessoas.
 *
 * Serve para reconhecer alguém que já foi registado quando não há id para o
 * provar — o caso do formulário de check-in reenviado, em que a mesma pessoa
 * voltava a ser criada e o SIBA levava dois boletins para o mesmo hóspede.
 *
 * Deliberadamente tolerante ao que muda entre dois preenchimentos do mesmo
 * nome (acentos, maiúsculas, espaços a mais) e cega a tudo o resto: "Ana
 * Silva" e "Ana Sousa" continuam duas pessoas.
 */

/** Remove acentos: "João" → "joao". */
export function semAcentos(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Forma comparável de um nome. Nunca lança; texto vazio dá string vazia. */
export function chaveDeNome(nome: unknown): string {
  if (typeof nome !== 'string') return ''
  return semAcentos(nome).toLowerCase().replace(/\s+/g, ' ').trim()
}
