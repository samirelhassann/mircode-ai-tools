type Props = {
  size?: number
  className?: string
}

/**
 * Marca da Specs Platform: o caret de um prompt (`›`) seguido de duas barras —
 * a spec sendo escrita por um agent. O roxo é a cor de marca; o verde da barra
 * curta é o mesmo `--status-completed` usado nos status das tasks.
 *
 * Este é o glifo nu, para uso sobre a superfície da app. A variante do favicon
 * (mesmo glifo dentro de um quadrado roxo, para ter presença na aba do browser)
 * vive em `public/favicon.svg`.
 *
 * É decorativo: sempre aparece ao lado do texto "Specs" ou dentro de um botão
 * que já tem `aria-label`.
 */
export function SpecsLogo({ size = 22, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M6 9l6.5 7L6 23"
        stroke="var(--accent)"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="16" y="11.5" width="12" height="3.2" rx="1.6" fill="var(--text-primary)" />
      <rect x="16" y="17.3" width="7" height="3.2" rx="1.6" fill="var(--status-completed)" />
    </svg>
  )
}
