// Responsive + crowd checks: layout at laptop/tablet/phone sizes with 2, 30 and 45 people in the room.
// Needs the server and client running (like e2e/run.mjs).  Usage:  node e2e/responsive.mjs
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const { io } = require("socket.io-client");

const BASE = process.env.BASE ?? "http://localhost:5173", API = process.env.API ?? "http://localhost:4000";
let failed = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); if (!c) failed++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- a crowd of synthetic students (real sessions + sockets, so the app sees them exactly like real users) ----
const crowd = [];
async function addCrowd(n) {
  while (crowd.length < n) {
    const i = crowd.length;
    const body = {
      name: i === 2 ? "Maximiliano-Alexander Fitzgerald-Thornton".slice(0, 40) : `Student ${i + 1}`, title: "Tester",
      description: i === 2 ? "x".repeat(120) + "_unbroken_word" : "studying quietly",
    };
    const r = await fetch(`${API}/api/sessions`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.9.${i >> 8}.${i & 255}` }, body: JSON.stringify(body) });
    if (r.status !== 201) throw new Error(`could not add student ${i + 1}: HTTP ${r.status}`);
    const { sessionId } = await r.json();
    const s = io(API, { path: "/socket.io", transports: ["websocket"], forceNew: true });
    await new Promise((res, rej) => { s.once("connect", res); s.once("connect_error", rej); });
    await new Promise((res) => s.emit("join", { sessionId }, res));
    s.emit("media:state", { state: "publishing" });
    crowd.push({ id: sessionId, s, hb: setInterval(() => s.emit("heartbeat"), 5000) });
  }
  await sleep(600);
}
async function dismissCrowd() {
  for (const c of crowd) { clearInterval(c.hb); c.s.close(); await fetch(`${API}/api/sessions/${c.id}/leave`, { method: "POST" }).catch(() => {}); }
  crowd.length = 0;
}

// ---- measurements taken inside the page ----
const measure = () => {
  const vh = innerHeight, de = document.documentElement, header = document.querySelector("header");
  const rects = [...document.querySelectorAll('[data-testid="tile"]')].map((t) => t.getBoundingClientRect());
  return {
    overflowX: de.scrollWidth > de.clientWidth + 1, headerOverflow: header.scrollWidth > header.clientWidth + 1, tiles: rects.length,
    fullyVisible: rects.filter((r) => r.top >= 0 && r.bottom <= vh).length, minW: Math.round(Math.min(...rects.map((r) => r.width))),
    cols: new Set(rects.map((r) => Math.round(r.left))).size, hidden: (document.querySelector('[data-testid="hidden-count"]') || {}).innerText || "",
  };
};
const openPage = async (browser, w, h, mobile = false) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  const p = await ctx.newPage(); await p.goto(BASE); return p;
};
const settle = async (p, n) => {
  await p.waitForFunction((k) => document.querySelectorAll('[data-testid="tile"]').length === k, Math.min(n, 30), { timeout: 15000 });
  await p.waitForTimeout(300);
};

const browser = await chromium.launch();
try {
  await addCrowd(2);
  let p = await openPage(browser, 1440, 900); await settle(p, 2);
  let m = await p.evaluate(measure);
  ok(m.minW >= 300 && !m.overflowX, `laptop 1440x900, 2 people: tiles grow to ${m.minW}px instead of staying tiny, no sideways scroll`);

  await addCrowd(30); await p.reload(); await settle(p, 30);
  m = await p.evaluate(measure);
  ok(m.fullyVisible === 30 && m.minW >= 140, `laptop 1440x900, 30 people: all ${m.fullyVisible}/30 tiles fit on one screen, ${m.minW}px wide (readable minimum 140)`);

  await addCrowd(45); await p.reload(); await settle(p, 45);
  m = await p.evaluate(measure);
  ok(m.tiles === 30 && /\+15 more/.test(m.hidden), `laptop, 45 people: shows 30 tiles and "${m.hidden.slice(0, 22)}..." for the rest`);

  const exp = p.locator('[data-testid="tile"]', { hasText: "Maximiliano" }).locator("button[aria-expanded]");
  await exp.first().click(); await p.waitForTimeout(200);
  const clipped = await p.evaluate(() => { const a = [...document.querySelectorAll('[data-testid="tile"]')].find((t) => /Maximiliano/.test(t.innerText)); return a.scrollWidth > a.clientWidth + 1; });
  ok(!clipped, "a very long unbroken word in a description wraps inside the tile instead of being cut off");

  await p.setViewportSize({ width: 1024, height: 768 }); await p.reload(); await settle(p, 45);
  await p.click('[data-testid="leaderboard-toggle"]'); await p.waitForTimeout(500);
  m = await p.evaluate(measure);
  ok(m.minW >= 140 && !m.overflowX, `tablet 1024x768 with the leaderboard open: tiles stay readable (${m.minW}px wide, ${m.cols} columns)`);

  p = await openPage(browser, 390, 844, true); await settle(p, 45);
  m = await p.evaluate(measure);
  ok(m.cols === 2 && m.minW >= 140 && !m.overflowX, `phone 390x844: ${m.cols} columns, ${m.minW}px tiles, no sideways scroll`);

  p = await openPage(browser, 320, 568, true); await settle(p, 45);
  m = await p.evaluate(measure);
  ok(!m.overflowX && !m.headerOverflow, "small phone 320x568: top bar and page fit the screen (no sideways scroll)");
} finally {
  await dismissCrowd(); await browser.close();
}
console.log(failed ? `\n${failed} FAILED` : "\nAll responsive checks passed");
process.exit(failed ? 1 : 0);
