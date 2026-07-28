-- Cofre de conformidade (ANF-4.1) — obrigações legais do AL português.
--
-- Guardadas na própria `properties` (e não numa tabela nova) porque são
-- atributos 1:1 do alojamento, sempre lidos com ele e nunca isoladamente.
-- Todas as colunas são nullable: um alojamento existente continua válido e
-- os itens aparecem simplesmente como "em falta" no cofre.
--
-- Base legal de cada campo documentada em src/lib/compliance.ts.

ALTER TABLE public.properties
  -- RNAL — DL 128/2014, alterado pela Lei 56/2023. Obrigatório em publicidade.
  ADD COLUMN IF NOT EXISTS rnal_numero text,
  ADD COLUMN IF NOT EXISTS rnal_data date,

  -- Seguro de responsabilidade civil — DL 128/2014, art. 13.º-A.
  ADD COLUMN IF NOT EXISTS seguro_seguradora text,
  ADD COLUMN IF NOT EXISTS seguro_apolice text,
  ADD COLUMN IF NOT EXISTS seguro_validade date,

  -- Livro de Reclamações Eletrónico — DL 74/2017.
  ADD COLUMN IF NOT EXISTS livro_reclamacoes_registado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS livro_reclamacoes_url text,

  -- Certificado energético — DL 101-D/2020. Facultativo no cofre.
  ADD COLUMN IF NOT EXISTS certificado_energetico_validade date;

COMMENT ON COLUMN public.properties.rnal_numero IS
  'Número de registo no RNAL. Obrigatório em toda a publicidade do alojamento.';
COMMENT ON COLUMN public.properties.seguro_validade IS
  'Fim de validade do seguro de RC. A caducidade é causa de cancelamento do registo.';
COMMENT ON COLUMN public.properties.livro_reclamacoes_registado IS
  'True quando o anfitrião confirma o registo no Livro de Reclamações Eletrónico.';

-- Índice para o cron de alertas: varre validades a expirar sem ler a tabela toda.
CREATE INDEX IF NOT EXISTS properties_seguro_validade_idx
  ON public.properties (seguro_validade)
  WHERE seguro_validade IS NOT NULL;
