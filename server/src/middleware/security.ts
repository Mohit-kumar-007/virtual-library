import rateLimit from "express-rate-limit";
import { config } from "../config.js";

export const joinLimiter = rateLimit({
  windowMs: 60_000, limit: config.joinRateLimitPerMin, standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many join attempts. Please wait a minute." },
});

export const generalLimiter = rateLimit({
  windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many requests." },
});

export const reportLimiter = rateLimit({
  windowMs: 60_000, limit: 5, standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many reports." },
});
