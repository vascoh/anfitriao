-- 037 — NIF do hóspede, separado do documento de identificação.
--
-- A fatura levava `guests.numero_documento` no campo do NIF. São coisas
-- diferentes: o número do Cartão de Cidadão (ou do passaporte) não é o número
-- de identificação fiscal. O que ia para a AT era, na melhor das hipóteses,
-- recusado — e na pior atribuído ao NIF de outra pessoa, por acaso de nove
-- dígitos.
--
-- O NIF passa a ter campo próprio, opcional, pedido a quem o quiser na fatura.
-- Sem ele, a fatura sai a "Consumidor final", que é o que a lei prevê.
--
-- Nota de retenção: o NIF é dado fiscal (art. 52.º do CIVA, 10 anos) e por
-- isso **não** entra nos grupos anonimizáveis de `lib/retencao.ts`, ao
-- contrário do número do documento, que é do boletim e cai ao fim de 1 ano.

alter table public.guests add column if not exists nif text;

comment on column public.guests.nif is
  'NIF para faturacao, indicado pelo hospede. Nunca derivado do numero_documento.';
