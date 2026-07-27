# APIs

## Estado atual
API interna (Route Handlers Next.js), consumida pelo próprio frontend — não é ainda uma API pública versionada para parceiros/marketplace/SDK. Padrão atual: REST-like, autenticação Clerk (sessão) para rotas privadas, `service_role` para automações internas, rate-limit + validação para rotas públicas (`/api/book`, `/api/checkin/[id]`, `/api/ical/[propertyId]`).

## Rotas existentes (inventário)
`api/book`, `api/bookings`, `api/checkin/[bookingId]`, `api/concierge`, `api/cron/*`, `api/documentos/extrair`, `api/guests`, `api/ical/[propertyId]` (export), `api/ical-proxy`, `api/ical-sync` (import), `api/notify-confirmation`, `api/og`, `api/platform-rates`, `api/price-change-log`, `api/price-rules`, `api/properties`, `api/push`, `api/pwa-icon`, `api/siba-export`, `api/stripe/*`, `api/tarifas`, `api/website-settings`.

## Requisitos para "API preparada para parceiros/marketplace/SDK" (pedido no prompt mestre)
Isto é um produto novo dentro do produto — API pública requer: autenticação por API key (não sessão Clerk), versionamento (`/api/v1/...`), rate-limit por tenant (não só por IP), documentação OpenAPI, e um caso de uso real que a justifique (nenhum parceiro identificado ainda). **Não construir especulativamente** — adicionar ao roadmap só quando houver um primeiro parceiro/integração concreta a pedir acesso (webhooks de reserva são o candidato mais provável: notificar sistemas externos de contabilidade/PMS quando uma reserva é criada).

## Webhooks (candidato mais próximo de necessidade real)
Padrão proposto quando construído: tabela `webhook_subscriptions` (`owner_id`, `url`, `eventos[]`, `secret` para assinatura HMAC), disparado pelo mesmo motor de automações (`SAAS_ARCHITECTURE.md` §9) como mais um tipo de "ação".

## Documentação OpenAPI
Adiada até existir API pública real — documentar rotas internas em OpenAPI antes disso teria custo de manutenção sem consumidor externo.
