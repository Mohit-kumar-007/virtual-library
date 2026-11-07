export function PrivacyNotice() {
  return (
    <p className="rounded-lg border border-brass/40 bg-notice-soft p-3 text-sm text-notice-ink" data-testid="privacy-notice">
      Your camera will be visible live to other people in this study room. Video is not recorded by default.
      Your microphone stays off.
    </p>
  );
}
