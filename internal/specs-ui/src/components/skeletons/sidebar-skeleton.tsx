export function SidebarSkeleton() {
  return (
    <ul className="flex flex-col gap-1 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: purely visual skeleton
        <li key={i} className="h-9 rounded-md bg-[rgba(255,255,255,0.03)]" />
      ))}
    </ul>
  )
}
