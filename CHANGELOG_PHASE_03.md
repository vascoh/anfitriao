# Changelog — Fase 2, incremento 1 (2026-07-26, sessão autónoma)

_Continuação de `CHANGELOG_PHASE_02.md`. Primeiro passo real da Fase 2 (templates/CMS)._

## Achado
Antes de construir o sistema de templates de raiz, auditei o que já existia. `website_settings.cor_primaria`/`cor_secundaria` **já estavam implementados** — usados para branding de emails (`lib/email/identity.ts`) e com seletor de cor já na UI (`(app)/website/page.tsx`) — mas **nunca aplicados ao próprio site público** (`/r/[slug]`). Ligar isto é trabalho de horas, não de dias, e entrega valor real de personalização visual imediatamente, sem esperar pela biblioteca de templates completa.

## Código
- `src/lib/color.ts` (novo) — `HEX_RE`/`safeColor` extraídos de `lib/email/identity.ts` para partilha (evita duplicação entre email e site público).
- `src/lib/email/identity.ts` — passou a importar de `lib/color.ts` em vez de duplicar a validação.
- `src/app/r/[slug]/page.tsx` — aplica `settings.cor_primaria` (validada por regex hex) como override da variável CSS `--primary` no elemento raiz da página; propaga automaticamente a todos os usos existentes de `bg-primary`/`text-primary` (Tailwind v4, `@theme` mapeado a `var(--primary)`). Fallback seguro ao tema default se a cor não for um hex válido.

## Validação
- `npm run typecheck` — 0 erros.
- `npm run lint` — 0 erros, 0 warnings.
- `npm test` — 118/118.
- `npm run build` — sucesso.
- Deploy em produção: `https://anfitrioes.pt` ✅.

## Não incluído nesta fase (deliberado)
- `/book/[propertyId]` (fluxo de reserva) ainda não aplica o tema — é renderizado por `BookingClient`/`RoomsClient` (client components não auditados nesta passagem). Próximo passo imediato, mesma técnica, sem nova migração.
- Personalização de fonte — decidida como não prioritária nesta fase: carregar fontes arbitrárias por tenant em Next.js exige `next/font` estático por fonte (não é trivial tornar dinâmico por request sem custo de performance); uma lista curada de 3-4 fontes pré-carregadas é a via correta, mas fica para quando a biblioteca de templates for construída (mais valor a fazer os dois juntos do que a fonte isolada agora).
- Biblioteca de templates completa (`website_templates`, `secoes`, múltiplas páginas por tenant) — ainda por construir, é o item maior da Fase 2. Este incremento é a fundação (prova de que o mecanismo de tema funciona) antes de investir no trabalho maior.

## Próximo passo
Ver `TODO.md` → Fase 2: tema em `/book/[propertyId]`, depois `website_templates`.
