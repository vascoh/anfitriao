'use client'

import { motion, useReducedMotion } from 'motion/react'
import { EASE_OUT } from '@/lib/landing-animations'

/**
 * Ilustração abstrata de gestão de propriedades: três nós de plataforma
 * a convergir num núcleo único. SVG puro — sem imagens externas.
 */
export function HeroVisual() {
  const reduced = useReducedMotion()

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.7, delay: 0.25, ease: EASE_OUT }}
      className="relative mx-auto w-full max-w-lg"
      aria-hidden
    >
      <motion.div
        animate={reduced ? undefined : { y: [0, -12, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <svg viewBox="0 0 400 360" className="w-full" role="presentation">
          <defs>
            <linearGradient id="hv-core" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
            <linearGradient id="hv-card" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
            <filter id="hv-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="14" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Anéis orbitais */}
          <ellipse cx="200" cy="185" rx="165" ry="118" fill="none" stroke="rgba(6,182,212,0.16)" strokeWidth="1.5" />
          <ellipse cx="200" cy="185" rx="112" ry="80" fill="none" stroke="rgba(6,182,212,0.24)" strokeWidth="1.5" strokeDasharray="5 7" />

          {/* Ligações plataforma → núcleo */}
          {[
            'M 78 100 C 130 130, 160 150, 196 178',
            'M 322 96 C 268 128, 240 150, 204 178',
            'M 200 300 C 200 260, 200 225, 200 198',
          ].map((d, i) => (
            <motion.path
              key={d}
              d={d}
              fill="none"
              stroke="url(#hv-core)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="6 8"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.9 }}
              transition={{ duration: 1.1, delay: 0.5 + i * 0.15, ease: EASE_OUT }}
            />
          ))}

          {/* Cartões de plataforma */}
          {[
            { x: 22, y: 62, label: 'Airbnb' },
            { x: 266, y: 58, label: 'Booking' },
            { x: 144, y: 296, label: 'Direto' },
          ].map((c, i) => (
            <motion.g
              key={c.label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.7 + i * 0.12, ease: EASE_OUT }}
            >
              <rect x={c.x} y={c.y} width="112" height="46" rx="12" fill="url(#hv-card)" stroke="rgba(148,163,184,0.28)" />
              <circle cx={c.x + 22} cy={c.y + 23} r="7" fill="#06b6d4" opacity="0.85" />
              <rect x={c.x + 38} y={c.y + 15} width="54" height="6" rx="3" fill="rgba(226,232,240,0.75)" />
              <rect x={c.x + 38} y={c.y + 26} width="34" height="5" rx="2.5" fill="rgba(148,163,184,0.55)" />
            </motion.g>
          ))}

          {/* Núcleo — o dashboard unificado */}
          <motion.g
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.45, ease: EASE_OUT }}
            style={{ transformOrigin: '200px 185px' }}
          >
            <circle cx="200" cy="185" r="52" fill="url(#hv-core)" opacity="0.18" filter="url(#hv-glow)" />
            <rect x="150" y="149" width="100" height="72" rx="14" fill="url(#hv-card)" stroke="rgba(6,182,212,0.6)" strokeWidth="1.5" />
            {/* mini calendário */}
            {Array.from({ length: 12 }).map((_, i) => (
              <motion.rect
                key={i}
                x={162 + (i % 4) * 19}
                y={166 + Math.floor(i / 4) * 17}
                width="13"
                height="11"
                rx="3"
                fill={i === 5 || i === 10 ? '#10b981' : i === 2 ? '#06b6d4' : 'rgba(148,163,184,0.28)'}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.9 + i * 0.04 }}
              />
            ))}
          </motion.g>

          {/* Pontos a percorrer as ligações */}
          {!reduced &&
            [0, 1, 2].map((i) => (
              <motion.circle
                key={i}
                r="3.5"
                fill="#10b981"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 1, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, times: [0, 0.15, 0.85, 1] }}
              >
                <animateMotion
                  dur="2.4s"
                  repeatCount="indefinite"
                  begin={`${i * 0.8}s`}
                  path={
                    ['M 78 100 C 130 130, 160 150, 196 178',
                     'M 322 96 C 268 128, 240 150, 204 178',
                     'M 200 300 C 200 260, 200 225, 200 198'][i]
                  }
                />
              </motion.circle>
            ))}
        </svg>
      </motion.div>
    </motion.div>
  )
}
