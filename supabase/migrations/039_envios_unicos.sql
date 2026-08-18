-- 039 — Cada aviso automático sai uma vez só.
--
-- Os crons que enviam email não guardavam rasto do que já tinham enviado. Uma
-- segunda execução no mesmo dia — uma retentativa, um disparo manual com o
-- segredo, dois agendamentos sobrepostos — repetia o email a toda a gente.
--
-- A chave primária é a fechadura: quem consegue inserir a linha é quem envia.
-- Duas execuções ao mesmo tempo não conseguem ambas, porque a segunda colide.
-- Contar linhas antes de escrever não daria a mesma garantia — entre a leitura
-- e a escrita cabe a outra execução.

CREATE TABLE IF NOT EXISTS public.envios_unicos (
  chave text PRIMARY KEY,
  criado_em timestamp with time zone NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.envios_unicos IS
  'Reserva de envio: um cron insere a chave antes de enviar e apaga-a se o envio falhar. Ver lib/envio-unico.ts.';

-- Só a limpeza precisa de olhar para a data.
CREATE INDEX IF NOT EXISTS envios_unicos_criado_em_idx
  ON public.envios_unicos (criado_em);
