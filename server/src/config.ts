import "dotenv/config";

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && v !== undefined && v !== "" ? n : d;
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
  joinRateLimitPerMin: num(process.env.JOIN_RATE_LIMIT_PER_MIN, 10),
  mongoUri: process.env.MONGODB_URI ?? "",
};

export const livekitConfigured = () =>
  Boolean(config.livekit.url && config.livekit.apiKey && config.livekit.apiSecret);
