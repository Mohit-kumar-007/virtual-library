export function SessionTimer({ text, className = "" }: { text: string; className?: string }) {
  return <span className={`tabnum font-mono ${className}`} data-testid="timer">{text}</span>;
}
