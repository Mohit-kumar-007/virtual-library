export class CameraError extends Error {
  constructor(message: string, public kind: "denied" | "unavailable" | "unsupported") { super(message); }
}

/** Request camera only (microphone is never requested — silent mode). Must be called after explicit JOIN. */
export async function getCameraStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia)
    throw new CameraError("Your browser doesn't support camera access (HTTPS is required).", "unsupported");
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 15, max: 24 }, facingMode: "user" },
      audio: false,
    });
  } catch (e) {
    const name = (e as DOMException).name;
    if (name === "NotAllowedError" || name === "SecurityError")
      throw new CameraError("Camera permission was denied.", "denied");
    throw new CameraError("No usable camera was found.", "unavailable");
  }
}

