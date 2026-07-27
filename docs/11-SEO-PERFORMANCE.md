# SEO & Performance

## Estado atual
Domínio principal já tem: metadata root (OG, Twitter Cards), `robots.ts` (permite landing/`/r/`/`/book/`, bloqueia rotas de app), `sitemap.ts`, OG dinâmico por site de anfitrião (`api/og`). `/r/[slug]` já é `noindex` deliberadamente (não é destino de pesquisa geral — é página de reserva direta partilhada pelo próprio anfitrião).

## Gaps face ao pedido do prompt mestre
| Item | Estado | Ação |
|---|---|---|
| Schema.org por site de tenant | 🔴 Não implementado | Gerar `LodgingBusiness`/`Hotel` JSON-LD a partir de `properties`/`website_settings` — dados já existem, só falta o output (Fase 2, junto com templates) |
| Sitemap por tenant | 🔴 Não implementado | `/r/[slug]/sitemap.xml` gerado a partir das páginas ativas do template (Fase 2) |
| Core Web Vitals por template | Depende do sistema de templates ainda não construído | Definir orçamento de performance (imagens otimizadas via `next/image`, sem JS não essencial) como critério de aceitação de cada template novo |
| Lighthouse >95 | Não medido ainda de forma sistemática | Adicionar a CI como gate não-bloqueante (relatório, não falha de build) antes de ser bloqueante |

## Princípio
SEO por tenant nasce de dados estruturados que **já existem na base de dados** (nome, morada, fotos, preços) — o trabalho é de renderização (JSON-LD, sitemap, meta tags), não de recolha de dados nova. Isto mantém o custo de implementação baixo relativamente ao valor.
