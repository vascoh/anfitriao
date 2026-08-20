/**
 * Limitador em memória — uma contagem por processo.
 *
 * Em Vercel isso significa uma contagem por instância: o limite vale por
 * instância e recomeça em cada arranque a frio. Medido em produção — 90
 * pedidos em paralelo com limite de 60/hora passaram os 90 — portanto isto
 * **não** trava quem manda pedidos ao mesmo tempo.
 *
 * Serve na mesma como primeira porta, de graça, e é o que basta em rotas
 * autenticadas onde o limite é uma cortesia e não uma defesa. Onde o limite
 * protege dados pessoais ou dinheiro, usar `verificarLimite` de
 * `rate-limit-persistente.ts`, que conta na base.
 */

interface RateLimitState {
  count: number
  windowStart: number
}

const store = new Map<string, RateLimitState>()

// Cleanup old entries every 5 minutes to prevent memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, state] of store.entries()) {
      if (now - state.windowStart > 300_000) store.delete(key)
    }
  }, 300_000)
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * Check if the given key is within the rate limit.
 * @param key      Unique identifier (e.g. IP + route)
 * @param limit    Max requests per window
 * @param windowMs Window duration in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now()
  const existing = store.get(key)

  if (!existing || now - existing.windowStart > windowMs) {
    store.set(key, { count: 1, windowStart: now })
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs }
  }

  existing.count++

  if (existing.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.windowStart + windowMs,
    }
  }

  return {
    allowed: true,
    remaining: limit - existing.count,
    resetAt: existing.windowStart + windowMs,
  }
}

export function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}
