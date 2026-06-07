import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const title = searchParams.get('title') ?? 'Gestão de Alojamento Local sem stress'

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
          Sincroniza Airbnb e Booking.com, check-in online legal, SIBA automático e IA Concierge — tudo num só lugar.
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
    { width: 1200, height: 630 },
  )
}
