-- A página pública /r/[slug]/localizacao (Fase 2) passou a mostrar a morada
-- completa de cada alojamento a qualquer visitante anónimo — exposição nova
-- face ao comportamento anterior (só a cidade). Torna-se opcional, controlado
-- pelo anfitrião por propriedade. Default false: privacidade primeiro,
-- anfitrião decide expor.
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS mostrar_morada_publica boolean NOT NULL DEFAULT false;
