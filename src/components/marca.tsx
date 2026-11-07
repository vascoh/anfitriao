/**
 * Símbolo e nome do Anfitrião. Um só desenho para a app, a landing e as
 * páginas legais: a casa em branco sobre o quadrado terracota.
 */
export function SimboloMarca({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`${className} grid shrink-0 place-items-center rounded-lg bg-primary`}
    >
      <svg
        className="h-1/2 w-1/2 text-primary-foreground"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 22V12h6v10" />
      </svg>
    </span>
  )
}

export function Marca({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <SimboloMarca />
      <span className="text-base font-bold tracking-tight text-foreground">Anfitrião</span>
    </span>
  )
}
