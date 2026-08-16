import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

/** Um título de cartão social; acima disto é abuso, não um nome de alojamento. */
const MAX_TITULO = 120

/**
 * Imagem de partilha (Open Graph).
 *
 * Rota pública e sem sessão — tem de o ser, é o Facebook e o WhatsApp que a
 * pedem. Duas defesas, porque é a **nossa** infraestrutura a desenhar texto
 * que vem de fora:
 *
 * - **limite de tamanho**: sem ele, qualquer pessoa mandava 3.000 caracteres
 *   e nós desenhávamos tudo, a cada pedido;
 * - **cache**: sem ela, cada visita voltava a renderizar. Com ela, o mesmo
 *   título é desenhado uma vez e servido do lado da CDN — o que tira o
 *   interesse a quem quisesse usar isto como moinho de CPU.
 *
 * O que fica por resolver, e não tem solução técnica limpa: o texto aparece
 * numa imagem servida do nosso domínio, e serve para quem quiser fabricar um
 * cartão com ar oficial. É o mesmo que acontece em qualquer serviço com OG
 * dinâmico; a alternativa era assinar os pedidos, e nem o Facebook o faz.
 */
export function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const title = (searchParams.get('title') ?? 'Gestão de Alojamento Local sem papelada')
    .slice(0, MAX_TITULO)

  return new ImageResponse(
    (
      <div
        style={{
          background: '#faf7f4',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '72px 80px',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Terracotta glow top-right */}
        <div
          style={{
            position: 'absolute',
            top: -120,
            right: -120,
            width: 480,
            height: 480,
            background: '#C2714F',
            borderRadius: '50%',
            filter: 'blur(100px)',
            opacity: 0.18,
          }}
        />
        {/* Subtle warm glow bottom-left */}
        <div
          style={{
            position: 'absolute',
            bottom: -80,
            left: -80,
            width: 320,
            height: 320,
            background: '#e8a87c',
            borderRadius: '50%',
            filter: 'blur(80px)',
            opacity: 0.12,
          }}
        />

        {/* Logo mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 44 }}>
          <div
            style={{
              width: 52,
              height: 52,
              background: '#C2714F',
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 26,
              fontWeight: 800,
            }}
          >
            A
          </div>
          <span style={{ fontSize: 30, fontWeight: 700, color: '#1a1209', letterSpacing: -0.5 }}>
            Anfitrião
          </span>
        </div>

        {/* Main headline */}
        <div
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: '#1a1209',
            lineHeight: 1.1,
            maxWidth: 840,
            marginBottom: 24,
            letterSpacing: -1.5,
          }}
        >
          {title}
        </div>

        {/* Sub-headline */}
        <div
          style={{
            fontSize: 24,
            color: '#6b5c4e',
            maxWidth: 680,
            lineHeight: 1.45,
            marginBottom: 44,
          }}
        >
          Airbnb e Booking.com num só calendário, check-in online e boletim SIBA pronto antes da chegada.
        </div>

        {/* Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: '#C2714F',
            color: '#fff',
            padding: '12px 26px',
            borderRadius: 100,
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: 0.2,
          }}
        >
          14 dias grátis · Sem cartão de crédito
        </div>

        {/* URL bottom-right */}
        <div
          style={{
            position: 'absolute',
            bottom: 36,
            right: 80,
            fontSize: 18,
            color: '#9a8070',
            fontWeight: 500,
          }}
        >
          anfitrioes.pt
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        // O mesmo título dá sempre a mesma imagem: desenha-se uma vez.
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, immutable',
      },
    },
  )
}
