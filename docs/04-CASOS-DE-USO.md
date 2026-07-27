# Casos de Uso

Formato: ator → objetivo → pré-condições → fluxo → resultado. Casos já suportados pelo produto atual (não gaps).

## UC1 — Anfitrião regista nova reserva manual
**Ator:** proprietário. **Pré-condição:** propriedade criada. **Fluxo:** `Reservas → Nova` → preenche datas/hóspede → sistema valida conflito de calendário → grava. **Resultado:** reserva visível em `Hoje`/`Calendário`, email de confirmação opcional.

## UC2 — Hóspede reserva diretamente pelo site do anfitrião
**Ator:** hóspede anónimo. **Fluxo:** `/r/[slug] → /book/[propertyId]` → preenche formulário → `POST /api/book` (validado, rate-limited, whitelist de campos) → email de confirmação server-side. **Resultado:** reserva com `origem='direto'`, 0% comissão.

## UC3 — Hóspede faz check-in online com SIBA
**Ator:** hóspede com reserva confirmada. **Fluxo:** acede a `/checkin/[bookingId]` (capability URL) → submete documento → OCR extrai dados (`api/documentos/extrair`) → dados prontos para exportação SIBA/SEF. **Resultado:** anfitrião exporta CSV para o portal SEF sem digitação manual.

## UC4 — Anfitrião evita overbooking entre canais
**Ator:** proprietário com Airbnb + Booking + site próprio. **Fluxo:** cola feed iCal do Airbnb/Booking em `Propriedade → Sincronização` → sistema importa periodicamente → conflitos bloqueados no calendário local; anfitrião cola o feed de export do Anfitrião no Airbnb/Booking para o inverso. **Resultado:** disponibilidade coerente nos 3 canais, com atraso de minutos-horas (não tempo real — ver `SAAS_ARCHITECTURE.md` §5).

## UC5 — Anfitrião consulta desempenho do mês
**Ator:** proprietário. **Fluxo:** `Relatórios` → seleciona período → vê ocupação/receita. **Resultado:** decisão informada de preços.

## Casos de uso ainda não suportados (gaps, ver roadmap)
- UC6 — Empresa de gestão vê relatório consolidado por proprietário-cliente (requer RBAC/Organizations, Fase 3).
- UC7 — Anfitrião cria automação "enviar código da porta 2h antes do check-in" (requer motor de automações, Fase 3).
- UC8 — Anfitrião troca de template do site sem perder conteúdo (requer sistema de templates, Fase 2).
