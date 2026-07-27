# Changelog — Fase 2, incremento 3 (2026-07-26, sessão autónoma)

_Continuação de `CHANGELOG_PHASE_05.md`. Páginas adicionais por tenant, pedidas no prompt de arquitetura original._

## Refactor prévio (necessário antes de adicionar páginas)
`src/lib/site-theme.ts` — extraída a lógica de cor+fonte (antes duplicada em `r/[slug]/page.tsx`, `BookingClient.tsx`, `RoomsClient.tsx`) para uma função única `siteTheme()`. Sem isto, cada página nova replicaria a mesma lógica pela quarta/quinta vez.

`src/app/r/[slug]/_components/site-chrome.tsx` — `SiteNav`/`SiteFooter` extraídos da homepage para componentes partilhados, com navegação entre as páginas do site (Início/Sobre/Galeria/Localização) e rodapé com links legais (Privacidade/Cookies/Termos). A homepage (`page.tsx`) foi migrada para os usar — visualmente idêntica, validado ao vivo.

## Páginas novas (todas em `src/app/r/[slug]/`)
- **`/sobre`** — perfil do anfitrião (nome, bio, contacto WhatsApp), reaproveitando dados já recolhidos (`host_nome`/`host_bio`), sem novo campo de schema.
- **`/galeria`** — grelha de fotos de todas as propriedades ativas. Usa o `imagem_url` já existente por propriedade (uma foto por alojamento) — **não é uma galeria multi-foto por propriedade** (isso exige um campo novo tipo array/tabela de fotos + UI de upload múltiplo, fora do âmbito desta fatia; documentado como próximo passo).
- **`/localizacao`** — lista de alojamentos com morada e link direto para o Google Maps (`maps.google.com/search?query=...`), sem necessidade de API key nem custo.
- **`/privacidade`**, **`/cookies`**, **`/termos`** — páginas legais com texto-modelo genérico em português, interpolando nome/contacto do anfitrião, com aviso explícito de que é um modelo a rever pelo anfitrião (não é aconselhamento jurídico).

Todas as páginas: mesmo tema (cor/fonte) do resto do site, `robots: noindex` (consistente com a decisão já tomada para `/r/[slug]`), `notFound()` se o site não existir/estiver desativado.

## Validação
- `npm run typecheck` / `lint` / `test` (118/118) — limpos.
- `npm run build` — sucesso, as 6 rotas novas aparecem no output.
- Deploy em produção confirmado; todas as 7 rotas (`/r/casadevasco` + 6 novas) devolvem 200 ao vivo; navegação entre páginas testada.

## Não incluído (documentado, não esquecido)
- **Blog** — precisa de um modelo de conteúdo (posts, editor, possivelmente imagens) substancialmente maior do que as páginas estáticas desta fatia. Fica para um incremento dedicado.
- **Galeria multi-foto por propriedade** — precisa de schema novo (`fotos jsonb`/tabela dedicada) + UI de upload múltiplo (Vercel Blob já usado no projeto para outros uploads, reaproveitável). Próximo candidato natural da Fase 2.
- **Schema.org/sitemap por tenant** — continua bloqueado pela pendência de indexação (ver `TODO.md`).

## Próximo passo
Ver `TODO.md`. Candidatos restantes da Fase 2: galeria multi-foto, blog, ou avançar para a Fase 3 (RBAC/CRM/automações) se a prioridade mudar.
