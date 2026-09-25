import type { CSSProperties } from 'react'
import { Outlet } from 'react-router-dom'
import { SpecsSidebar } from './specs-sidebar'
import { SmallScreenWarning } from './small-screen-warning'
import { JobsSidebar } from '../jobs/jobs-sidebar'
import { JobsDialogContainer } from '../jobs/jobs-dialog-container'
import { SidebarProvider } from '@/components/ui/sidebar'
import { useJobsPolling } from '@/hooks/use-jobs-polling'
import { useJobNotifications } from '@/hooks/use-job-notifications'
import { useSpecsEvents } from '@/hooks/use-specs-events'
import { useSpecsFallbackPolling } from '@/hooks/use-specs-fallback-polling'

/**
 * O `SidebarProvider` persiste o estado no cookie `sidebar_state`; aqui só
 * lemos ele de volta para o primeiro render não "piscar" expandido.
 */
function readSidebarCookie(): boolean {
  if (typeof document === 'undefined') return true
  return !/(?:^|;\s*)sidebar_state=false(?:;|$)/.test(document.cookie)
}

export function AppShell() {
  // As specs vêm do disco: o servidor observa `.specs/` e empurra invalidações,
  // então editar um .md por fora (um agent, o editor) reflete na tela sozinho.
  // O polling só entra se esse canal não estiver disponível.
  const { live } = useSpecsEvents()
  useSpecsFallbackPolling({ enabled: !live })
  useJobsPolling()
  useJobNotifications()

  return (
    <SidebarProvider
      defaultOpen={readSidebarCookie()}
      style={{ '--sidebar-width': '300px' } as CSSProperties}
      className="h-screen w-screen overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)]"
    >
      <SpecsSidebar />
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </div>
      <JobsSidebar />
      <SmallScreenWarning />
      <JobsDialogContainer />
    </SidebarProvider>
  )
}
