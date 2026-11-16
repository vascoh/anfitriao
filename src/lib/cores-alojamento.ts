/**
 * Cores de identificação de um alojamento (calendário, listas, etiquetas).
 * O nome serve de rótulo acessível às amostras: um botão só com cor de fundo
 * não diz nada a um leitor de ecrã.
 */
export const CORES_ALOJAMENTO = [
  { hex: '#C2714F', nome: 'Terracota' },
  { hex: '#E07B39', nome: 'Laranja queimado' },
  { hex: '#3D82F6', nome: 'Azul' },
  { hex: '#10B981', nome: 'Verde esmeralda' },
  { hex: '#8B5CF6', nome: 'Violeta' },
  { hex: '#F59E0B', nome: 'Âmbar' },
  { hex: '#EF4444', nome: 'Vermelho' },
  { hex: '#6366F1', nome: 'Índigo' },
  { hex: '#14B8A6', nome: 'Verde-azulado' },
  { hex: '#F97316', nome: 'Laranja' },
] as const

export const PRESET_COLORS: string[] = CORES_ALOJAMENTO.map((c) => c.hex)
