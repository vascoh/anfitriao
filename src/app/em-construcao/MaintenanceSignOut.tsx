'use client'

import { SignOutButton } from '@clerk/nextjs'

export function MaintenanceSignOut() {
  return (
    <SignOutButton redirectUrl="/sign-in">
      <button className="text-xs text-muted-foreground/70 hover:text-muted-foreground underline underline-offset-2 transition-colors">
        Terminar sessão
      </button>
    </SignOutButton>
  )
}
