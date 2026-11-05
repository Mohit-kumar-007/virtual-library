export function LegalModal({ kind, onClose }: { kind: "terms" | "privacy"; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="max-h-full w-full max-w-lg space-y-3 overflow-auto rounded-xl bg-white p-5 text-sm shadow-2xl dark:bg-[#141b17]">
        <h2 className="font-serif text-xl font-semibold">{kind === "terms" ? "Terms of Use" : "Privacy Policy"}</h2>
        {kind === "terms" ? (<>
          <p>Virtual Library is a silent co-study space. Be respectful: no nudity, harassment, hate, or illegal content on camera or in your name/title/description.</p>
          <p>You must be old enough to use a camera service in your country. We may remove any participant who breaks these rules, and you can report others with the Report button on their tile.</p>
          <p>The service is provided as-is, without warranty. <em>(Template — have this reviewed by a lawyer before public launch.)</em></p>
        </>) : (<>
          <p>No account is needed. We collect only the name, title and description you type, a temporary session ID, and live video while you're in the room.</p>
          <p>Video is streamed live to other participants and is <b>not recorded or stored</b>. Your session data is deleted when you leave. Your microphone is never used.</p>
          <p>We do not ask for email, phone, location or other personal data. <em>(Template — have this reviewed by a lawyer before public launch.)</em></p>
        </>)}
        <button onClick={onClose} className="rounded-md bg-live px-4 py-1.5 font-semibold text-white">Close</button>
      </div>
    </div>
  );
}
