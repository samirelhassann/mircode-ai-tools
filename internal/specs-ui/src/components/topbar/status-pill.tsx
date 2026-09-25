import type { Status } from '@/lib/types'
import { STATUS_BG_VAR, STATUS_COLOR_VAR, STATUS_LABEL } from '@/lib/status'

type Props = { status: Status }

export function StatusPill({ status }: Props) {
  return (
    <span
      className="inline-flex items-center text-[13px] font-semibold"
      style={{
        height: '28px',
        padding: '0 12px',
        borderRadius: '100px',
        background: STATUS_BG_VAR[status],
        color: STATUS_COLOR_VAR[status],
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}
