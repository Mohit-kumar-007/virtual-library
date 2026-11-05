export function ActiveCount({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-2 text-sm" data-testid="active-count" aria-live="polite">
      <span className="live-dot inline-block h-2.5 w-2.5 rounded-full bg-live" />
      <span><b className="tabnum">{count}</b> <span className="hidden sm:inline">{count === 1 ? "student" : "students"} studying now</span><span className="sm:hidden">studying</span></span>
    </div>
  );
}
