# Arquitetura — Índice

Arquitetura completa (diagrama, stack, decisões, channel manager, escalabilidade, segurança): [`SAAS_ARCHITECTURE.md`](./SAAS_ARCHITECTURE.md).

Este ficheiro cobre apenas a decisão que o prompt mestre pediu explicitamente e que não estava detalhada: **estratégia de isolamento multi-tenant**.

## Isolamento multi-tenant: Shared DB, Shared Schema (decisão tomada e já implementada)

| Abordagem | Isolamento | Custo operacional | Escalabilidade | Migrações |
|---|---|---|---|---|
| **Shared DB + Shared Schema + RLS** (escolhida) | Lógico, via `owner_id` + Postgres RLS | Baixo — 1 base de dados a gerir, monitorizar, fazer backup | Nativa até dezenas de milhares de tenants (índices em `owner_id`) | 1 migration aplica-se a todos os tenants instantaneamente |
| Shared DB + Schema por tenant | Forte (schema separado) | Médio — centenas/milhares de schemas tornam-se difíceis de migrar em massa (Postgres não pensado para isto a esta escala) | Degrada acima de ~1000 tenants (catálogo de schemas, connection overhead) | Precisa de correr por schema — lento e frágil a milhares |
| Base de dados separada por tenant | Máximo | Alto — 1 conexão/backup/monitorização por tenant | Não escala operacionalmente sem plataforma dedicada de orquestração (custo de equipa que não existe aqui) | Idem, multiplicado por base de dados |

**Justificação da escolha:** o produto já tem RLS hardened e validado em produção (`008_rls_owner_isolation.sql` a `011_...sql`, 0 ERROR no advisor de segurança). Trocar de estratégia agora destruiria trabalho de segurança já auditado, sem ganho de isolamento percetível para o cliente — RLS a nível de Postgres é o mesmo mecanismo que Stripe, Supabase e a generalidade dos SaaS B2B usam até escala muito superior à que este produto vai atingir nos próximos anos. Reavaliar apenas se surgir requisito contratual de **residência de dados por cliente** (ex.: cliente enterprise que exige base de dados fisicamente isolada) — nesse caso, isolar *esse* tenant específico, não migrar a plataforma inteira.

## Isolamento de configuração/branding/templates/API keys por tenant
Todos vivem como colunas/tabelas com `owner_id` (`website_settings`, futura `channel_connections`, futura `automations`) — mesmo mecanismo RLS, sem exceção. API keys de integrações de terceiros por tenant (ex.: uma futura ligação direta a um PMS externo) devem ser encriptadas em repouso (`pgsodium`/Supabase Vault), nunca em texto simples — item a aplicar quando a primeira integração desse tipo for construída.
