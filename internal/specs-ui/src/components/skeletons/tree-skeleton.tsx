export function TreeSkeleton() {
  return (
    <div className="flex-1 p-10 space-y-4 animate-pulse">
      <div className="h-8 w-2/3 rounded bg-[rgba(255,255,255,0.05)]" />
      <div className="h-4 w-1/2 rounded bg-[rgba(255,255,255,0.03)]" />
      <div className="h-4 w-1/3 rounded bg-[rgba(255,255,255,0.03)]" />
    </div>
  )
}
