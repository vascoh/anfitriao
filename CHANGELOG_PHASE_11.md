# Changelog — Fase 4, incremento 1 (2026-07-26, sessão autónoma)

_Início da Fase 4. Foco nos itens sem custo/dependência de negócio — wildcard subdomain e canais reais ficam fora desta sessão (ver "Não incluído")._

## Multi-idioma nos sites de clientes (PT/EN)
- **Achado prévio**: `website_settings.idioma` já existia no schema, mas só era consumido por `lib/email/identity.ts` (`EmailIdentity.language`) — e nem esse campo era lido em lado nenhum dos templates de email. Campo recolhido, nunca aplicado (mesmo padrão de `cor_primaria` antes da Fase 2). Não corrigi o idioma dos emails nesta passagem — foco no site público, que é onde o hóspede internacional decide reservar.
- `src/lib/i18n.ts` (novo) — dicionário PT/EN dos textos fixos do site público (nav, hero, secções "porquê reservar direto", FAQ, rodapé) + `resolveLang()`/`t()`/`listingAvailable()`/`minNights()`.
- `site-chrome.tsx` (`SiteNav`/`SiteFooter`) e `r/[slug]/page.tsx` (homepage + `PropertyCard`) — traduzidos por completo. `generateMetadata` ajusta `og:locale` consoante o idioma.
- `(app)/website/page.tsx` — seletor de idioma (Português/English), sem nova migração (campo já existia).
- **Conteúdo escrito pelo próprio anfitrião não é traduzido** (descrição, FAQ, bio) — comportamento correto e esperado de i18n: a UI fixa traduz-se, o conteúdo do utilizador mantém-se como foi escrito.

## Dashboard super-admin — MRR
- `lib/stripe.ts` — `PLAN_PRICE_EUR` (valores de exibição €19/€39, a fonte de verdade do valor cobrado continua a ser o Price ID no Stripe).
- `(admin)/admin/contas/page.tsx` — novo KPI **MRR** (soma do preço do plano das contas `activo`), junto aos já existentes (Total/Trial/Ativos/Suspensos).

## Validação
- `typecheck`/`lint`/`test` (118/118)/`build` — limpos. Sem migração (campo `idioma` já existia).
- **Teste ao vivo em produção**: site real do Vasco alternado temporariamente para `idioma='en'` — confirmado "Direct booking · No fees", "Book now", "Home"/"About" no HTML servido — e revertido para `pt` no fim.
- Deploy confirmado; `/admin/contas` protegida como as outras páginas admin.

## Não incluído nesta fase (motivo)
- **Wildcard subdomain / domínio próprio** — exige upgrade pago a Vercel Pro. Decisão de orçamento, não técnica (já pendente em `TODO.md` #6) — não tomo decisões de gasto sem autorização explícita.
- **`ChannelAdapter` (abstração para Airbnb/Booking)** — arquitetura preparatória sem consumidor real enquanto não houver parceria (mesma lógica da decisão de RBAC: não construir antecipadamente sem necessidade confirmada). Fica documentado em `SAAS_ARCHITECTURE.md` §5 como o padrão a seguir quando a candidatura a parceiro avançar.
- **Webhooks/API pública** — deliberadamente adiado até existir um parceiro real a pedir (já documentado desde a Fase 0).
- **Tradução de emails** e das páginas Sobre/Galeria/Localização/legal — ficam PT-only por agora; candidatas a um próximo incremento de i18n se a procura internacional justificar.

## Próximo passo
Ver `TODO.md`. Itens de Fase 4 restantes dependem de decisões de orçamento (domínio/Vercel Pro) ou de negócio (parceria de canais) — não há mais trabalho de código de alto valor e sem dependência óbvia nesta fase. Recomendação: aguardar essas decisões ou redirecionar esforço para consolidar o que já existe (testes E2E reais com supervisão, revisão de UX).
