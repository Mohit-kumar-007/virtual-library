// End-to-end acceptance test (PRD §30). Requires: server + client running, and `playwright` installed.
// Usage: BASE=http://localhost:5173 node e2e/run.mjs
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.env.BASE ?? "http://localhost:5173";
let failed = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); if (!c) failed++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const txt = (p, sel) => p.locator(sel).first().innerText();

const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const ctx = (extra = {}) => browser.newContext({ permissions: ["camera"], ...extra });
const fill = async (p, name, title, desc) => {
  await p.fill('input[name="name"]', name); await p.fill('input[name="title"]', title); await p.fill('textarea[name="description"]', desc);
};

try {
  // AT-01 open site, count visible, empty state
  const a = await (await ctx()).newPage();
  const errors = []; a.on("pageerror", (e) => errors.push(e.message));
  await a.goto(BASE);
  await a.waitForSelector('[data-testid="active-count"]');
  ok((await txt(a, '[data-testid="active-count"]')).includes("0"), "AT-01 library loads, active count visible (0)");
  ok(await a.locator('[data-testid="empty-library"]').isVisible(), "Edge: empty-library message shown with JOIN CTA");

  // AT-02 / validation / privacy
  await a.click('[data-testid="join-button"]');
  ok(await a.locator('[data-testid="join-form"]').isVisible(), "AT-02 join form appears");
  ok((await txt(a, '[data-testid="privacy-notice"]')).includes("not recorded"), "FR-12 privacy notice shown");
  await a.click('[data-testid="join-submit"]');
  ok((await a.locator('[role="alert"]').count()) >= 3, "validation errors for empty form");

  // AT-03/04/05: submit -> camera -> in grid, timer ticks
  await fill(a, "Mohit", "CSE Student", "Learning FastAPI");
  await a.click('[data-testid="join-submit"]');
  await a.waitForSelector('[data-testid="own-tile"]', { timeout: 10000 });
  ok(true, "AT-03/04 camera granted, participant enters grid (own tile)");
  const t1 = await txt(a, '[data-testid="own-tile"] [data-testid="timer"]');
  await sleep(2200);
  const t2 = await txt(a, '[data-testid="own-tile"] [data-testid="timer"]');
  ok(/^\d\d:\d\d:\d\d$/.test(t1) && t1 !== t2, `AT-05 timer increments (${t1} -> ${t2})`);
  ok((await txt(a, '[data-testid="own-tile"]')).includes("Learning FastAPI"), "FR-07 metadata on own tile");
  const live = await a.evaluate(() => { const v = document.querySelector('[data-testid="own-tile"] video'); return v && v.srcObject && v.srcObject.getVideoTracks().length === 1 && v.srcObject.getAudioTracks().length === 0; });
  ok(live, "FR-02/FR-08 own live video present, no audio track");
  await a.waitForFunction(() => document.querySelector('[data-testid="active-count"]').innerText.startsWith("1"));
  ok(true, "FR-05 active count = 1");

  // AT-06: second user sees the participant + same timer; AT-09 no login
  const b = await (await ctx()).newPage(); b.on("pageerror", (e) => errors.push(e.message));
  await b.goto(BASE);
  await b.waitForSelector('[data-testid="tile"]');
  ok((await txt(b, '[data-testid="tile-name"]')) === "Mohit", "AT-06 other visitor sees Mohit's tile");
  await b.click('[data-testid="join-button"]');
  await fill(b, "Ananya", "Exam prep", "JEE physics");
  await b.click('[data-testid="join-submit"]');
  await b.waitForSelector('[data-testid="own-tile"]');
  ok(true, "AT-09 second visitor joined with no account");
  await a.waitForFunction(() => document.querySelectorAll('[data-testid="tile"]').length === 1);
  await a.waitForFunction(() => document.querySelector('[data-testid="active-count"]').innerText.startsWith("2"));
  ok(true, "presence: A sees B appear, count = 2");
  const ta = await txt(b, '[data-testid="tile"] [data-testid="timer"]');
  const ta2 = await txt(a, '[data-testid="own-tile"] [data-testid="timer"]');
  const secs = (s) => s.split(":").reduce((x, y) => x * 60 + +y, 0);
  ok(Math.abs(secs(ta) - secs(ta2)) <= 2, `public timer matches own timer (${ta} vs ${ta2})`);

  // AT-07 leaderboard
  await b.click('[data-testid="leaderboard-toggle"]');
  const rows = await b.locator('[data-testid="leaderboard-row"]').allInnerTexts();
  ok(rows.length === 2 && rows[0].includes("Mohit") && rows[1].includes("Ananya"), "AT-07 leaderboard sorted by current duration");
  await b.click('[data-testid="leaderboard-toggle"]');
  ok((await b.locator('[data-testid="leaderboard"]').count()) === 0, "leaderboard can be hidden");

  // AT-10 temporary disconnect: offline 3s (< grace 6s) then back
  await b.context().setOffline(true); await sleep(1500);
  await a.waitForFunction(() => /Reconnecting/.test(document.body.innerText), null, { timeout: 8000 });
  ok(true, "AT-10 others see 'Reconnecting…' during network loss");
  await b.context().setOffline(false);
  await a.waitForFunction(() => !/Reconnecting/.test(document.body.innerText), null, { timeout: 15000 });
  ok(true, "AT-10 session survives short disconnect");

  // Long network loss ends session (grace 6s)
  await b.context().setOffline(true);
  await a.waitForFunction(() => document.querySelectorAll('[data-testid="tile"]').length === 0, null, { timeout: 20000 });
  ok(true, "long network loss: participant removed after grace period");
  await b.context().setOffline(false);
  await b.waitForSelector('[data-testid="notice"]', { timeout: 20000 });
  ok(true, "expired user is told their session ended");

  // AT-08 leave
  await a.click('[data-testid="leave-button"]');
  await a.waitForSelector('[data-testid="join-button"]');
  const stopped = await a.evaluate(() => !document.querySelector('[data-testid="own-tile"]'));
  ok(stopped, "AT-08 own tile gone after LEAVE, JOIN button back");
  await a.waitForFunction(() => document.querySelector('[data-testid="active-count"]').innerText.startsWith("0"));
  ok(true, "count back to 0");

  // Camera denied
  const c = await (await browser.newContext({ permissions: [] })).newPage();
  await c.addInitScript(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError")); });
  await c.goto(BASE); await c.click('[data-testid="join-button"]'); await fill(c, "X", "Y", "Z");
  await c.click('[data-testid="join-submit"]');
  await c.waitForSelector('[data-testid="join-error"]');
  ok((await txt(c, '[data-testid="join-error"]')).includes("denied") && (await txt(c, '[data-testid="join-submit"]')) === "Try again", "Edge: camera denied explained + retry");
  ok((await a.evaluate(() => fetch("/api/rooms/main-library").then((r) => r.json()))).activeCount === 0, "denied camera leaves no orphan session");

  // Responsive: mobile viewport, dark mode
  const m = await (await ctx({ viewport: { width: 375, height: 700 } })).newPage();
  await m.goto(BASE);
  ok(await m.locator('[data-testid="join-button"]').isVisible(), "FR-11 mobile: JOIN visible");
  ok(await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "mobile: no horizontal overflow");
  await m.click('[data-testid="dark-toggle"]');
  ok(await m.evaluate(() => document.documentElement.classList.contains("dark")), "dark mode toggles");

  ok(errors.length === 0, `no uncaught page errors ${errors.join("|")}`);
} catch (e) {
  console.error(e); failed++;
} finally {
  await browser.close();
}
console.log(failed ? `\n${failed} FAILED` : "\nALL PASSED");
process.exit(failed ? 1 : 0);
