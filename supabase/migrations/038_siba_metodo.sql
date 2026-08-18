-- 038 — Por que caminho foi comunicado o boletim.
--
-- O estado `siba_status` só era escrito pelo web service da AIMA, que exige
-- credenciais que a maioria dos anfitriões ainda não tem. Quem usa o caminho
-- em uso hoje — exportar o CSV e carregá-lo no portal SIBA — não tinha como
-- registar que o fez: todas as reservas ficavam eternamente 'nao_submetido',
-- e o painel de conformidade acusava um incumprimento que não existia.
--
-- Com esta coluna, marcar a entrega manual passa a ser um facto guardado, e a
-- interface consegue distinguir "entregue no portal" de "entregue
-- automaticamente" — que é a diferença entre uma prova e outra.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS siba_metodo text;

COMMENT ON COLUMN public.bookings.siba_metodo IS
  'Caminho da comunicação: webservice (AIMA) ou csv (entregue à mão no portal SIBA). Nulo em reservas anteriores a esta coluna.';

-- Só interessa procurar pelo que falta comunicar.
CREATE INDEX IF NOT EXISTS bookings_siba_por_comunicar_idx
  ON public.bookings (owner_id, check_in)
  WHERE siba_status = 'nao_submetido';
