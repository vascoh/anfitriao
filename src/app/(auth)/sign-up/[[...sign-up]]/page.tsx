import { SignUp } from '@clerk/nextjs'
import { TRIAL_DIAS } from '@/lib/planos'

export default function SignUpPage() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center bg-background px-4 gap-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Anfitrião</h1>
        <p className="text-sm text-muted-foreground mt-1">{TRIAL_DIAS} dias grátis · Sem cartão de crédito</p>
      </div>
      <SignUp />
    </main>
  )
}
