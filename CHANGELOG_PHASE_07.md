# Changelog — Fase 2, incremento 4 e fecho (2026-07-26, sessão autónoma)

_Continuação de `CHANGELOG_PHASE_06.md`. Último incremento da Fase 2 nesta sessão — fecha o essencial do sistema de templates/CMS._

## Código
- Migration `017_property_fotos.sql` — `properties.fotos text[]` (default `{}`), lista de URLs adicionais por propriedade.
- `types.ts` — `Property.fotos?: string[]`.
- `(app)/propriedades/[id]/editar/page.tsx` — editor de "Mais fotos" (adicionar/remover URLs), mesmo padrão UX do campo "Foto principal" já existente (colar URL, sem upload próprio — `@vercel/blob` já é dependência do projeto mas não está usado em lado nenhum; upload de ficheiros fica como upgrade futuro, não construído agora por não haver precedente nem confirmação de `BLOB_READ_WRITE_TOKEN` configurado).
- `/r/[slug]/galeria/page.tsx` — agrega `imagem_url` + `fotos` de todas as propriedades ativas.

## Validação
`typecheck`/`lint`/`test` (118/118)/`build` limpos. Deploy em produção confirmado; `/r/casadevasco/galeria` 200.

## Fase 2 — estado final desta sessão
✅ Feito: tema de cor, 2 templates (Clássico/Minimal), tipografia configurável, FAQ, páginas Sobre/Galeria(multi-foto)/Localização/Privacidade/Cookies/Termos.
🔴 Backlog (não iniciado): Blog (precisa de modelo de conteúdo — posts/editor — substancialmente maior que páginas estáticas); Schema.org/sitemap por tenant (bloqueado pela pendência de indexação, `TODO.md`); mais templates além dos 2 iniciais.

A partir daqui a sessão avança para a **Fase 3** (RBAC/CRM/automações/financeiro) — ver próximo changelog.
