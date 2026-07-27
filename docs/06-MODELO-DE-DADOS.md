# Modelo de Dados

## Schema atual (produção, 12 migrations)
`properties`, `bookings`, `guests`, `tarifas`, `price_rules`, `platform_rates`, `price_change_log`, `website_settings`, `accounts`, `push_subscriptions` — todas com `owner_id` (nullable, preenchido em toda a escrita) e RLS via `requesting_owner_id()`. Ver `supabase/migrations/*.sql` como fonte de verdade — este documento não duplica DDL, só o modelo lógico.

## Extensões planeadas
Tabela completa de novas entidades e propósito: [`SAAS_ARCHITECTURE.md` §7](./SAAS_ARCHITECTURE.md#7--estrutura-de-dados--extensões-necessárias). Extensão de `website_settings` para templates: [`SAAS_ARCHITECTURE.md` §6.1](./SAAS_ARCHITECTURE.md#61-modelo-de-dados-novo).

## Diagrama de relacionamento (entidades core, simplificado)

```
accounts (1) ──< properties (N) ──< bookings (N) >── guests (1)
   │                  │                  │
   │                  ├──< price_rules   ├──< guest_notes (novo)
   │                  ├──< tarifas       └──< cleaning_tasks (novo)
   │                  └──< channel_connections (novo)
   │
   ├──< website_settings (1:1, com template_id → website_templates)
   ├──< team_members (novo, depende de Clerk Organizations)
   ├──< automations (novo) ──< automation_log (novo)
   ├──< notification_preferences (novo, por utilizador)
   └──< expenses (novo)
```

## Regra de ouro (não negociável, já em vigor)
Nenhuma tabela nova é criada sem `owner_id` + RLS correspondente. Nenhuma exceção — ver `docs/18-MANUAL-TECNICO.md`.
