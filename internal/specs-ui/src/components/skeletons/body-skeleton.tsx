export function BodySkeleton() {
  return (
    <div className="p-10 space-y-6 animate-pulse" style={{ padding: '40px 48px' }}>
      <div className="h-8 w-2/3 rounded bg-[rgba(255,255,255,0.05)]" />
      <div className="h-4 w-full rounded bg-[rgba(255,255,255,0.03)]" />
      <div className="h-4 w-4/5 rounded bg-[rgba(255,255,255,0.03)]" />
      <div className="h-4 w-3/5 rounded bg-[rgba(255,255,255,0.03)]" />
      <div className="h-48 w-full rounded-xl bg-[rgba(255,255,255,0.03)] mt-6" />
      <div className="h-32 w-full rounded-xl bg-[rgba(255,255,255,0.03)]" />
    </div>
  )
}
