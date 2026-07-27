# Personas

Detalhe completo em [`SAAS_ARCHITECTURE.md` §1](./SAAS_ARCHITECTURE.md#1-personas): proprietário 1 alojamento, proprietário multi-alojamento, empresa de gestão, hotel boutique/hostel, gestor de equipas.

## Personas adicionais pedidas no prompt mestre, não cobertas ainda

### Agência (revenue manager terceiro, não é dona nem gestora operacional)
- Faz apenas pricing/estratégia para vários proprietários que usam Anfitrião de forma independente.
- Precisa: acesso de leitura + escrita a preços em múltiplas contas não relacionadas entre si, sem ver financeiro/reservas.
- **Implicação:** não cabe no modelo hierárquico de Organizations (persona empresa de gestão, §1.3 do doc principal) porque as contas não pertencem à mesma organização — precisa de um modelo de "convite de colaborador externo por conta", análogo a "partilhar acesso" do Google Docs. Não planeado nas fases atuais; adicionar ao backlog se houver procura confirmada (ver Pendências).

### Investidor (dono de capital, não opera nem gere)
- Não usa o painel operacional — quer visibilidade financeira periódica (ocupação, receita, ROI).
- Precisa: relatório read-only, idealmente por email periódico, não login recorrente na app.
- **Implicação:** resolve-se com um relatório PDF/email agendado (extensão do motor de automações + financeiro, §9 do doc principal), não com um papel RBAC novo — mais barato que dar acesso à app.
