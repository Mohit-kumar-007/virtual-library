import { config, livekitConfigured } from "./config.js";
import { createStore } from "./redis/store.js";
import { createApp } from "./app.js";

process.on("unhandledRejection", (e) => console.error("[server] unhandled rejection:", e));

const store = await createStore(config.redisUrl, config.nodeEnv === "production").catch((e: Error) => {
  console.error(`[server] ${e.message}`);
  process.exit(1);
});
const { http, svc, io } = createApp(store);

http.listen(config.port, () => {
  console.log(`[server] listening on :${config.port} (${config.nodeEnv})`);
  console.log(`[server] LiveKit: ${livekitConfigured() ? "configured" : config.allowMockMedia ? "NOT configured — mock media mode" : "NOT configured"}`);
});

const shutdown = async () => { svc.stop(); io.close(); await store.close(); process.exit(0); };
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
