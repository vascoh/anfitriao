-- Retenção de dados pessoais aplicada por código (ANF-1.10) e apagamento a
-- pedido (ANF-1.11, RGPD art. 17.º).
--
-- Aditiva: nenhum hóspede existente muda de estado. As colunas registam QUANDO
-- se anonimizou e O QUÊ — para o cron não reprocessar as mesmas linhas todos os
-- dias, e para haver prova de que a política foi cumprida, que é o que se exige
-- a quem tem de demonstrar conformidade (RGPD art. 5.º n.º 2).
--
-- Não se apaga a linha do hóspede: a reserva tem relevância fiscal (10 anos,
-- art. 52.º do CIVA) e apagá-lo partiria a cadeia. Anonimizar basta — dados
-- anonimizados deixam de ser dados pessoais (RGPD cons. 26).
--
-- Os prazos e os campos de cada grupo vivem em src/lib/retencao.ts.

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS anonimizado_em timestamptz,
  ADD COLUMN IF NOT EXISTS anonimizado_grupos text[],
  ADD COLUMN IF NOT EXISTS retencao_completa boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.guests.anonimizado_em IS
  'Última anonimização (cron de retenção ou pedido do titular). NULL = intacto.';
COMMENT ON COLUMN public.guests.anonimizado_grupos IS
  'Grupos já anonimizados: boletim, contacto. Ver src/lib/retencao.ts.';
COMMENT ON COLUMN public.guests.retencao_completa IS
  'true quando já não há grupos por anonimizar. Quem decide é a app (src/lib/retencao.ts), não o SQL — o número de grupos muda com a política.';

-- O cron varre só o que falta tratar: sem isto a varredura cresceria com o
-- total de hóspedes em vez de com os que ainda têm dados por expirar.
CREATE INDEX IF NOT EXISTS guests_retencao_pendente_idx
  ON public.guests (owner_id)
  WHERE retencao_completa = false;
