# Integrações

## Ativas
| Integração | Propósito | Estado |
|---|---|---|
| Clerk | Autenticação | ✅ Produção |
| Supabase | Base de dados + storage | ✅ Produção |
| Stripe | Billing/subscrições | ✅ Produção |
| Resend | Email transacional | ✅ Produção |
| web-push | Notificações push PWA | ✅ Produção |
| Anthropic Claude | Concierge multilingue, OCR de documentos | ✅ Produção |
| iCal (Airbnb, Booking, Vrbo, Expedia, Google, Outlook) | Sincronização de disponibilidade | ✅ Import + export (ver `SAAS_ARCHITECTURE.md` §5) |

## Planeadas (canais de distribuição, requerem parceria formal — não são só código)
| Integração | Bloqueio real |
|---|---|
| Airbnb API oficial | Certificação de parceiro Airbnb, due diligence, volume mínimo |
| Booking.com Connectivity API | Certificação "Connectivity Partner" |
| Vrbo/Expedia Partner API | Expedia Partner Central, processo formal |
| Google Vacation Rentals | Feed estruturado + aprovação Google |

Arquitetura de abstração (`ChannelAdapter`) preparada para estas quando a parceria existir — ver `SAAS_ARCHITECTURE.md` §5.2.

## Pagamentos além de Stripe (pedidos no prompt mestre)
| Método | Via | Nota |
|---|---|---|
| PayPal, Apple Pay, Google Pay | Já suportados nativamente pelo **Stripe Checkout** (métodos configuráveis, sem integração adicional) | Ativar no Stripe Dashboard, não requer código novo |
| MBWay, Multibanco | Stripe suporta Multibanco diretamente (Payment Methods PT); MBWay não é suportado pelo Stripe — requer PSP português adicional (ex.: Ifthenpay, SIBS) se for requisito de negócio | Decisão de negócio: vale o custo de um segundo PSP? (Pendência) |
| Transferência bancária | Fluxo manual (referência + confirmação por staff), não requer PSP | Baixa prioridade — construir só se pedido por clientes reais |

## Comunicação (WhatsApp, Telegram, SMS)
Nenhum construído ainda. WhatsApp Business API e Telegram Bot API são as vias oficiais (não scraping/não-oficial — risco de bloqueio de conta do cliente). SMS via qualquer gateway (ex.: Twilio, Vonage). Todos entram como novos "canais" do motor de notificações (`notification_preferences`, `SAAS_ARCHITECTURE.md` §9) — arquitetura já preparada para adicionar canais sem redesenho, só a implementação de cada gateway falta.
