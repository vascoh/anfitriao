# TODO — Estado do Projeto

_Ficheiro vivo. Atualizar no fim de cada fase, junto com `CHANGELOG_PHASE_XX.md`. Roadmap completo em `docs/02-ROADMAP.md` / `docs/SAAS_ARCHITECTURE.md` §12._

> ⚠️ **2026-08-02** — `docs/DOSSIE-ESTRATEGICO-2026-08.md` substitui a tese central do `PLANO-ESTRATEGICO-2026.md`. Três correções que alteram prioridades: (1) a conformidade PT **não** é um fosso vazio — EazyAL e Hostkit já a entregam; (2) o **SIBA tem web service público** e as credenciais são do anfitrião, obtidas no portal em 1–3 dias úteis — a "pendência AIMA" abaixo é falsa; (3) a landing v2 promete caixa de entrada unificada e contrato eletrónico, que não existem.

## Fase 0 — Planeamento ✅ (2026-07-26)
- [x] Auditoria completa do projeto existente
- [x] `docs/SAAS_ARCHITECTURE.md` (arquitetura funcional e técnica completa)
- [x] Suite `/docs` (visão, personas, fluxos, modelo de dados, APIs, integrações, segurança, deploy, SEO, comercial, marketing, preços, checklist, manuais)
- [x] Correção: export iCal por propriedade já estava implementado (doc inicial tinha-o como gap — corrigido)

## Fase 1.5 — Fechar fundação ✅ (2026-07-26, ver `CHANGELOG_PHASE_02.md`)
- [x] Notificações — sistema de preferências por utilizador (`notification_preferences`) — `CHANGELOG_PHASE_01.md`
- [x] `MAINTENANCE_MODE` confirmado `false` em produção (verificado por HTTP: `/` e `/sign-up` devolvem 200 sem redirect para `/em-construcao`)
- [x] Auditoria de isolamento multi-tenant: **correção de risco** — `requesting_owner_id()`/RLS via JWT Clerk nunca chegou a ser ligado (`getSupabaseForRequest` é código morto, zero chamadas). O isolamento real em produção é `service_role` + filtro `.eq('owner_id', userId)` com `userId` sempre vindo de `auth()` server-side — auditado em todas as 20 rotas de API, consistente em 100%. Já não é bloqueante para lançamento (downgrade de 🔴 crítico para 🟡 defesa em profundidade recomendada).
- [ ] **Pendência humana**: decidir se vale a pena ativar o Clerk JWT template como camada extra de defesa (RLS a nível de BD), ou remover o código morto (`getSupabaseUserClient`/`getSupabaseForRequest`) — ver `docs/SAAS_ARCHITECTURE.md` §13
- [x] Onboarding ponta-a-ponta testado E2E em produção (2026-07-27): conta Clerk descartável → `ensureAccount` na primeira visita a `/hoje` → propriedade → ativar website + slug próprio → site público em `/r/[slug]` → hóspede pede reserva (`/book/[id]`) → check-in online (dados SIBA preenchidos e gravados) → tudo confirmado na BD. Dados de teste e utilizador Clerk removidos no final. **Bug crítico encontrado e corrigido no mesmo incremento**: `website_settings.id` tinha `DEFAULT 1` fixo (não sequência) desde a migração para multi-tenant — toda conta nova falhava ao gravar `/website` pela primeira vez (23505 na PK, mascarado como "URL já em uso"). Nenhuma conta nova tinha conseguido publicar o site até agora. Corrigido (migration 026 + mapeamento de erro em `api/website-settings`)

## Fora de ordem — Correção crítica de segurança ✅ (2026-07-26, ver `CHANGELOG_PHASE_04.md`)
- [x] RLS `anon` totalmente aberto em `guests` (incluía SIBA/SEF), `bookings` e `properties`/`website_settings` sem filtro por `owner_id` — encontrado ao auditar código morto, corrigido (migrations 014+015), validado ao vivo (leitura anon), sem fuga real detetada (tabelas vazias no momento)
- [x] `/book` (catálogo cross-tenant legado) substituído; `lib/db.ts` eliminado (sem consumidores)
- [x] Novo endpoint seguro `/api/book-confirmation/[bookingId]` (service_role, rate-limited) substitui leituras anon na página de confirmação
- [x] Teste E2E em produção (dados `TESTE-E2E`, removidos) confirma o fluxo completo intacto

## Fase 2 — Templates + SEO por tenant (em curso)
- [x] Correção: `cor_primaria` já existia (branding de email) mas não estava ligada ao site público — agora aplica-se a `/r/[slug]` via CSS var `--primary` — ver `CHANGELOG_PHASE_03.md`
- [x] Tema aplicado a `/book/[propertyId]` (`BookingClient`/`RoomsClient`) — feito no mesmo incremento do tema (`CHANGELOG_PHASE_05.md`), checkbox não tinha sido atualizado
- [x] `website_templates` (catálogo) + `template_id`/`fonte`/`secoes` em `website_settings` — mecanismo completo, 2 templates (Clássico/Minimal), tipografia configurável, FAQ configurável — ver `CHANGELOG_PHASE_05.md`
- [ ] Mais templates além dos 2 iniciais (validar com uso real antes de expandir, per roadmap)
- [x] Páginas adicionais por tenant: Sobre, Galeria (1 foto/propriedade), Localização, Privacidade, Cookies, Termos — ver `CHANGELOG_PHASE_06.md`
- [x] Galeria multi-foto por propriedade (`properties.fotos`, URL-based) — ver `CHANGELOG_PHASE_07.md`
- [x] Blog por cliente (tenant) — tabela `posts`, editor em `(app)/blog` (reaproveita `/api/upload` para a capa), rotas públicas `/r/[slug]/blog` + `/r/[slug]/blog/[postSlug]`, conteúdo em texto simples (sem markdown/HTML, decisão deliberada de simplicidade). Testado E2E em produção (criar, publicar, ver no site público, imagem de capa a renderizar). Blog institucional (`anfitrioes.pt`, ver `docs/13-ESTRATEGIA-MARKETING.md`) fica fora de âmbito por agora — decisão explícita, não usa o mesmo motor ainda
- [x] Upload de ficheiros para fotos — Vercel Blob Store criada (`anfitriao-fotos`, acesso público) e `BLOB_READ_WRITE_TOKEN` ligado em produção/preview/development; botão de upload em `propriedades/nova` e `propriedades/[id]/editar` (foto principal + galeria), URL continua disponível como alternativa. Testado E2E em produção com sessão Clerk real: upload, gravação e visualização da foto confirmados (dados de teste `TESTE-E2E` removidos, incl. blobs órfãos). Corrigido em simultâneo: CSP `img-src` e `images.remotePatterns` não incluíam o domínio do Blob — a foto ficava guardada mas invisível até este fix
- [~] Sitemap + Schema.org por tenant — mecanismo completo e testado: `/r/[slug]/sitemap.xml` (home + páginas + reservas ativas + posts), `robots.ts` raiz lista um sitemap por tenant ativo, Schema.org `LodgingBusiness` (JSON-LD) na homepage. **Bug crítico encontrado e corrigido no mesmo incremento** (não relacionado com o `noindex`): `/robots.txt` e `/sitemap.xml` raiz estavam bloqueados pelo middleware do Clerk desde a sua criação original (nunca estiveram na lista de rotas públicas) — o Google nunca tinha conseguido ler nenhum dos dois em produção. Corrigido em `src/proxy.ts`, mantém-se corrigido. **Indexação das páginas `/r/[slug]` revertida para `noindex` (2026-07-27, mesmo dia): decisão do utilizador de não colocar o site no Google enquanto não estiver finalizado e aprovado.** Reativar (trocar `noindex`→`index` nos 9 `generateMetadata` de `src/app/r/[slug]/**`) só quando o utilizador aprovar

## Fase 3 — Operação e retenção (em curso)
- [x] CRM — já existia (tags/notas/histórico em `hospedes/[id]`), corrigida a avaliação em `SAAS_ARCHITECTURE.md`
- [x] Financeiro: despesas + KPI de lucro (`/financeiro`, `expenses`) — ver `CHANGELOG_PHASE_08.md`
- [x] Comissões por plataforma no financeiro (2026-07-27) — `platform_rates.comissao_pct` já existia (editável em Preços → Plataformas) mas nunca era lido em lado nenhum; agora `/financeiro` estima a comissão retida por reserva indireta com preço registado, agrupada por plataforma, e mostra lucro líquido após comissões. Testado E2E em produção (conta descartável: reserva Airbnb 300€ × 15% → 45€ comissão, 255€ lucro líquido, confirmado). Reservas iCal chegam com `preco_total=0` (iCal não expõe preço) — só estima depois do anfitrião corrigir o valor manualmente. IVA e exportação Excel/PDF continuam por fazer (IVA depende de decisão sobre regime fiscal; .xlsx/PDF adiados, CSV já cobre a necessidade)
- [~] RBAC (Clerk Organizations) — **decisão (2026-07-26): adiado até haver procura real confirmada** (prospect concreto de empresa de gestão). Mudança de arquitetura grande (auth + todas as políticas RLS + UI nova) sem valor para os clientes atuais (proprietário 1/multi-alojamento já servidos pelo modelo 1-conta-1-dono). Não fecha portas: o padrão RLS atual não impede adicionar RBAC mais tarde.
- [x] Motor de automações (`automations`/`automation_log`, cron diário, 3 gatilhos: check-in amanhã/checkout hoje/pedir avaliação, ação email ao hóspede) + preview da mensagem — ver `CHANGELOG_PHASE_09.md` e `CHANGELOG_PHASE_15.md`. Falta: ações push/WhatsApp (exigem infraestrutura nova)
- [x] Exportação CSV no financeiro (`CHANGELOG_PHASE_15.md`) — .xlsx/PDF binários adiados (exigiriam nova dependência para ganho marginal sobre CSV)
- [x] Audit log genérico — mudanças de estado/plano de conta (billing + admin) e eliminação de propriedades — ver `CHANGELOG_PHASE_10.md`. Só ações sensíveis/irreversíveis, não instrumentação total (deliberado)
- [ ] 2FA (ativar Clerk MFA — configuração no Clerk Dashboard, não código)

## Fase 4 — Crescimento e canais reais (em curso)
- [x] Multi-idioma nos sites de clientes (PT/EN) — chrome + homepage traduzidos, seletor em `/website` — ver `CHANGELOG_PHASE_11.md`. Falta: emails, páginas Sobre/Galeria/Localização/legal
- [x] Dashboard super-admin — KPI de MRR adicionado a `/admin/contas`
- [ ] Wildcard subdomínio + custom domain — **bloqueado**: exige upgrade pago a Vercel Pro (pendência #6, decisão de orçamento)
- [ ] `ChannelAdapter` + candidatura a Booking Connectivity Partner / Airbnb API — **adiado deliberadamente** (mesma lógica do RBAC: sem parceria real, é trabalho especulativo)
- [ ] Webhooks / API pública — adiado até haver parceiro real a pedir

## Fase — Revisão checkout/SIBA/documentos (2026-07-27)
- [x] Checkout Stripe Connect + confirmação de reserva — auditado, completo e sem falhas encontradas (charge direta na conta do anfitrião, webhook + fallback idempotentes, reembolso automático em conflito)
- [x] OCR de documentos no check-in — já existia (`/api/documentos/extrair`), confirmado a funcionar; decisão: não persistir a foto (privacidade)
- [x] Scaffolding para submissão automática SIBA/AIMA — `lib/siba-api.ts` (adapter placeholder), `lib/siba-fetch.ts` (query partilhada com o export CSV), `/api/siba-submit`, colunas `siba_status`/`siba_reference`/`siba_error` em `bookings` (migration 024), botão "Submeter à AIMA" em `/documentos`
- [x] ~~**Pendência humana**: obter credenciais/documentação técnica oficial da API SIBA junto da AIMA~~ — **premissa errada, resolvida a 2026-08-02**. O SIBA tem web service público e documentado (`https://siba.ssi.gov.pt/baws/boletinsalojamento.asmx?WSDL`, método `EntregaBoletinsAlojamento`) e as credenciais são **do anfitrião, por estabelecimento**, não da plataforma. Implementado: `lib/siba-xml.ts` (formato `MovimentoBAL`, envelope SOAP, leitura da resposta), `lib/siba-mapping.ts` (tradução dos dados da app para os códigos do SIBA), `lib/siba-api.ts` (cliente com 3 tentativas e recuo exponencial), `lib/crypto.ts` (AES-256-GCM para a chave de acesso), migrações 030/031, formulário em `/conformidade` e prova de submissão em `siba_submissoes`. 90 testes novos.
- [ ] **Pendência humana (a que resta)**: (1) definir `APP_ENCRYPTION_KEY` em produção (`openssl rand -base64 32`) — sem ela a app recusa guardar a chave de acesso; (2) registar cada alojamento no portal SIBA escolhendo o modo de envio "Web Service" e introduzir NIPC, número de estabelecimento e chave em `/conformidade` (o SEF/AIMA responde em 1–3 dias úteis); (3) validar contra o ambiente de testes (`SIBA_WS_URL` → `/bawsdev/`) antes do primeiro envio real

## Fase 2 (plano estratégico) — RGPD ✅ (2026-07-30)
- [x] **2.16 / ANF-1.10, 1.11, 1.12** — retenção aplicada por código (`lib/retencao.ts` + cron diário às 03:00), exportação e apagamento a pedido (`/api/guests/[id]/dados`, art. 15.º/17.º/20.º) e registo de atividades de tratamento (`docs/RGPD-REGISTO-TRATAMENTOS.md`, art. 30.º). Anonimiza em vez de apagar — a reserva tem de ser conservada 10 anos (art. 52.º do CIVA). Migração 029 aplicada em produção.
- [ ] **Pendência humana**: prazo de conservação dos dados da conta após cancelamento e do `audit_log` — os únicos campos que faltam ao registo de tratamentos e à política de privacidade nesta matéria
- [ ] Falta da mesma família (não feito neste incremento): encriptação em repouso dos campos de documento (ANF-1.7) e log de acesso a dados sensíveis (ANF-1.8)

## Pendências para Validação Humana (não bloqueiam desenvolvimento)
Ver `docs/SAAS_ARCHITECTURE.md` §13 — lista viva, atualizada conforme surgem novas decisões de negócio:
1. Prioridade de fase (recomendação: fundação → templates → RBAC → canais reais)
2. Preços finais por plano (`docs/14-MODELO-PRECOS.md`)
3. ~~Investir em RBAC já na Fase 3, ou adiar?~~ — **decidido (2026-07-26): adiado** até haver procura real confirmada, ver Fase 3 acima
4. Quando abrir candidatura a Airbnb API / Booking Connectivity Partner
5. Domínio definitivo: `anfitriao.pt` vs `anfitrioes.pt`
6. Orçamento Vercel Pro / Supabase Pro (necessário para Fase 2/4)
7. MBWay requer PSP adicional (Ifthenpay/SIBS) — vale o custo? (`docs/08-INTEGRACOES.md`)
8. Os sites `/r/[slug]` devem passar a ser indexáveis pelo Google? — **decidido (2026-07-27): sim, mas só depois do utilizador aprovar o site finalizado**; mecanismo pronto (sitemap/Schema.org), `noindex` mantido por agora, ver Fase 2 acima
