import { ClerkProvider } from '@clerk/nextjs'

// O botão «Terminar sessão» desta página precisa do Clerk no browser (ver o layout raiz).
export default function EmConstrucaoLayout({ children }: { children: React.ReactNode }) {
  return <ClerkProvider>{children}</ClerkProvider>
}
