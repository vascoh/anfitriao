-- 042 — Subscrições da newsletter.
--
-- O formulário da landing page existia, validava o email, mostrava
-- "Obrigado — ficaste subscrito." e **não guardava nada**. O `onSubmit` era
-- `setEnviado(true)` e um `TODO: ligar a um endpoint real antes de publicar`.
--
-- Um formulário que mente é pior do que não ter formulário: recolhe um dado
-- pessoal com o gesto de consentimento associado, promete um serviço, e não
-- fica com nada para o cumprir. Quem subscreveu nunca recebe nada e não tem
-- como saber porquê.
--
-- A tabela é deliberadamente pequena — email, quando, e de onde veio. Não há
-- nome nem perfil: a promessa da landing page é "uma vez por mês, sem ruído",
-- e não se recolhe o que não se vai usar.

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  email text PRIMARY KEY,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  -- Que página originou a subscrição, para saber o que converte.
  origem text,
  -- Quem se descreve não é apagado: fica o registo de que pediu para sair,
  -- senão uma reimportação de uma lista antiga volta a subscrevê-lo.
  removido_em timestamp with time zone
);

COMMENT ON TABLE public.newsletter_subscribers IS
  'Subscrições da newsletter da landing page. Escrita só pela service role via /api/newsletter.';

-- A listagem de envio percorre quem ainda não saiu, por ordem de entrada.
CREATE INDEX IF NOT EXISTS newsletter_subscribers_ativos_idx
  ON public.newsletter_subscribers (criado_em)
  WHERE removido_em IS NULL;

-- RLS a negar tudo.
--
-- Não há política nenhuma de propósito: com RLS ligada e zero políticas,
-- `anon` e `authenticated` não leem nem escrevem uma linha. A service role
-- ignora RLS, e é por lá que a rota escreve. Sem isto, a chave anon — que vai
-- no browser — dava a lista de emails a quem a pedisse.
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
