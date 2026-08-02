-- País e local de residência do hóspede (ANF-4.9).
--
-- O boletim de alojamento exige `Pais_Residencia_Origem` (obrigatório) e
-- `Local_Residencia_Origem` (facultativo, segundo as perguntas técnicas do
-- SIBA). A tabela `guests` recolhia nacionalidade e documento mas não a
-- residência — sem estes campos nenhum boletim pode ser entregue por web
-- service, por muito completo que esteja o resto.
--
-- Nullable: os hóspedes já existentes continuam válidos e aparecem como
-- incompletos no painel de boletins, com o campo em falta identificado.

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS pais_residencia text,
  ADD COLUMN IF NOT EXISTS local_residencia text;

COMMENT ON COLUMN public.guests.pais_residencia IS
  'País de residência habitual. Obrigatório no boletim de alojamento (Pais_Residencia_Origem).';
COMMENT ON COLUMN public.guests.local_residencia IS
  'Localidade de residência. Facultativo no boletim (Local_Residencia_Origem).';
