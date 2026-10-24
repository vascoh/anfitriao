-- 054 · Índice em mensagens.hospede_id
--
-- A chave estrangeira para guests ficou sem índice na 051. Apagar ou
-- anonimizar um hóspede (retenção RGPD) obrigava a percorrer a tabela toda
-- para verificar a referência, e é a tabela da app que mais depressa cresce.

create index if not exists mensagens_hospede_id_idx
  on public.mensagens (hospede_id);
