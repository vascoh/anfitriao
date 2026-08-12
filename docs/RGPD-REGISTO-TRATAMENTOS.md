# Registo de atividades de tratamento

_RGPD art. 30.º · atualizado em 2026-07-30_

Documento vivo. **Atualizar sempre que se acrescente uma tabela com dados
pessoais, um subcontratante ou uma finalidade nova** — um registo desatualizado
é pior do que nenhum, porque documenta uma realidade que já não existe.

Não é aconselhamento jurídico: é a descrição do que o sistema faz, derivada do
esquema da base de dados e do código, para servir de base à revisão por
advogado (pendência humana H10).

---

## 0. Os dois papéis

| Dados | Responsável | Subcontratante |
|---|---|---|
| Do anfitrião (conta, faturação, uso da plataforma) | Anfitrião *(a plataforma)* | — |
| Dos hóspedes (reserva, boletim, contactos) | O anfitrião cliente | A plataforma |

Consequência prática: quando um hóspede exerce direitos, responde **o
anfitrião**. A plataforma dá-lhe as ferramentas (exportação e apagamento na
ficha do hóspede) e cumpre as instruções dele. Está dito assim em `/privacidade`.

**Identificação do responsável, contactos e encarregado de proteção de dados:**
por preencher — depende da denominação social e do NIF, os mesmos campos que
faltam nas páginas legais.

---

## 1. Gestão de contas de anfitriões

- **Finalidade:** prestar o serviço, faturar, comunicar com o cliente.
- **Fundamento:** execução do contrato (art. 6.º n.º 1 al. b).
- **Titulares:** anfitriões (clientes).
- **Categorias:** nome, email, plano, estado da subscrição, identificadores
  Stripe. Autenticação e palavras-passe são do Clerk — nunca chegam à nossa base.
- **Onde:** `accounts`, `notification_preferences`, `push_subscriptions`.
- **Conservação:** enquanto a conta existir. Após cancelamento, por preencher
  *(decisão pendente)*; os documentos fiscais seguem o prazo do ponto 4.
- **Destinatários:** Clerk (autenticação), Stripe (pagamentos), Supabase
  (base de dados), Vercel (alojamento), Resend (email).

## 2. Gestão de reservas

- **Finalidade:** registar e gerir estadias, comunicar com o hóspede.
- **Fundamento:** execução do contrato com o hóspede (art. 6.º n.º 1 al. b);
  interesse legítimo do anfitrião para o histórico (al. f).
- **Titulares:** hóspedes.
- **Categorias:** nome, email, telefone, datas, número de pessoas, valores,
  notas do anfitrião, etiquetas.
- **Onde:** `guests`, `bookings`, `automation_log`.
- **Conservação:** nome e contactos, **3 anos** após a última estadia
  (`PRAZOS.contacto` em `src/lib/retencao.ts`). Valores e datas seguem o
  ponto 4.
- **Destinatários:** Supabase, Vercel, Resend.

## 3. Boletim de alojamento (SIBA/AIMA)

- **Finalidade:** cumprir a obrigação de comunicação de hóspedes às autoridades.
- **Fundamento:** obrigação jurídica (art. 6.º n.º 1 al. c), Lei 23/2007 art. 16.º.
- **Titulares:** hóspedes estrangeiros e nacionais, conforme a lei.
- **Categorias:** documento de identificação (tipo, número, validade, país de
  emissão), data de nascimento, sexo, nacionalidade.
  **Não se conserva a fotografia do documento** — o OCR extrai os campos e a
  imagem é descartada (decisão de minimização, `/api/documentos/extrair`).
- **Onde:** `guests`.
- **Conservação:** **1 ano** após a saída (`PRAZOS.boletim`), findo o qual os
  campos são anonimizados automaticamente.
- **Destinatários:** AIMA/SEF (por exportação CSV feita pelo anfitrião; a
  submissão automática ainda não está ligada), Supabase, Vercel.
- **Nota:** não são dados de categoria especial (art. 9.º) enquanto não houver
  biometria. Se um dia se guardar selfie ou verificação facial, esta entrada
  muda de regime e exige consentimento explícito.

## 4. Faturação e obrigações fiscais

- **Finalidade:** emitir e conservar documentos fiscais.
- **Fundamento:** obrigação jurídica (art. 6.º n.º 1 al. c).
- **Titulares:** anfitriões e hóspedes.
- **Categorias:** valores, datas, número e ATCUD da fatura, referência ao
  documento no fornecedor certificado.
- **Onde:** `bookings` (campos `fatura_*`), `expenses`; o documento em si vive
  no fornecedor certificado (InvoiceXpress), não aqui.
- **Conservação:** **10 anos** (art. 52.º do CIVA). **Imune à retenção
  automática** — é a razão de se anonimizar o hóspede em vez de o apagar.
- **Destinatários:** fornecedor de faturação certificado, Stripe, AT.

## 5. Comunicações automáticas

- **Finalidade:** emails transacionais ao hóspede e ao anfitrião (confirmações,
  lembretes, alertas de conformidade, relatório mensal).
- **Fundamento:** execução do contrato; interesse legítimo nos avisos ao
  anfitrião.
- **Categorias:** email, nome, dados da reserva citados na mensagem.
- **Onde:** `automations`, `automation_log`; o envio é do Resend.
- **Conservação:** o registo de execução fica com a reserva; o conteúdo não é
  arquivado por nós.
- **Nota factual:** à data deste documento **não sai nenhum email de produção**
  — falta a chave do Resend. Ver `PROGRESS.md`, 2026-07-30.

## 6. Concierge com IA

- **Finalidade:** redigir respostas sugeridas ao hóspede.
- **Fundamento:** interesse legítimo do anfitrião.
- **Categorias:** o texto da mensagem e o contexto da reserva que o anfitrião
  enviar.
- **Destinatário:** Anthropic. Os dados servem para gerar a resposta pedida e
  não para treinar modelos.
- **Conservação:** nada é guardado do nosso lado.

## 7. Auditoria e segurança

- **Finalidade:** prova de ações sensíveis e irreversíveis (mudanças de plano,
  eliminações, anonimizações).
- **Fundamento:** interesse legítimo; art. 5.º n.º 2 (responsabilidade).
- **Categorias:** identificador do autor, entidade, ação, data.
- **Onde:** `audit_log`.
- **Conservação:** por definir *(decisão pendente)*. Deliberadamente não
  instrumentamos tudo — só o que é sensível.

---

## Medidas técnicas e organizativas (art. 32.º)

| Medida | Estado |
|---|---|
| Encriptação em trânsito (TLS) | ✅ |
| Isolamento por conta em todas as rotas de API | ✅ `service_role` + filtro `owner_id` |
| RLS por `owner_id` a nível de base de dados | ⚠️ Por ligar — exige o JWT template do Clerk (ANF-1.4) |
| Retenção aplicada por código | ✅ `src/lib/retencao.ts` + cron diário |
| Exportação e apagamento a pedido | ✅ `/api/guests/[id]/dados` |
| Registo de ações sensíveis | ✅ `audit_log` |
| Minimização no OCR (foto não persistida) | ✅ |
| Encriptação em repouso dos campos de documento | ✅ AES-256-GCM em `numero_documento` e `data_validade_doc` (`src/lib/campos-sensiveis.ts`) |
| Log de saída de dados de documento (CSV, SIBA, art. 15.º) | ✅ `audit_log`, ação `acesso_dados_documento` |
| Log de consulta na app (quem abriu que ficha) | ⚠️ Não registado, por decisão — ver nota abaixo |
| MFA nas contas de anfitrião | ❌ Por ativar no Clerk (ANF-1.9) |

**Sobre a encriptação em repouso.** Encriptam-se os campos que identificam o
documento — número e validade —, não a ficha inteira. É neles que está o dano
de uma fuga: com nome e número de documento abre-se crédito e faz-se check-in
noutro sítio. Nome, nacionalidade e data de nascimento ficam legíveis na base
porque a aplicação filtra e ordena por eles, e encriptá-los daria a mesma
proteção real (quem tenha a base tem os nomes na mesma, pelas reservas) ao
preço de partir metade do produto. A chave vive em `APP_ENCRYPTION_KEY`, fora
da base de dados: quem obtenha uma cópia do Postgres não obtém os números.

**Sobre o log de acesso.** Regista-se o que **sai** do sistema — o CSV
descarregado, os boletins entregues ao SIBA, o ficheiro do art. 15.º — e não
cada ficha aberta na aplicação. Ver os dados dos seus hóspedes é o trabalho
normal de um anfitrião; um registo que cresce a cada página aberta deixa de se
conseguir ler no dia em que for preciso. O que se quer poder responder é
"quem levou estes dados para fora, e quando".

## Transferências para fora do EEE

Alguns subcontratantes podem tratar dados fora do Espaço Económico Europeu, ao
abrigo de cláusulas contratuais tipo. **A região exata dos projetos Supabase e
Vercel está por confirmar** — é um dos campos por preencher na política de
privacidade e deve ser verificada nos respetivos painéis, não assumida.
