import { useEffect, useRef, useState } from "react";
import { LIMITS, validateJoin, type JoinForm } from "../utils/validation";
import type { JoinError, JoinPhase } from "../hooks/useRoom";
import { PrivacyNotice } from "./PrivacyNotice";

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

  const input = "mt-1 w-full rounded-md border border-black/20 bg-white px-3 py-2 text-sm outline-none focus:border-live focus:ring-2 focus:ring-live/30 dark:border-white/20 dark:bg-[#18211c]";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="join-title" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <form onSubmit={submit} noValidate className="max-h-full w-full max-w-md space-y-4 overflow-auto rounded-xl bg-white p-5 shadow-2xl dark:bg-[#141b17]" data-testid="join-form">
        <div>
          <h2 id="join-title" className="font-serif text-xl font-semibold">Join the library</h2>
          <p className="text-sm opacity-70">Everyone here is busy. So are you.</p>
        </div>
        <label className="block text-sm font-medium">Name
          <input ref={first} className={input} value={form.name} onChange={set("name")} maxLength={LIMITS.name} placeholder="Mohit" name="name" autoComplete="off" disabled={busy} />
          {errors.name && <span className="text-xs text-red-600" role="alert">{errors.name}</span>}
        </label>
        <label className="block text-sm font-medium">Title
          <input className={input} value={form.title} onChange={set("title")} maxLength={LIMITS.title} placeholder="CSE Student" name="title" autoComplete="off" disabled={busy} />
          {errors.title && <span className="text-xs text-red-600" role="alert">{errors.title}</span>}
        </label>
        <label className="block text-sm font-medium">Study description
          <textarea className={input} rows={2} value={form.description} onChange={set("description")} maxLength={LIMITS.description} placeholder="Learning FastAPI + AI" name="description" disabled={busy} />
          <span className="float-right text-xs opacity-60 tabnum">{form.description.length}/{LIMITS.description}</span>
          {errors.description && <span className="text-xs text-red-600" role="alert">{errors.description}</span>}
        </label>
        <PrivacyNotice />
        {serverDown && <p className="text-sm text-red-600" role="alert">The library server is unavailable right now. Please try again shortly.</p>}
        {err && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-200" role="alert" data-testid="join-error">
            {err.message}
            {err.kind === "denied" && <p className="mt-1 opacity-80">A camera is required to study in this room. Allow camera access in your browser's address bar, then press “Try again”.</p>}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-md px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancel</button>
          <button type="submit" disabled={busy || serverDown} data-testid="join-submit" className="rounded-md bg-live px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-60">
            {phase === "camera" ? "Waiting for camera…" : phase === "connecting" ? "Joining…" : err ? "Try again" : "Turn on camera & join"}
          </button>
        </div>
      </form>
    </div>
  );
}
