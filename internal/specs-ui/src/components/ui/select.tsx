import type React from 'react'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/cn'

export type SelectOption = {
  value: string
  label: string
  /** Linha secundária do item, exibida abaixo do label na lista. */
  description?: ReactNode
  /** Selo curto exibido ao lado do label (ex.: promoção vigente). */
  badge?: ReactNode
  /** Informação à direita (custo, janela de contexto) — alinhada e monoespaçada. */
  meta?: string
  /** Indicador visual à direita (ex.: barra de potência), acima do `meta`. */
  indicator?: ReactNode
  /** Texto extra considerado pela busca, além do label (id, fornecedor…). */
  keywords?: string
  disabled?: boolean
}

type Props = {
  label?: string
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  hint?: string
  className?: string
  /** Campo de busca no topo da lista — para listas longas. */
  searchable?: boolean
  searchPlaceholder?: string
  'aria-label'?: string
}

/** Navegação e seleção continuam com o Radix; o resto é digitação na busca. */
const PASSTHROUGH_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab'])

function matches(option: SelectOption, query: string): boolean {
  const haystack = `${option.label} ${option.keywords ?? ''}`.toLowerCase()
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term))
}

/**
 * Select do design system — Radix por baixo (teclado, foco e ARIA prontos),
 * com item de duas linhas para descrição, coluna de metadados e busca opcional.
 */
export function Select({
  label,
  value,
  onChange,
  options,
  placeholder = 'Selecione…',
  disabled,
  hint,
  className,
  searchable,
  searchPlaceholder = 'Buscar…',
  ...rest
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
    if (!searchable) return
    // O Radix foca o item selecionado ao abrir, e faz isso em mais de um passo
    // (montagem do FocusScope e depois o scroll até o item). Reinsistimos no
    // foco da busca por alguns quadros para não perder a corrida.
    const timers = [0, 40, 120].map((delay) =>
      window.setTimeout(() => searchRef.current?.focus(), delay),
    )
    return () => timers.forEach(window.clearTimeout)
  }, [open, searchable])

  const visible = useMemo(() => {
    if (!searchable || !query.trim()) return options
    return options.filter((o) => matches(o, query))
  }, [options, query, searchable])

  // O item selecionado precisa continuar montado mesmo filtrado fora, senão o
  // Radix perde o valor e o trigger fica vazio. Fica montado e escondido.
  const hiddenSelected =
    selected && !visible.some((o) => o.value === selected.value) ? selected : null
  const rendered = hiddenSelected ? [...visible, hiddenSelected] : visible

  /**
   * Enquanto o usuário não clica na busca, o foco do Radix fica no trigger e é
   * lá que o typeahead consome as teclas. `preventDefault` desarma o typeahead
   * (o Radix compõe os handlers respeitando isso) e a tecla vai para a busca.
   * Com o input focado, o handler dele interrompe a propagação e isto nem roda.
   */
  function routeTypingToSearch(e: React.KeyboardEvent) {
    if (!searchable || !open) return
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key === 'Backspace') {
      e.preventDefault()
      e.stopPropagation()
      searchRef.current?.focus()
      setQuery((q) => q.slice(0, -1))
      return
    }
    if (e.key.length !== 1) return
    e.preventDefault()
    // Impede que a tecla chegue aos atalhos globais registrados na window.
    e.stopPropagation()
    searchRef.current?.focus()
    setQuery((q) => q + e.key)
  }

  return (
    <div className={className}>
      {label ? (
        <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)] mb-2">{label}</p>
      ) : null}

      <SelectPrimitive.Root
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        open={open}
        onOpenChange={setOpen}
      >
        <SelectPrimitive.Trigger
          aria-label={rest['aria-label'] ?? label}
          onKeyDown={routeTypingToSearch}
          className={cn(
            'flex w-full items-center justify-between gap-2 rounded-lg',
            'bg-[var(--bg-surface)] border border-[var(--border)]',
            'text-sm text-[var(--text-primary)] text-left',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
            'data-[state=open]:border-[var(--accent)] transition-colors',
            disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-[var(--text-secondary)]',
          )}
          style={{ padding: '8px 12px' }}
        >
          <span className="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap">
            <span className="truncate">
              <SelectPrimitive.Value placeholder={placeholder} />
            </span>
            {selected?.badge}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {selected?.indicator}
            {selected?.meta ? (
              <span className="font-mono text-[11px] text-[var(--text-muted)]">
                {selected.meta}
              </span>
            ) : null}
            <SelectPrimitive.Icon asChild>
              <ChevronDown className="size-4 text-[var(--text-muted)]" aria-hidden="true" />
            </SelectPrimitive.Icon>
          </span>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={6}
            onKeyDown={routeTypingToSearch}
            className={cn(
              'z-[60] overflow-hidden rounded-xl border border-[var(--border)]',
              'bg-[var(--bg-card)] shadow-2xl',
              'w-[max(var(--radix-select-trigger-width),340px)]',
            )}
          >
            {searchable ? (
              <div
                className="flex items-center gap-2 border-b border-[var(--border)]"
                style={{ padding: '8px 10px' }}
              >
                <Search className="size-3.5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  // A digitação não pode chegar ao typeahead do Radix, que roubaria
                  // o foco para o item correspondente a cada tecla.
                  onKeyDown={(e) => {
                    // Além do typeahead do Radix, atalhos globais de uma tecla
                    // (como o "R" de rodar tarefa) escutam na window: sem parar
                    // a propagação, digitar "grok" dispararia uma execução.
                    if (!PASSTHROUGH_KEYS.has(e.key)) e.stopPropagation()
                  }}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  className={cn(
                    'w-full bg-transparent text-sm text-[var(--text-primary)]',
                    'placeholder:text-[var(--text-muted)] focus:outline-none',
                  )}
                />
              </div>
            ) : null}

            <SelectPrimitive.Viewport
              className="max-h-[320px] overflow-y-auto"
              style={{ padding: '4px' }}
            >
              {visible.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]" style={{ padding: '12px 10px' }}>
                  Nenhum modelo encontrado.
                </p>
              ) : null}
              {rendered.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className={cn(
                    'relative flex cursor-pointer select-none items-start gap-2 rounded-lg',
                    'text-sm text-[var(--text-primary)] outline-none',
                    'data-[highlighted]:bg-[var(--accent-subtle-weak)]',
                    'data-[state=checked]:text-[var(--accent)]',
                    'data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed',
                    hiddenSelected?.value === option.value && 'hidden',
                  )}
                  style={{ padding: '8px 10px' }}
                >
                  <SelectPrimitive.ItemIndicator className="mt-0.5 shrink-0">
                    <Check className="size-3.5" aria-hidden="true" />
                  </SelectPrimitive.ItemIndicator>
                  <span
                    className={cn('flex min-w-0 grow flex-col', !option.description && 'gap-0')}
                    style={{ paddingLeft: '2px' }}
                  >
                    <span className="flex flex-wrap items-center gap-1.5">
                      <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                      {option.badge}
                    </span>
                    {option.description ? (
                      <span className="text-xs text-[var(--text-secondary)] leading-snug">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                  {option.indicator || option.meta ? (
                    <span className="flex shrink-0 flex-col items-end gap-1 mt-0.5">
                      {option.indicator}
                      {option.meta ? (
                        <span className="font-mono text-[11px] text-[var(--text-muted)]">
                          {option.meta}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>

      {hint ? <p className="text-xs text-[var(--text-muted)] mt-1">{hint}</p> : null}
    </div>
  )
}
