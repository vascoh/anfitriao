# Fluxos

Fluxos principais (onboarding, reserva direta, channel manager, automações) em [`SAAS_ARCHITECTURE.md` §2](./SAAS_ARCHITECTURE.md#2-fluxos-principais).

## Fluxo adicional: confirmação de email no registo

O prompt mestre pede explicitamente "Confirmação Email" entre Registo e Escolha de Plano. Clerk já trata verificação de email nativamente no fluxo de sign-up (`(auth)/sign-up`) — não requer construção própria. Confirmar que a verificação está **obrigatória** (não opcional) antes de avançar para escolha de plano é uma configuração no Clerk Dashboard, não código.

```
Registo (Clerk)
  ↓
Verificação de email (nativa Clerk — confirmar enforced=true)
  ↓
Escolha do plano → Stripe Checkout
  ↓
[resto do fluxo em SAAS_ARCHITECTURE.md §2.1]
```

## Fluxo: gestão diária (equipa de limpeza) — depende de RBAC (Fase 3)

```
Checkout de uma reserva confirmado
  ↓
cleaning_tasks criada automaticamente (trigger ou automação) para a propriedade
  ↓
Atribuída a um team_member com papel 'limpeza' (round-robin ou manual)
  ↓
Notificação push ao funcionário (não ao dono)
  ↓
Funcionário marca tarefa concluída na app (acesso restrito só a cleaning_tasks do dia)
  ↓
Dono vê estado em tempo real no dashboard de limpeza
```
