# Changelog — Consolidação: revisão visual (2026-07-26, sessão com o utilizador presente)

_Pedido explícito do utilizador (opção "c"): consolidar o que já existe em vez de continuar a adicionar fases. Todas as funcionalidades construídas nesta sessão só tinham sido validadas por HTTP (curl/status codes), nunca vistas realmente renderizadas — esta é a primeira revisão visual real, com screenshots._

## Metodologia
Usei o skill `webapp-testing` (Playwright) para capturar screenshots do site real em produção (`/r/casadevasco`): homepage e páginas Sobre/Galeria/Localização/Privacidade em mobile (390px) e desktop (1280px), mais dark mode.

## Bugs reais encontrados e corrigidos
1. **Nome do alojamento cortado em mobile** — no cartão de propriedade sem foto (`PropertyCard`, variante placeholder), o layout `flex items-center` colocava nome e preço na mesma linha; a 390px de largura "Casa de Vasco" ficava truncado para "Casa de V...". Corrigido: em mobile o preço passa para baixo do nome (`flex-col sm:flex-row`), sem truncar texto. Confirmado por screenshot antes/depois.
2. **Ícone 🏠 partido** — o emoji não renderizava (mostrava um quadrado/tofu) no browser headless usado para o teste; risco real em qualquer browser sem fonte de emoji instalada. Substituído pelo ícone `Home` do `lucide-react` (SVG, já usado em toda a app) — renderização consistente garantida.

## Validação
- `typecheck`/`lint`/`test` (118/118)/`build` — limpos.
- Deploy em produção; screenshot mobile pós-correção confirma nome completo, preço bem posicionado, ícone a renderizar corretamente.

## O que correu bem (confirmado visualmente, sem alterações necessárias)
- Tema de cor por tenant, dark mode, navegação entre páginas (incl. estado ativo no menu), páginas Sobre/Galeria/Localização/Privacidade, estados vazios ("Ainda não há fotografias disponíveis") — tudo a renderizar como esperado, com boa paleta e hierarquia visual (consistente com o brand voice do `PRODUCT.md`).

## Achado a sinalizar (não é bug, é consideração de produto)
A página `/localizacao` (nova nesta sessão, Fase 2) mostra a **morada completa** de cada alojamento ("Rua de Bijagós 13A, Amora") a qualquer visitante anónimo do site — antes desta fase, a homepage só mostrava a cidade ("Amora"). Isto é o comportamento pretendido da funcionalidade (o hóspede precisa de saber onde fica), mas é uma exposição pública nova que não existia antes. Vale a pena confirmares que é isto que queres — a alternativa seria mostrar a morada completa só depois de reserva confirmada (por email/check-in), mantendo a página pública só com a cidade/zona.

## Não testado nesta passagem (âmbito do pedido do utilizador: só páginas públicas)
Fluxo de reserva (`/book/[propertyId]`), páginas autenticadas (`/hoje`, `/financeiro`, `/automacoes`, etc.) — ficam para uma próxima revisão visual se quiseres.
