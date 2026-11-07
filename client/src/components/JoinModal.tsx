import { useEffect, useRef, useState } from "react";
import { LIMITS, validateJoin, type JoinForm } from "../utils/validation";
import type { JoinError, JoinPhase } from "../hooks/useRoom";
import { PrivacyNotice } from "./PrivacyNotice";
import { IconCamera } from "./Icons";

interface Props { phase: JoinPhase; onSubmit: (f: JoinForm) => Promise<JoinError | null>; onClose: () => void; serverDown: boolean; }

export function JoinModal({ phase, onSubmit, onClose, serverDown }: Props) {
  const [form, setForm] = useState<JoinForm>({ name: "", title: "", description: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof JoinForm, string>>>({});
  const [err, setErr] = useState<JoinError | null>(null);
  const first = useRef<HTMLInputElement>(null);
  const busy = phase === "camera" || phase === "connecting";

  useEffect(() => { first.current?.focus(); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [busy, onClose]);

  const set = (k: keyof JoinForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = validateJoin(form);
    setErrors(v); setErr(null);
    if (Object.keys(v).length) return;
    const r = await onSubmit(form);
    if (r) { setErr(r); if (r.fields) setErrors(r.fields as never); }
  }

  const input = "mt-1.5 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink outline-none placeholder:text-muted/70 focus:border-brass focus:ring-2 focus:ring-brass/30";
  const fieldError = "mt-1 block text-xs text-danger";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-labelledby="join-title" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <form onSubmit={submit} noValidate className="card enter max-h-full w-full max-w-md space-y-4 overflow-auto rounded-2xl p-6" data-testid="join-form">
        <div>
          <h2 id="join-title" className="font-serif text-2xl font-semibold">Join the library</h2>
          <p className="text-sm italic text-muted">Everyone here is busy. So are you.</p>
        </div>
        <label className="block text-sm font-medium">Name
          <input ref={first} className={input} value={form.name} onChange={set("name")} maxLength={LIMITS.name} placeholder="Mohit" name="name" autoComplete="off" disabled={busy} />
          {errors.name && <span className={fieldError} role="alert">{errors.name}</span>}
        </label>
        <label className="block text-sm font-medium">Title
          <input className={input} value={form.title} onChange={set("title")} maxLength={LIMITS.title} placeholder="CSE Student" name="title" autoComplete="off" disabled={busy} />
          {errors.title && <span className={fieldError} role="alert">{errors.title}</span>}
        </label>
        <label className="block text-sm font-medium">Study description
          <textarea className={input} rows={2} value={form.description} onChange={set("description")} maxLength={LIMITS.description} placeholder="Learning FastAPI + AI" name="description" disabled={busy} />
          <span className="float-right mt-1 text-xs text-muted tabnum">{form.description.length}/{LIMITS.description}</span>
          {errors.description && <span className={fieldError} role="alert">{errors.description}</span>}
        </label>
        <PrivacyNotice />
        {serverDown && <p className="text-sm text-danger" role="alert">The library server is unavailable right now. Please try again shortly.</p>}
        {err && (
          <div className="rounded-lg bg-danger-soft p-3 text-sm text-danger" role="alert" data-testid="join-error">
            {err.message}
            {err.kind === "denied" && <p className="mt-1 opacity-80">A camera is required to study in this room. Allow camera access in your browser's address bar, then press “Try again”.</p>}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={busy || serverDown} data-testid="join-submit" className="btn btn-primary">
            {phase === "camera" ? "Waiting for camera…" : phase === "connecting" ? "Joining…" : err ? "Try again" : <><IconCamera />Turn on camera &amp; join</>}
          </button>
        </div>
      </form>
    </div>
  );
}
