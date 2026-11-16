-- Trial passa de 14 para 30 dias (decisão de 2026-11-16, TODO 2.1).
-- A fonte de verdade é TRIAL_DIAS em src/lib/planos.ts: ensureAccount grava
-- trial_ends_at explicitamente. O default fica alinhado só como rede, para uma
-- inserção que o omita não voltar a dar 14 dias.
-- Contas existentes não mudam (a única em trial à data era de teste).
ALTER TABLE public.accounts
  ALTER COLUMN trial_ends_at SET DEFAULT (now() + INTERVAL '30 days');
