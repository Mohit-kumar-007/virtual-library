export function PrivacyNotice() {
  return (
    <p className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200" data-testid="privacy-notice">
      Your camera will be visible live to other people in this study room. Video is not recorded by default.
      Your microphone stays off.
    </p>
  );
}
