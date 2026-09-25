import { useEffect, useRef, useState, useCallback } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Save, X } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { bracketMatching, indentOnInput } from '@codemirror/language'
import { api } from '@/lib/api'
import { useContent } from '@/hooks/use-content'
import { cn } from '@/lib/cn'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  featureSlug: string
  taskSlug: string
}

/**
 * Dialog com editor CodeMirror 6 para o arquivo .md inteiro (incluindo
 * frontmatter YAML). Ao confirmar, chama PUT /api/content e invalida caches.
 *
 * Atalhos: Cmd/Ctrl+S para salvar. Esc para fechar.
 */
export function EditarTaskDialog({ open, onOpenChange, featureSlug, taskSlug }: Props) {
  const qc = useQueryClient()
  const { data: content, isLoading } = useContent(featureSlug, taskSlug)
  const [value, setValue] = useState<string>('')
  const [dirty, setDirty] = useState(false)
  // Usa ref-as-state: o callback ref dispara re-render sempre que o div monta/desmonta,
  // evitando race condition entre Radix Portal e o useEffect (useRef normal não avisa
  // o React quando a ref é atribuída).
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  // Precisamos chamar handleSave do keymap sem recriar o effect toda vez que `value`/`dirty`
  // mudam — guardamos handleSave em ref.
  const handleSaveRef = useRef<() => void>(() => {})
  // Qual (dialog aberto + alvo) já foi semeado no editor. Com o watcher de
  // arquivos ativo o conteúdo pode ser revalidado enquanto o dialog está aberto;
  // sem esta trava, um refetch sobrescreveria o que o usuário ainda não salvou.
  const seededFor = useRef<string | null>(null)

  // Semeia o editor uma vez por abertura (ou por troca de task) — nunca a cada
  // chegada de conteúdo novo, senão uma revalidação apagaria a edição em curso.
  useEffect(() => {
    if (!open) {
      seededFor.current = null
      return
    }
    if (content?.raw === undefined) return
    const target = `${featureSlug}/${taskSlug}`
    if (seededFor.current === target) return
    seededFor.current = target
    setValue(content.raw)
    setDirty(false)
  }, [open, content?.raw, featureSlug, taskSlug])

  const mutation = useMutation({
    mutationFn: () => api.updateContent(featureSlug, taskSlug, value),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['content', featureSlug, taskSlug] })
      void qc.invalidateQueries({ queryKey: ['tree'] })
      toast.success('Task atualizada.')
      setDirty(false)
      onOpenChange(false)
    },
    onError: () => {
      toast.error('Não foi possível salvar a task. Tente novamente.')
    },
  })

  const handleSave = useCallback(() => {
    if (!dirty || mutation.isPending) return
    mutation.mutate()
  }, [dirty, mutation])

  // Atualiza a ref sempre que handleSave muda (sem recriar o editor)
  useEffect(() => {
    handleSaveRef.current = handleSave
  }, [handleSave])

  // Monta o CodeMirror assim que o div está no DOM e o conteúdo chegou.
  // Depende de `container` (callback ref) + `content?.raw`, garantindo timing correto.
  useEffect(() => {
    if (!container) return
    if (content?.raw === undefined) return
    if (viewRef.current) return // já montado

    const initialDoc = content.raw

    const saveKeymap = keymap.of([
      {
        key: 'Mod-s',
        preventDefault: true,
        run: () => {
          handleSaveRef.current()
          return true
        },
      },
    ])

    const view = new EditorView({
      parent: container,
      state: EditorState.create({
        doc: initialDoc,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          history(),
          bracketMatching(),
          indentOnInput(),
          markdown(),
          oneDark,
          saveKeymap,
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.lineWrapping,
          EditorView.updateListener.of((u) => {
            if (u.docChanged) {
              const next = u.state.doc.toString()
              setValue(next)
              setDirty(next !== initialDoc)
            }
          }),
          EditorView.theme({
            '&': { height: '100%', fontSize: '13px' },
            '.cm-scroller': {
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            },
            '.cm-content': { padding: '12px 0' },
            '.cm-gutters': {
              backgroundColor: 'var(--bg-surface)',
              borderRight: '1px solid var(--border)',
            },
            '&.cm-focused': { outline: 'none' },
          }),
        ],
      }),
    })
    viewRef.current = view

    requestAnimationFrame(() => view.focus())

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [container, content?.raw])

  function handleOpenChange(next: boolean) {
    if (!next && dirty) {
      const ok = window.confirm('Descartar alterações não salvas?')
      if (!ok) return
    }
    onOpenChange(next)
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content
          className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-2xl focus:outline-none flex flex-col"
          style={{
            width: 'min(920px, calc(100vw - 48px))',
            height: 'min(760px, calc(100vh - 48px))',
          }}
        >
          <div
            className="flex items-center justify-between border-b border-[var(--border)] shrink-0"
            style={{ padding: '16px 20px' }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Dialog.Title className="text-[14px] font-bold text-[var(--text-primary)] truncate">
                Editando{' '}
                <code className="text-[var(--accent)] font-mono text-[13px]">
                  .specs/specs/{featureSlug}/{taskSlug}.md
                </code>
              </Dialog.Title>
              {dirty ? (
                <span className="text-[11px] text-[var(--accent)] font-medium uppercase tracking-wide">
                  (não salvo)
                </span>
              ) : null}
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Fechar"
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X className="size-[18px]" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          {/* Acessibilidade: Radix warn sem Description — anexa via visually-hidden. */}
          <Dialog.Description className="sr-only">
            Editor markdown do arquivo .md da task. Cmd+S salva. Esc fecha.
          </Dialog.Description>

          <div className="flex-1 min-h-0 overflow-hidden">
            {isLoading || content?.raw === undefined ? (
              <div className="flex items-center justify-center h-full text-sm text-[var(--text-muted)]">
                Carregando…
              </div>
            ) : (
              <div ref={setContainer} className="h-full" />
            )}
          </div>

          <div
            className="flex items-center justify-between gap-2 border-t border-[var(--border)] shrink-0"
            style={{ padding: '12px 20px' }}
          >
            <p className="text-xs text-[var(--text-muted)]">
              <kbd className="text-[11px] px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--bg-surface)]">
                ⌘S
              </kbd>{' '}
              salvar ·{' '}
              <kbd className="text-[11px] px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--bg-surface)]">
                Esc
              </kbd>{' '}
              fechar
            </p>
            <div className="flex items-center gap-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className={cn(
                    'text-[13px] font-medium rounded-lg transition-colors',
                    'bg-transparent text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.05)]',
                    'border border-[var(--border)]',
                  )}
                  style={{ height: '32px', padding: '0 14px' }}
                >
                  Cancelar
                </button>
              </Dialog.Close>
              <button
                type="button"
                disabled={!dirty || mutation.isPending}
                onClick={handleSave}
                className={cn(
                  'inline-flex items-center gap-1.5 text-[13px] font-semibold rounded-lg',
                  'bg-[var(--accent)] text-[var(--bg-surface)]',
                  'hover:opacity-90 transition-opacity',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
                style={{ height: '32px', padding: '0 14px' }}
              >
                <Save className="size-[13px]" aria-hidden="true" />
                {mutation.isPending ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
