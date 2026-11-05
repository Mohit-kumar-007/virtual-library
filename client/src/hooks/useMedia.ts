import { useEffect, useState } from "react";
import type { MediaConnection } from "../services/media";

export function useRemoteTracks(conn: MediaConnection | null) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!conn) return;
    force((n) => n + 1);
    return conn.onChange(() => force((n) => n + 1));
  }, [conn]);
  return conn?.tracks ?? new Map();
}
