import { Ban, CircleCheck, Circle, Timer, type LucideIcon } from 'lucide-react'
import type { Status } from './types'

export const STATUS_LABEL: Record<Status, string> = {
  pending: 'Pendente',
  'in-progress': 'Em andamento',
  completed: 'Concluída',
  blocked: 'Bloqueada',
}

export const STATUS_ICON: Record<Status, LucideIcon> = {
  pending: Circle,
  'in-progress': Timer,
  completed: CircleCheck,
  blocked: Ban,
}

export const STATUS_COLOR_VAR: Record<Status, string> = {
  pending: 'var(--status-pending)',
  'in-progress': 'var(--status-in-progress)',
  completed: 'var(--status-completed)',
  blocked: 'var(--status-blocked)',
}

export const STATUS_BG_VAR: Record<Status, string> = {
  pending: 'transparent',
  'in-progress': 'var(--status-in-progress-bg)',
  completed: 'rgba(142, 255, 109, 0.1)',
  blocked: 'rgba(239, 68, 68, 0.1)',
}

export const ALL_STATUSES: Status[] = ['pending', 'in-progress', 'completed', 'blocked']
