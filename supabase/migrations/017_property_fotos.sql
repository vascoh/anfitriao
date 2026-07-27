-- Galeria multi-foto por propriedade (Fase 2). Lista de URLs externas
-- (mesmo padrão já usado em imagem_url — o anfitrião cola o link, sem
-- upload próprio; @vercel/blob fica disponível como upgrade futuro).
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS fotos text[] NOT NULL DEFAULT '{}';
