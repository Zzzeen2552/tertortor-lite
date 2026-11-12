// wait-event.mjs: block until the user decides something in TERTORTOR (any project), then exit printing the new
// events. A Claude session keeps this running in the background; its exit wakes the session, which handles the
// events (see CLAUDE.md § Pemicu dari TERTORTOR) and starts it again. Events come from tools/studio/server.mjs.
//   node tools/wait-event.mjs [--timeout 14400]
// Each event is one JSON line: { at, type: spot|kv|concept|script-approved, slug, id? }. Events already handled are
// skipped via .events.seen (the line count read last time), so nothing fires twice and nothing is missed between runs.
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./lib.mjs";

const EVENTS = join(ROOT, ".events.jsonl"), SEEN = join(ROOT, ".events.seen");
// heartbeat (user 2026-11-07): Studio reads .waiting's age to tell the user whether a Claude session will pick up a click
const BEAT = join(ROOT, ".waiting");
const beat = () => { try { writeFileSync(BEAT, JSON.stringify({ pid: process.pid, at: new Date().toISOString() })); } catch {} };
const unbeat = () => { try { if (JSON.parse(readFileSync(BEAT, "utf8")).pid === process.pid) unlinkSync(BEAT); } catch {} };
process.on("exit", unbeat);
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(sig, () => process.exit(130));
const args = process.argv.slice(2);
const ti = args.indexOf("--timeout");
const timeout = ti >= 0 ? +args[ti + 1] : 14400;
const lines = () => (existsSync(EVENTS) ? readFileSync(EVENTS, "utf8").split("\n").filter(Boolean) : []);
const seen = existsSync(SEEN) ? +readFileSync(SEEN, "utf8") || 0 : lines().length;
const t0 = Date.now();
const tick = () => {
  beat();
  const all = lines();
  if (all.length > seen) {
    writeFileSync(SEEN, String(all.length));
    for (const l of all.slice(seen)) {
      const e = JSON.parse(l);
      console.log(`event ${e.type} · ${e.slug}${e.id ? ` · ${e.id}` : ""} · ${e.at}`);
    }
    return;
  }
  if (Date.now() - t0 > timeout * 1000) return console.log(`timeout: no Studio event in ${timeout}s`), process.exit(2);
  setTimeout(tick, 2000);
};
tick();
