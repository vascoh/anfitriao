-- Fase 2: blog por tenant (/r/[slug]/blog). MVP: conteúdo em texto simples
-- (parágrafos por linha em branco, sem markdown/HTML) — mesma decisão de
-- simplicidade já tomada para descrição/bio do anfitrião, evita depender de
-- uma lib de markdown/sanitização para um ganho marginal neste MVP.
CREATE TABLE IF NOT EXISTS public.posts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      text NOT NULL,
  slug          text NOT NULL,
  titulo        text NOT NULL,
  resumo        text,
  conteudo      text NOT NULL DEFAULT '',
  imagem_capa   text,
  publicado     boolean NOT NULL DEFAULT false,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS posts_owner_slug_idx ON public.posts (owner_id, slug);
CREATE INDEX IF NOT EXISTS posts_owner_idx ON public.posts (owner_id);
CREATE INDEX IF NOT EXISTS posts_publicado_idx ON public.posts (owner_id, publicado) WHERE publicado = true;

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
-- Sem políticas anon/authenticated: escrita via API routes (service_role),
-- leitura pública em /r/[slug]/blog também via service_role (adminGet*,
-- mesmo padrão de properties/website_settings nas outras páginas do site
-- público — ver lib/db-admin.ts). Mesmo padrão de automations/expenses.
