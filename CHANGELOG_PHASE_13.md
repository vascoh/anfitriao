# Changelog — Correção de privacidade: morada opcional (2026-07-26)

_Resposta direta ao achado de `CHANGELOG_PHASE_12.md` (revisão visual): a página `/localizacao` mostrava a morada completa a qualquer visitante anónimo. Pedido do utilizador: tornar opcional, por propriedade._

## Código
- Migration `021_property_morada_publica.sql` — `properties.mostrar_morada_publica boolean default false`. **Default `false`**: privacidade primeiro, o anfitrião decide expor.
- `types.ts` — `Property.mostrar_morada_publica`.
- `(app)/propriedades/[id]/editar/page.tsx` — toggle "Mostrar morada completa no site público", com explicação do comportamento em cada estado.
- `/r/[slug]/localizacao/page.tsx` — só mostra `endereco` completo se `mostrar_morada_publica = true`; caso contrário mostra só a cidade, com nota "A morada exata é partilhada após confirmação da reserva", e o link "Ver mapa" aponta para a cidade em vez da morada exata.

## Validação
`typecheck`/`lint`/`test` (118/118)/`build` limpos. Deploy em produção confirmado: `/r/casadevasco/localizacao` já não expõe a morada completa (comportamento default), mostra só "Amora" + a nota explicativa — consistente com o pedido.

## Nota
O toggle fica desligado por omissão em todas as propriedades existentes (incluindo as do Vasco) — se ele quiser mostrar a morada completa nalguma propriedade específica, ativa manualmente em `Propriedades → editar → Mostrar morada completa no site público`.
