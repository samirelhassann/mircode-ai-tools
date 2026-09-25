import { useEffect, useState } from 'react'
import { useConfig } from '@/hooks/use-config'

const DISMISS_KEY = 'specs:small-screen-dismissed'

function debounce<T extends (...args: never[]) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null
  return ((...args: never[]) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }) as T
}

export function SmallScreenWarning() {
  const { data } = useConfig()
  const warnBelow = data?.config.warnBelowWidth ?? 1024
  const [dismissed, setDismissed] = useState(false)
  const [width, setWidth] = useState(() => window.innerWidth)

  useEffect(() => {
    if (sessionStorage.getItem(DISMISS_KEY) === '1') setDismissed(true)
  }, [])

  useEffect(() => {
    const handler = debounce(() => setWidth(window.innerWidth), 150)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  if (dismissed) return null
  if (width >= warnBelow) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="small-screen-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <div className="mx-4 max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-8 text-center space-y-4">
        <h2 id="small-screen-title" className="text-lg font-bold text-[var(--text-primary)]">
          Tela muito estreita
        </h2>
        <p className="text-sm text-[var(--text-secondary)]">
          A Specs Platform é desktop-only por ora (mínimo {warnBelow}px). Use uma tela maior para
          uma experiência completa.
        </p>
        <button
          type="button"
          onClick={() => {
            sessionStorage.setItem(DISMISS_KEY, '1')
            setDismissed(true)
          }}
          className="px-4 py-2 rounded-md bg-[var(--bg-surface)] border border-[var(--border)] text-sm text-[var(--text-primary)] hover:border-[var(--accent)] transition-colors"
        >
          Continuar mesmo assim
        </button>
      </div>
    </div>
  )
}
