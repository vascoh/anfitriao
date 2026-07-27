-- Fase 2: fundação do sistema de templates do site público.
-- Templates são parametrizados (tema + secções), não um website builder livre —
-- ver docs/SAAS_ARCHITECTURE.md §6. Catálogo geridó pela equipa, não pelo cliente.

CREATE TABLE IF NOT EXISTS public.website_templates (
  id          text PRIMARY KEY,
  nome        text NOT NULL,
  descricao   text NOT NULL DEFAULT '',
  ativo       boolean NOT NULL DEFAULT true,
  criado_em   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.website_templates ENABLE ROW LEVEL SECURITY;
-- Catálogo é conteúdo de produto, não dado de cliente: leitura pública, escrita só service_role.
CREATE POLICY "website_templates_public_read" ON public.website_templates
  FOR SELECT TO anon, authenticated
  USING (ativo = true);

INSERT INTO public.website_templates (id, nome, descricao) VALUES
  ('classico', 'Clássico', 'Layout atual: hero centrado, cartões arredondados, espaçamento generoso.'),
  ('minimal',  'Minimal',  'Mais compacto e direto: hero alinhado à esquerda, cantos retos, menos espaço vazio.')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.website_settings
  ADD COLUMN IF NOT EXISTS template_id text NOT NULL DEFAULT 'classico' REFERENCES public.website_templates(id),
  ADD COLUMN IF NOT EXISTS fonte text,
  ADD COLUMN IF NOT EXISTS secoes jsonb NOT NULL DEFAULT '{}'::jsonb;
