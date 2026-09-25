import { Link } from 'react-router-dom'
import type { FeatureNode } from '@/lib/types'
import { STATUS_COLOR_VAR, STATUS_ICON, STATUS_LABEL } from '@/lib/status'
import { stripFeaturePrefix } from './strip-duplicate-title'

type Props = { feature: FeatureNode }

export function FeatureTaskList({ feature }: Props) {
  if (feature.tasks.length === 0) return null

  return (
    <section
      aria-label="Tarefas desta feature"
      className="markdown-body"
      style={{ padding: '0 48px 48px' }}
    >
      <h2
        id="tarefas"
        className="text-xl font-semibold mt-10 mb-4 pt-5 border-t border-[var(--border)] text-[var(--accent)]"
      >
        Tarefas
      </h2>
      <ul className="grid gap-3 list-none p-0 m-0">
        {feature.tasks.map((task) => {
          const Icon = STATUS_ICON[task.status]
          return (
            <li key={task.slug}>
              <Link
                to={`/features/${feature.slug}/${task.slug}`}
                className="flex items-start gap-3 no-underline rounded-xl border border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)] transition-colors"
                style={{ padding: '14px 16px' }}
              >
                <Icon
                  className="size-4 shrink-0 mt-0.5"
                  style={{ color: STATUS_COLOR_VAR[task.status] }}
                  aria-hidden="true"
                />
                <span className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {stripFeaturePrefix(task.title, feature.title)}
                  </span>
                  {task.description ? (
                    <span className="text-[13px] text-[var(--text-secondary)] leading-snug">
                      {task.description}
                    </span>
                  ) : null}
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {STATUS_LABEL[task.status]}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
