export function ActiveCount({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-sm" data-testid="active-count" aria-live="polite">
      <span className="live-dot inline-block h-2 w-2 rounded-full bg-live" />
      <span><b className="tabnum">{count}</b> <span className="hidden text-muted sm:inline">{count === 1 ? "student" : "students"} studying now</span><span className="text-muted sm:hidden">studying</span></span>
    </div>
  );
}
