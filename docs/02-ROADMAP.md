# Roadmap — Índice

Roadmap completo por fases: [`SAAS_ARCHITECTURE.md` §12](./SAAS_ARCHITECTURE.md#12-roadmap).

## Estado de execução
Ver `TODO.md` (raiz do projeto) para o estado vivo, atualizado a cada sessão — este ficheiro descreve o plano, `TODO.md` descreve o progresso real.

## Riscos identificados por fase

| Fase | Risco principal | Mitigação |
|---|---|---|
| 1.5 | Clerk JWT template não confirmado ativo — RLS client-side pode não estar realmente a filtrar | Verificar antes de qualquer campanha de aquisição |
| 2 | Sistema de templates subestimado em esforço (é o maior item novo do roadmap) | Lançar com 4-6 templates, não 12; validar com clientes reais antes de expandir |
| 3 | RBAC (Clerk Organizations) pode exigir mudanças de schema em cascata (`owner_id` → conceito de "conta" vs "utilizador") | Prototipar em branch isolado antes de aplicar a produção |
| 4 | Candidatura a Airbnb API/Booking Connectivity Partner é processo de negócio com prazo fora do nosso controlo | Não bloquear lançamento comercial a esta aprovação — iCal já cobre o essencial |
