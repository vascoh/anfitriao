-- 052 · mensagens.origem — emails que a aplicação envia sozinha
--
-- A confirmação da reserva, o pedido recebido, o lembrete de pagamento e as
-- automações saíam sem ficar na conversa da reserva: o anfitrião não via o
-- que o hóspede já tinha recebido, e a resposta do hóspede a esses emails ia
-- para o email do alojamento em vez de voltar à caixa de entrada.
--
-- null = escrita pelo anfitrião na caixa de entrada.

alter table public.mensagens
  add column if not exists origem text
  check (origem is null or origem in ('pedido', 'confirmacao', 'lembrete_pagamento', 'automacao'));
