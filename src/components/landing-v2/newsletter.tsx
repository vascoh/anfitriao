'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Send, Check } from 'lucide-react'

type Campos = { email: string }

export function Newsletter() {
  const [enviado, setEnviado] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Campos>({ mode: 'onSubmit' })

  // TODO: ligar a um endpoint real de subscrição antes de publicar.
  const onSubmit = async () => {
    setEnviado(true)
    reset()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-sm">
      <label htmlFor="newsletter-email" className="block text-sm font-semibold text-white">
        Novidades para anfitriões
      </label>
      <p className="mt-1.5 text-sm text-slate-400">
        Uma vez por mês. Sem ruído, sem spam.
      </p>

      <div className="mt-4 flex gap-2">
        <input
          id="newsletter-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="o.teu@email.pt"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? 'newsletter-erro' : undefined}
          {...register('email', {
            required: 'Indica o teu email.',
            pattern: {
              value: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
              message: 'Email inválido.',
            },
          })}
          className={`h-11 min-w-0 flex-1 rounded-xl border bg-slate-950/60 px-4 text-sm text-white placeholder:text-slate-400 focus:outline-2 focus:outline-offset-1 focus:outline-cyan-400 ${
            errors.email ? 'border-red-500/60' : 'border-white/15'
          }`}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-cyan-500 px-4 text-sm font-semibold text-slate-950 transition-shadow hover:shadow-lg hover:shadow-cyan-500/30 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-400 disabled:opacity-60"
        >
          {enviado ? <Check className="size-4" aria-hidden /> : <Send className="size-4" aria-hidden />}
          <span className="sr-only sm:not-sr-only">{enviado ? 'Feito' : 'Subscrever'}</span>
        </button>
      </div>

      <p aria-live="polite" className="mt-2 min-h-5 text-xs">
        {errors.email && (
          <span id="newsletter-erro" className="text-red-400">
            {errors.email.message}
          </span>
        )}
        {enviado && !errors.email && (
          <span className="text-emerald-400">Obrigado — ficaste subscrito.</span>
        )}
      </p>
    </form>
  )
}
