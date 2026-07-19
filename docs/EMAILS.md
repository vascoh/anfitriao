# Arquitetura de emails

Toda a camada vive em `src/lib/email/`. **Nenhum código fora dela importa o SDK do Resend** — todo o envio passa pelo `emailService`.

## Dois tipos de email (nunca confundir)

| | Emails da plataforma | Emails dos alojamentos |
|---|---|---|
| Exemplos | trial a expirar, notificações do painel ao anfitrião | pedido/confirmação de reserva, lembrete de pagamento ao hóspede |
| From | `Anfitriões <noreply@anfitrioes.pt>` | `Casa de Vasco via Anfitriões <noreply@anfitrioes.pt>` |
| Reply-To | — | email de reservas do alojamento (`website_settings.email_reservas` → `email`) |

O envio é **sempre** pelo domínio da plataforma. O domínio do cliente nunca entra no From — zero configuração SPF/DKIM/DMARC para clientes; as respostas chegam-lhes via Reply-To.

Registo de conta, verificação de email e recuperação de password são enviados pelo **Clerk**; faturas pelo **Stripe** — não passam por esta camada.

## Estrutura

```
src/lib/email/
  config.ts        PLATFORM_NAME, EMAIL_FROM/SUPPORT/SYSTEM (só env), platformFrom(), propertyFrom()
  types.ts         EmailIdentity, EmailMessage, EmailProvider, SendResult
  providers/       interface + ResendProvider (+ NoopProvider sem API key)
  identity.ts      EmailIdentity por anfitrião, derivada de website_settings
  templates/       layout.ts (shell + blocos) + templates por fluxo
  service.ts       EmailService — ponto único de envio
  index.ts         API pública
```

## EmailIdentity (por anfitrião, editável em /website)

`displayName`, `replyTo` (email_reservas→email), `logoText`, `primaryColor`/`secondaryColor` (hex validado; default terracotta), `signature`, `contact`, `language`. Colunas novas em `website_settings`: `cor_primaria`, `cor_secundaria`, `idioma`, `email_reservas`, `assinatura_email`.

## Métodos do EmailService

`sendReservationRequest`, `sendReservationConfirmation`, `sendOwnerNotification`, `sendCheckinComplete`, `sendPaymentReminder`, `sendTrialEnding`, `sendTrialExpired`.

Para adicionar um fluxo (ex.: reserva cancelada): template em `templates/` usando os blocos do `layout.ts` + método de ~15 linhas no `service.ts`. Para trocar de provider (SES, SendGrid…): nova classe em `providers/` que implemente `EmailProvider` e seleção em `providers/index.ts`.

## Variáveis de ambiente

- `RESEND_API_KEY` — sem ela, NoopProvider (não envia, não falha)
- `EMAIL_FROM` — **obrigatória em produção**, domínio verificado no Resend (ex.: `noreply@anfitrioes.pt`); fallback dev: sandbox `onboarding@resend.dev`
- `EMAIL_FROM_NAME` (default `Anfitriões`), `EMAIL_SUPPORT`, `EMAIL_SYSTEM`
- Removidas: `NOTIFY_EMAIL` (bug multi-tenant — desviava as notificações de todos os anfitriões para uma caixa única); `NOTIFY_FROM` (lida só como compat para extrair o endereço)

Todos os templates terminam com "Powered by Anfitriões". Conteúdo do utilizador é sempre escapado (`escHtml`); o nome do alojamento no From é sanitizado contra header injection.
