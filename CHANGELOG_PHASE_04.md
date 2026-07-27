# Changelog — Fase 1.5, correção crítica de segurança (2026-07-26, sessão autónoma)

_Descoberta ao trabalhar na Fase 2 (tema do site público). Tratada com prioridade máxima antes de continuar, por ser uma vulnerabilidade ativa numa plataforma comercial multi-tenant. Ver `CHANGELOG_PHASE_03.md` para o contexto imediatamente anterior._

## O que estava mal
Auditoria ao código que ainda usava o cliente Supabase `anon` (`src/lib/db.ts`) revelou que a página de confirmação de reserva (`/book/[propertyId]/confirmacao`) e uma página de catálogo legada (`/book`, da era single-tenant, anterior ao `/r/[slug]`) liam tabelas inteiras sem qualquer filtro por `owner_id`, confiando apenas nas políticas RLS `anon` para restringir o acesso.

Auditoria direta às políticas RLS em produção (via Supabase MCP + testes reais ao endpoint REST anon, só leitura) confirmou que essas políticas eram muito mais permissivas do que a app assumia:

| Tabela | Política | `qual` | Risco real |
|---|---|---|---|
| `guests` | `public_read_guests_limited` | `true` (sem filtro nenhum) | **Crítico** — qualquer visitante anónimo conseguia listar todos os hóspedes de todos os anfitriões, incluindo campos SIBA/SEF (documento de identificação) |
| `bookings` | `public_read_bookings_for_checkin` | `true` (sem filtro nenhum) | **Alto** — todas as reservas de todos os anfitriões (preços, datas, notas) |
| `bookings` | `bookings_public_read` | por estado, sem `owner_id` | Alto — mesma exposição, mais restrita por estado |
| `properties` | `properties_public_read` / `public_read_active_properties` (duplicadas) | por `ativo`, sem `owner_id` | Médio — listagem completa de propriedades de todos os anfitriões (nomes, preços, moradas, fotos) |
| `website_settings` | `public_read_website_settings` (antiga, esquecida) + `website_settings_public_read` | `true` / `enabled=true`, sem `owner_id` | Médio — contactos de todos os anfitriões numa query |

**Não houve fuga de dados reais** — verificado por consulta direta: `bookings` e `guests` estavam vazias em produção no momento da auditoria (plataforma pré-lançamento). Mas o mecanismo estava pronto para expor tudo isto ao primeiro hóspede real ou segundo anfitrião. Isto tornava falsa a promessa central do produto ("dados de cada cliente completamente isolados", pedida explicitamente no prompt de arquitetura SaaS).

## Causa raiz
Nenhuma rota de API do produto (auditada exaustivamente, 20 rotas) usa o cliente anon para leitura — todas usam `service_role` com filtro explícito por `owner_id` vindo de `auth()`. As exceções eram exatamente estas duas páginas antigas, que usavam o wrapper `lib/db.ts` (cliente anon) diretamente do browser, um padrão pré-multi-tenant nunca migrado.

## Correção
- **Novo endpoint seguro**: `GET /api/book-confirmation/[bookingId]` — `service_role`, rate-limited (30/min/IP), devolve só os campos que a página de confirmação precisa (nunca `notas` nem dados de outras reservas). Mesmo padrão de capability-URL já usado em `/api/checkin/[bookingId]`.
- `confirmacao/page.tsx` — passou a usar este endpoint em vez de `db.getBookings()`/`db.getProperties()`/`db.getWebsiteSettings()` sem filtro.
- `/book/page.tsx` (catálogo cross-tenant legado) — substituído por página estática sem qualquer acesso à BD; nenhuma rota interna aponta mais para ali.
- Links "voltar"/"ver outros alojamentos" em `BookingClient.tsx`, `RoomsClient.tsx` e `book/[propertyId]/page.tsx` — deixaram de apontar para o catálogo partilhado `/book` e passaram a apontar para `/r/[slug]` do anfitrião correto (corrige também uma falha de UX: um hóspede a reservar com o Anfitrião A nunca devia ser enviado para uma listagem genérica).
- `src/lib/db.ts` — **eliminado** (ficou sem nenhum consumidor após as correções acima).
- `src/lib/color.ts` reaproveitado sem alterações.
- **Migrations** `014_drop_dangerous_anon_select_policies.sql` e `015` (aplicada diretamente, política antiga que tinha escapado à primeira passagem) — removem as 6 políticas RLS `anon` de SELECT listadas acima. As políticas de INSERT (`public_insert_guests`, `public_insert_bookings`), necessárias como fallback do fluxo de reserva, não foram tocadas.
- **Bug funcional apanhado durante a validação**: o novo endpoint `/api/book-confirmation/[bookingId]` ficou inicialmente 404 em produção — faltava adicioná-lo à lista de rotas públicas em `src/proxy.ts` (toda rota é privada por omissão). Corrigido antes de reportar a fase como concluída.

## Validação
- `npm run typecheck` / `lint` / `test` (118/118) — todos limpos após cada alteração.
- Testado diretamente contra o endpoint REST `anon` do Supabase (leitura, sem escrita): `guests`, `bookings`, `properties`, `website_settings` devolvem `[]` para qualquer query sem filtro, antes vazavam a tabela toda.
- Advisor de segurança Supabase: sem novos ERROR/WARN; os WARN/INFO restantes são os já documentados e aceites.
- **Teste ponta-a-ponta em produção** (dados prefixados `TESTE-E2E`, removidos no fim): `POST /api/book` → `GET /api/book-confirmation/[bookingId]` → 200 com os dados corretos. `/r/casadevasco`, `/book/[propertyId]` (com e sem quartos) e `/book` (legado) todos devolvem 200.
- Deploy final em produção confirmado: `https://anfitrioes.pt`.

## Porque isto foi tratado fora de ordem
O roadmap desta sessão previa Fase 1.5 → Fase 2 → Fase 3... Esta correção não estava planeada, mas uma vulnerabilidade de isolamento multi-tenant ativa é, por definição, mais urgente do que qualquer item do roadmap de produto — a "Fase 1.5: fechar fundação" existe precisamente para apanhar isto antes de haver clientes reais. Retomo a Fase 2 (templates) a seguir.
