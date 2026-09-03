-- 045 · O plano Empresa passa a ser aceite pela base
--
-- Aplicada em produção a 2026-09-03.
--
-- Porquê
-- ------
-- O plano Empresa existe no código desde agosto: `AccountPlano`, `PLAN_LIMITS`
-- (40 unidades), `priceToPlano`, a página de preços e a validação do painel de
-- administração. A base recusava-o — o CHECK ficou nos três planos originais.
--
-- Enquanto o `STRIPE_EMPRESA_PRICE_ID` não estiver configurado, isto é
-- invisível. No dia em que estiver:
--   1. alguém compra o plano de 99 €;
--   2. `priceToPlano` devolve `empresa`;
--   3. `updateAccount` tenta gravar e a base recusa (23514);
--   4. `updateAccount` lança, o webhook devolve 500;
--   5. o Stripe repete durante três dias e desiste.
--
-- Fica dinheiro cobrado e conta por ativar — que os próprios comentários do
-- webhook descrevem como «o pior estado possível e o único que ninguém
-- descobre sozinho».
--
-- Pelo painel de administração o sintoma é mais visível e igualmente real: pôr
-- uma conta em Empresa dá erro.
--
-- `conjuntos-fechados.test.ts` passa a comparar os tipos do código com estes
-- CHECK, para a próxima divergência não esperar por um pagamento para aparecer.

alter table public.accounts drop constraint if exists accounts_plano_check;

alter table public.accounts
  add constraint accounts_plano_check
  check (plano in ('trial','starter','pro','empresa'));
