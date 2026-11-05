import { config, livekitConfigured } from "./config.js";
import { createStore } from "./redis/store.js";
import { createApp } from "./app.js";

const store = createStore(config.redisUrl);
const { http, svc, io } = createApp(store);

http.listen(config.port, () => {
  console.log(`[server] listening on :${config.port} (${config.nodeEnv})`);
  console.log(`[server] LiveKit: ${livekitConfigured() ? "configured" : config.allowMockMedia ? "NOT configured — mock media mode" : "NOT configured"}`);
});

const shutdown = async () => { svc.stop(); io.close(); await store.close(); process.exit(0); };
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
