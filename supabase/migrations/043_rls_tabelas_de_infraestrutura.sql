-- 043 — RLS nas duas tabelas de infraestrutura que ficaram de fora.
--
-- O linter de segurança do Supabase deu ERROR em ambas, e a verificação dos
-- grants confirmou o pior caso: `anon` e `authenticated` têm SELECT, INSERT,
-- UPDATE, DELETE e TRUNCATE nas duas, e não havia RLS a travar nada. `anon` é
-- a chave que **vai no browser** — está no JavaScript de qualquer visitante.
--
-- ## limites_pedidos
--
-- É a tabela do limitador de pedidos (migration 041). Sem RLS, qualquer pessoa
-- com a chave pública podia fazer `DELETE FROM limites_pedidos` e pôr todos os
-- contadores a zero — os seus e os de toda a gente.
--
-- O limitador foi posto lá precisamente para proteger o que custa caro se for
-- abusado: `/api/checkin/[bookingId]`, que devolve documentos de identificação
-- de hóspedes, e as rotas de IA e de upload, que gastam dinheiro a cada
-- chamada. Ou seja: a defesa da PII e da fatura era desarmável com a chave que
-- se lê no código-fonte da página. Corrigir a contagem em 041 não valeu de
-- nada enquanto a tabela onde ela vive esteve aberta.
--
-- ## envios_unicos
--
-- Garante que um email ou push é enviado **uma só vez** (`lib/envio-unico.ts`).
-- Apagar uma linha faz o envio repetir-se: hóspedes a receber o mesmo email de
-- check-in várias vezes, e o anfitrião a levar com a reputação disso.
--
-- ## Porquê sem políticas
--
-- É o mesmo padrão do resto do projeto: RLS ligada e **zero políticas** nega
-- tudo a `anon` e a `authenticated`. Nenhuma das duas tabelas é lida pelo
-- browser — ambas são tocadas só por `createAdminClient()` (service role, que
-- ignora RLS) em `lib/rate-limit-persistente.ts` e `lib/envio-unico.ts`.
-- Confirmado que SUPABASE_SERVICE_ROLE_KEY está definida em Production antes
-- de aplicar isto: sem ela, o cliente admin cai para a chave anon e estas duas
-- funcionalidades parariam.

ALTER TABLE public.limites_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.envios_unicos   ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- search_path fixo em registar_pedido (WARN do linter).
--
-- Sem `SET search_path`, a função resolve os nomes pelo search_path de quem a
-- chama. Recriada igual à de 041 — só com o search_path preso — para que
-- `public.limites_pedidos` signifique sempre a tabela que se quer.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.registar_pedido(
  p_chave text,
  p_janela_ms integer,
  p_limite integer
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_agora timestamptz := now();
  v_janela interval := make_interval(secs => p_janela_ms / 1000.0);
  v_contagem integer;
  v_inicio timestamptz;
BEGIN
  INSERT INTO public.limites_pedidos AS l (chave, janela_inicio, contagem)
  VALUES (p_chave, v_agora, 1)
  ON CONFLICT (chave) DO UPDATE
    SET contagem = CASE
          WHEN l.janela_inicio < v_agora - v_janela THEN 1
          ELSE l.contagem + 1
        END,
        janela_inicio = CASE
          WHEN l.janela_inicio < v_agora - v_janela THEN v_agora
          ELSE l.janela_inicio
        END
  RETURNING l.contagem, l.janela_inicio INTO v_contagem, v_inicio;

  RETURN jsonb_build_object(
    'permitido', v_contagem <= p_limite,
    'restantes', greatest(0, p_limite - v_contagem),
    'reinicia_em', extract(epoch FROM (v_inicio + v_janela)) * 1000
  );
END;
$$;
