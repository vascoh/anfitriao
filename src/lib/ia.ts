/**
 * Funcionalidades de IA (sugestão de resposta, Concierge, leitura de
 * documentos) — desligadas por omissão.
 *
 * Dependem de crédito na API da Anthropic. Sem ele, cada botão falhava à
 * frente do anfitrião ou do hóspede com um erro que não lhe diz nada. Para
 * voltar a ligar: `NEXT_PUBLIC_IA_ATIVA=true` na Vercel e novo deploy (é
 * `NEXT_PUBLIC_` porque o browser também precisa de saber, para esconder os
 * botões — o valor fica fixado no build).
 */
export const IA_ATIVA = process.env.NEXT_PUBLIC_IA_ATIVA === 'true'

export const MENSAGEM_IA_DESLIGADA = 'As funcionalidades de IA estão desligadas.'
