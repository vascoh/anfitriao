'use client'

import { useEffect, useSyncExternalStore } from 'react'

type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'anf:theme'
const EVENTO = 'anf:theme-change'
const MQ = '(prefers-color-scheme: dark)'

function getSystemPreference(): 'light' | 'dark' {
  return window.matchMedia(MQ).matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  const resolved = theme === 'system' ? getSystemPreference() : theme
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

function readStoredTheme(): Theme {
  try {
    const t = localStorage.getItem(STORAGE_KEY)
    return t === 'light' || t === 'dark' ? t : 'system'
  } catch {
    return 'system'
  }
}

/**
 * Tema escolhido + tema do sistema, como uma só loja externa.
 *
 * Com `useState(readStoredTheme)` o servidor desenhava sempre o botão de
 * «Modo escuro» e o cliente, em modo escuro, o de «Modo claro»: erro de
 * hidratação (React #418) em todos os ecrãs da app no tema escuro, medido em
 * produção a 2026-11-16. O `useSyncExternalStore` hidrata com o valor do
 * servidor e só depois passa ao do cliente, sem desfasamento.
 */
function subscribe(onChange: () => void) {
  const mq = window.matchMedia(MQ)
  mq.addEventListener('change', onChange)
  window.addEventListener('storage', onChange)
  window.addEventListener(EVENTO, onChange)
  return () => {
    mq.removeEventListener('change', onChange)
    window.removeEventListener('storage', onChange)
    window.removeEventListener(EVENTO, onChange)
  }
}

// Snapshot primitivo: `<escolha>:<sistema>`, para o React comparar por valor.
const snapshot = () => `${readStoredTheme()}:${getSystemPreference()}`
const serverSnapshot = () => 'system:light'

export function useTheme() {
  const [theme, sistema] = useSyncExternalStore(subscribe, snapshot, serverSnapshot).split(':') as [
    Theme,
    'light' | 'dark',
  ]

  // O script inline do layout já aplica a classe antes da pintura; isto mantém-na
  // certa quando a escolha ou a preferência do sistema mudam depois. Lê o
  // armazenamento e não o estado: na primeira passagem o estado ainda é o do
  // servidor («system») e aplicá-lo tirava o escuro a quem o escolheu (piscar).
  useEffect(() => {
    applyTheme(readStoredTheme())
  }, [theme, sistema])

  function setTheme(next: Theme) {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Sem armazenamento (navegação privada): o tema muda só nesta página.
      applyTheme(next)
      return
    }
    window.dispatchEvent(new Event(EVENTO))
  }

  const isDark = theme === 'dark' || (theme === 'system' && sistema === 'dark')

  return { theme, setTheme, isDark }
}
