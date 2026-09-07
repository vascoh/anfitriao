import { ImageResponse } from 'next/og'
import { type NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  /* `?size=abc` dava `NaN`: os dois `Math` propagam-no e a imagem saía com
   * largura e altura `NaN`. A rota é pública (está na lista do `proxy.ts`) e
   * qualquer pessoa lhe podia mandar isso. O `Number.isFinite` é o clamp que
   * faltava — sem valor utilizável volta-se aos 512 por omissão. */
  const pedido = Number(searchParams.get('size'))
  const size = Number.isFinite(pedido) ? Math.min(512, Math.max(32, Math.round(pedido))) : 512
  const r = Math.round(size * 0.18)
  const iconSize = Math.round(size * 0.52)

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#C2714F',
          borderRadius: r,
        }}
      >
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          <path d="M9 22V12h6v10" />
        </svg>
      </div>
    ),
    { width: size, height: size }
  )
}
