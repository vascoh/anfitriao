-- 041 — Limitador de pedidos que sobrevive a haver mais do que um servidor.
--
-- O limitador vivia num `Map` em memória. Em Vercel, cada instância tem a sua
-- memória: o limite de 60 pedidos/hora era 60 **por instância**, e reiniciava
-- em cada arranque a frio e em cada deploy.
--
-- Medido em produção antes de escrever isto: 90 pedidos em paralelo ao mesmo
-- endereço público, com limite de 60/hora, passaram os 90. A seguir, 70
-- pedidos em série — que caem na mesma instância quente — começaram a ser
-- recusados ao 30.º. O limitador funciona; é a contagem que está partida em
-- tantos bocados quantas as instâncias.
--
-- Isto interessa onde o limite protege alguma coisa a sério: a rota de
-- check-in devolve documentos de identificação de hóspedes, e as rotas de IA e
-- de upload gastam dinheiro a cada chamada.
--
-- A contagem passa a ser feita pela base — que é uma só — e num único
-- comando: ler-e-depois-escrever deixaria passar pedidos simultâneos, que é
-- precisamente o caso que interessa travar.

CREATE TABLE IF NOT EXISTS public.limites_pedidos (
  chave text PRIMARY KEY,
  janela_inicio timestamp with time zone NOT NULL DEFAULT now(),
  contagem integer NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.limites_pedidos IS
  'Contagem de pedidos por chave e janela. Ver lib/rate-limit-persistente.ts.';

-- Só a limpeza precisa de procurar por data.
CREATE INDEX IF NOT EXISTS limites_pedidos_janela_idx
  ON public.limites_pedidos (janela_inicio);

/**
 * Regista um pedido e diz se ele cabe no limite.
 *
 * Devolve `permitido` falso a partir do pedido que passa do limite. A janela é
 * fixa (não deslizante): quando expira, a contagem recomeça — o mesmo
 * comportamento do limitador em memória que isto substitui, para não haver
 * duas regras diferentes conforme a rota.
 */
CREATE OR REPLACE FUNCTION public.registar_pedido(
  p_chave text,
  p_janela_ms integer,
  p_limite integer
) RETURNS jsonb
LANGUAGE plpgsql
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
