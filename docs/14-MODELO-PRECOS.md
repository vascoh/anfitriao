# Modelo de Preços

## Estado atual
Stripe já implementado em produção com Price IDs próprios (`(app)/conta/billing`, `api/stripe/*`). `PRODUCAO.md` (2026-05-26) sugeria Grátis/€19/€39 — **confirmar contra os Price IDs reais em produção antes de publicar qualquer preço em marketing** (pendência listada em `SAAS_ARCHITECTURE.md` §13, item 2).

## Estrutura proposta (a validar com o cliente — pendência de negócio)

| Plano | Alvo | Limites propostos |
|---|---|---|
| Grátis | Experimentação | 1 propriedade, funcionalidades core, sem website customizável |
| Starter | Persona 1.1 (1 alojamento) | Propriedade(s) ilimitadas até N, template básico, canais iCal ilimitados |
| Pro | Persona 1.2 (multi-alojamento) | Tudo do Starter + relatórios avançados, templates premium, domínio próprio |
| Business (futuro, pós-RBAC) | Persona 1.3 (empresa de gestão) | Multi-utilizador, relatórios por proprietário, faturação B2B |

## Princípio de pricing
0% de comissão sobre reservas diretas é inegociável como proposta de valor (diferenciador vs. Airbnb/Booking) — a monetização é por assinatura, nunca por percentagem de reserva.

## Pendência
Valores finais e limites exatos por plano exigem decisão de negócio — não bloqueiam desenvolvimento (a infraestrutura de billing já suporta qualquer valor/limite via Stripe).
