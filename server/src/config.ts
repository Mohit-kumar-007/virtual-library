import "dotenv/config";

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && v !== undefined && v !== "" ? n : d;
};

/** TRUST_PROXY: a hop count ("1", "2"), "true"/"false", or an Express subnet list. Default 1 (Nginx only). */
const parseTrustProxy = (v: string | undefined): number | boolean | string => {
  const t = (v ?? "").trim();
  if (t === "") return 1;
  if (/^\d+$/.test(t)) return Number(t);
  if (t === "true") return true;
  if (t === "false") return false;
  return t;
};

export const config = {
  port: num(process.env.PORT, 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  clientOrigins: (process.env.CLIENT_ORIGIN ?? "http://localhost:5173")
    .split(",").map((s) => s.trim()).filter(Boolean),
  redisUrl: process.env.REDIS_URL ?? "",
  livekit: {
    url: process.env.LIVEKIT_URL ?? "",
    apiKey: process.env.LIVEKIT_API_KEY ?? "",
    apiSecret: process.env.LIVEKIT_API_SECRET ?? "",
    tokenTtlSeconds: num(process.env.LIVEKIT_TOKEN_TTL, 600),
  },
  /** When true and LiveKit is not configured, media-token returns a mock marker (local-only camera). */
  allowMockMedia: (process.env.ALLOW_MOCK_MEDIA ?? "true") === "true",
  roomId: process.env.ROOM_ID ?? "main-library",
  roomCapacity: num(process.env.ROOM_CAPACITY, 100),
  graceSeconds: num(process.env.GRACE_SECONDS, 45),
  heartbeatIntervalMs: 5000,
  adminToken: process.env.ADMIN_TOKEN ?? "",
  /** New sessions allowed per visitor IP per minute. 30 so a whole class behind one shared Wi-Fi IP can join together. */
  joinRateLimitPerMin: num(process.env.JOIN_RATE_LIMIT_PER_MIN, 30),
  /** Reverse proxies in front of the API: 1 = Nginx only, 2 = Caddy (https profile) then Nginx. A wrong value makes every visitor share one rate limit. */
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  mongoUri: process.env.MONGODB_URI ?? "",
};

export const livekitConfigured = () =>
  Boolean(config.livekit.url && config.livekit.apiKey && config.livekit.apiSecret);
