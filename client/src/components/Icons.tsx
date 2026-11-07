import type { ReactNode } from "react";

/** Small inline stroke icons (no icon dependency). All decorative: pair with a text label or aria-label. */
function Svg({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>
  );
}

export const IconTrophy = () => <Svg><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3" /></Svg>;
export const IconSun = () => <Svg><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Svg>;
export const IconMoon = () => <Svg><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" /></Svg>;
export const IconClock = () => <Svg size={16}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>;
export const IconClose = () => <Svg><path d="M6 6l12 12M18 6 6 18" /></Svg>;
export const IconCamera = () => <Svg><path d="M4 8h3l2-3h6l2 3h3v11H4V8Z" /><circle cx="12" cy="13" r="3.5" /></Svg>;
export const IconFlag = () => <Svg size={12}><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></Svg>;

/** Book-spine mark: three upright volumes, the last one leaning. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="4" y="6" width="6" height="21" rx="1.2" fill="var(--c-brand)" />
      <rect x="12" y="4" width="6" height="23" rx="1.2" fill="var(--c-brass)" />
      <rect x="20.2" y="7.5" width="6" height="19.5" rx="1.2" transform="rotate(8 23 17)" fill="var(--c-brand)" opacity=".8" />
      <rect x="2" y="27" width="28" height="2" rx="1" fill="var(--c-ink)" opacity=".7" />
    </svg>
  );
}

/** Empty-state illustration: a shelf with a few books and a reading lamp. */
export function ShelfIllustration() {
  return (
    <svg viewBox="0 0 240 150" width="240" height="150" aria-hidden="true" focusable="false">
      <circle cx="184" cy="74" r="40" fill="var(--c-brass-soft)" />
      <path d="M184 118V70M184 70l-12-14" stroke="var(--c-ink)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity=".75" />
      <path d="M156 62l12-24 22 14-12 22Z" fill="var(--c-brass)" />
      <rect x="170" y="112" width="28" height="6" rx="3" fill="var(--c-ink)" opacity=".75" />
      <rect x="28" y="52" width="14" height="66" rx="2" fill="var(--c-brand)" />
      <rect x="46" y="40" width="16" height="78" rx="2" fill="var(--c-brass)" />
      <rect x="66" y="58" width="12" height="60" rx="2" fill="var(--c-brand)" opacity=".7" />
      <rect x="82" y="46" width="15" height="72" rx="2" fill="var(--c-muted)" opacity=".55" />
      <rect x="100" y="62" width="12" height="56" rx="2" fill="var(--c-brass)" opacity=".7" />
      <rect x="16" y="118" width="208" height="7" rx="3.5" fill="var(--c-ink)" opacity=".75" />
    </svg>
  );
}
