# Changelog — Fase 2, incremento 2 (2026-07-26, sessão autónoma)

_Continuação de `CHANGELOG_PHASE_03.md` (tema de cor). Primeira versão real do sistema de templates: mecanismo completo, 2 templates, tipografia e FAQ configuráveis._

## Código
- **Migration `016_website_templates.sql`**: tabela `website_templates` (catálogo, leitura pública/authenticated, escrita só service_role) seed com `classico`/`minimal`; `website_settings` ganha `template_id` (FK, default `classico`), `fonte` (nullable) e `secoes` (jsonb, hoje só `{ faq: [...] }`).
- `src/lib/fonts.ts` (novo) — `fontForSetting()`: Playfair Display ("serif") e Poppins ("arredondada") via `next/font/google`, partilhando a mesma variável CSS `--font-tenant` para simplificar a aplicação condicional (só uma é usada de cada vez).
- `src/app/r/[slug]/page.tsx` — aplica `fonte` (CSS var + className) e `template_id` (branch `isMinimal`: hero alinhado à esquerda vs centrado, sem crachá "Reservas diretas", tipografia mais compacta, cartões de propriedade com cantos retos em vez de arredondados). Nova secção FAQ (accordion nativo `<details>`, sem JS) a partir de `secoes.faq`.
- `BookingClient.tsx`/`RoomsClient.tsx` — aplicam a mesma fonte do tenant (consistência de marca no fluxo de reserva), sem branch de template (o calendário/formulário não muda de layout por template nesta fase — decisão deliberada, ver "não incluído" abaixo).
- `(app)/website/page.tsx` — nova secção "Aparência do site": seletor de template (2 cartões), seletor de tipo de letra, editor de FAQ (adicionar/remover pergunta+resposta). Label da cor principal atualizado para refletir que já não é só para emails.
- `types.ts` — `WebsiteSettings` ganha `template_id`, `fonte`, `secoes`; novo tipo `WebsiteTemplate`.

## Validação
- `npm run typecheck` / `lint` / `test` (118/118) — limpos.
- `npm run build` — sucesso.
- Advisor de segurança Supabase — sem novos WARN/ERROR.
- **Teste ao vivo em produção**: `/r/casadevasco` com `template_id=classico` mostra o crachá (comportamento antigo preservado); alternado temporariamente para `minimal` confirma a ausência do crachá (variação a funcionar); revertido para `classico` no fim (não alterei a configuração real do anfitrião).
- Deploy em produção: `https://anfitrioes.pt` ✅.

## Decisões e dívida deliberada (documentada, não esquecida)
- **Templates são 2, não os 12 pedidos no prompt original** — decisão consciente do roadmap (`SAAS_ARCHITECTURE.md` §12: "lançar com 4-6, validar antes de expandir"). Adicionar mais é replicar o mesmo padrão de branches condicionais em `/r/[slug]/page.tsx`, sem mudança de arquitetura.
- **Fluxo de reserva (`/book/[propertyId]`) não varia por template** — só herda cor/fonte. Decisão: o calendário e formulário são funcionais, não de marketing; variar o layout aí aumenta risco no caminho de receita para ganho estético marginal.
- **UI de seleção de template tem as 2 opções escritas no código**, não busca a tabela `website_templates` dinamicamente. A tabela existe para integridade de dados e para o dia em que houver templates a mais para justificar buscar a lista — com 2 templates fixos, uma chamada de API extra não paga o custo. Revisitar quando o catálogo crescer.
- **Schema.org/sitemap por tenant não incluído** — `/r/[slug]` tem `robots: noindex` deliberado desde 2026-06-09 (é um link de reserva partilhado pelo anfitrião, não uma página para indexação geral). Adicionar SEO estruturado sem decidir primeiro se os sites de tenant devem passar a ser indexáveis seria trabalho sem efeito. Ver Pendência nova abaixo.
- **Páginas adicionais (Sobre, Galeria, Localização, Blog, Privacidade, Cookies, Termos) não construídas** — FAQ foi a única adicionada, por ser a mais simples de tornar configurável sem exigir upload de imagens/vídeo (fora de âmbito desta fase). Próximo incremento natural da Fase 2.

## Nova pendência para validação humana
- **Os sites `/r/[slug]` devem passar a ser indexáveis pelo Google?** Hoje são deliberadamente `noindex` (partilhados pelo anfitrião, não descobertos via pesquisa). O prompt de arquitetura original pede SEO completo por site, o que implica mudar esta política. Decisão de produto/privacidade, não técnica — adicionada a `docs/SAAS_ARCHITECTURE.md` §13 e `TODO.md`.

## Próximo passo
Ver `TODO.md` → Fase 2: decidir a pendência de indexação, depois Schema.org/sitemap por tenant (se aprovado) e páginas adicionais (Sobre/Galeria).
