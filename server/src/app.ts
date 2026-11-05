import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createServer } from "node:http";
import { config } from "./config.js";
import { createRouter } from "./api/routes.js";
import { attachRealtime } from "./realtime/socket.js";
import { SessionService } from "./services/sessionService.js";
import { generalLimiter } from "./middleware/security.js";
import type { SessionStore } from "./redis/store.js";

export function createApp(store: SessionStore) {
  const app = express();
  app.set("trust proxy", 1); // behind Nginx
  app.use(helmet());
  app.use(cors({ origin: config.clientOrigins }));
  // sendBeacon posts text/plain; accept it as JSON too.
  app.use(express.json({ limit: "10kb", type: ["application/json", "text/plain"] }));
  app.use("/api", generalLimiter);

  const svc = new SessionService(store);
  app.use("/api", createRouter(svc));

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  const http = createServer(app);
  const io = attachRealtime(http, svc, config.clientOrigins);
  svc.startSweeper();
  return { app, http, io, svc };
}
