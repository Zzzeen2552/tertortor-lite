// event-runner.mjs: Studio clicks are handled even when no Claude session is waiting (user 2026-11-23: Ciputra 1 "kenapa
// production macet?" → "fix problemnya biar gak keulang"). A click (.events.jsonl) used to sit there until someone typed
// "lanjut" in Claude Desktop. Now Studio checks every 15 s: an event that no session took within GRACE seconds (no fresh
// .waiting heartbeat from tools/wait-event.mjs) is handed to Claude Code headless (`claude -p`) in this folder, with the
// same CLAUDE.md, one run at a time. A session that IS waiting still gets the click first, as before.
//
// Files (all gitignored): .events.runner = how many event lines this runner has looked at; .runner.json = the run in
// progress { pid, event, log, at } (Studio shows "Claude bekerja" from it); .event-runs/<time>-<type>-<slug>.log = what
// the run did. The run is detached, so a Studio restart (node --watch) does not kill it.
//
// Safety: there is no permission prompt in a headless run, so the tools are an allowlist: edit files here, read/search,
// node/npm/npx hyperframes/ffmpeg, Chrome (ChatGPT, muse.ai, AI Studio). Commit, push, Tebar send, publish,
// rm and wait-event are refused. Paid generation follows the same CLAUDE.md rules as any session.
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync, openSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { ROOT } from "./lib.mjs";
import { PROCESSES } from "./progress.mjs";


const EVENTS = join(ROOT, ".events.jsonl"), SEEN = join(ROOT, ".events.seen"), CURSOR = join(ROOT, ".events.runner");
const BEAT = join(ROOT, ".waiting"), RUN = join(ROOT, ".runner.json"), LOGS = join(ROOT, ".event-runs");
const GRACE = 45; // seconds a waiting session gets before the runner takes the click
const BIN = process.env.CLAUDE_BIN || (existsSync(join(homedir(), ".local", "bin", "claude.exe")) ? join(homedir(), ".local", "bin", "claude.exe") : "claude");

const ALLOWED = [
  "Read", "Glob", "Grep", "Edit", "Write", "WebSearch", "WebFetch", "Agent", "Skill", "ToolSearch",
  "Bash(npm run *)", "Bash(node tools/*)", "Bash(node *)", "Bash(npx hyperframes *)", "Bash(ffmpeg *)", "Bash(ffprobe *)",
  "Bash(ls *)", "Bash(cat *)", "Bash(head *)", "Bash(tail *)", "Bash(wc *)", "Bash(mkdir *)", "Bash(cp *)", "Bash(mv *)",
  "Bash(powershell -Command *Set-Clipboard*)", "Bash(git status*)", "Bash(git diff*)", "Bash(git log*)",
  "mcp__claude-in-chrome",
];
const DENIED = [
  "Bash(git commit*)", "Bash(git push*)", "Bash(git reset*)", "Bash(git checkout*)", "Bash(git clean*)", "Bash(rm *)",
  "Bash(node tools/tebar.mjs send*)", "Bash(node tools/wait-event.mjs*)", "Bash(npx hyperframes publish*)", "Bash(taskkill*)",
];
const SYSTEM = `You were started by TERTORTOR Studio because the user clicked something and no Claude session was waiting for it.
- Handle ONLY the event in the prompt, exactly as CLAUDE.md § "Pemicu dari TERTORTOR" says for that event type, then stop where the user has to decide.
- Write a job line after each finished job: node tools/jobline.mjs <slug> <Peran> "<keputusan>" (the user follows them in Studio and on the phone).
- There is no permission prompt. If a tool is refused, Chrome is not connected, an account needs the user's login, or a cost needs the user's yes, write one job line "Editor: berhenti, <alasan singkat>" and stop. Never work around a refused tool.
- Never run tools/wait-event.mjs, never commit/push, never send to Tebar, never publish.`;

const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const lines = () => (existsSync(EVENTS) ? readFileSync(EVENTS, "utf8").split("\n").filter(Boolean) : []);
const waitingSession = () => existsSync(BEAT) && Date.now() - statSync(BEAT).mtimeMs < 10e3;

// the run in progress, or null (a finished or killed run is cleared here)
export function running() {
  if (!existsSync(RUN)) return null;
  try { const r = JSON.parse(readFileSync(RUN, "utf8")); if (r.pid && alive(r.pid)) return r; } catch {}
  return null;
}
// a run that ended: tell the user on the video page when it could not even start (CLI logged out, not installed), so a
// click never goes quiet again (user 2026-11-23: the CLI was logged out and nothing said so)
function reportEnded() {
  if (!existsSync(RUN)) return;
  let r; try { r = JSON.parse(readFileSync(RUN, "utf8")); } catch { return; }
  if (r.reported || (r.pid && alive(r.pid))) return;
  const tail = existsSync(r.log) ? readFileSync(r.log, "utf8").slice(-4000) : "";
  const why = /session has expired|auth login|not logged in|Invalid API key/i.test(tail) ? "Claude Code di laptop belum login: jalankan `claude auth login` di terminal, lalu klik lagi"
    : /ENOENT|not recognized|spawn/i.test(tail) && tail.length < 600 ? "Claude Code tidak ditemukan di laptop (CLAUDE_BIN)" : null;
  if (why && r.event?.slug && existsSync(join(ROOT, "videos", r.event.slug)))
    appendFileSync(join(ROOT, "videos", r.event.slug, "joblines.jsonl"), JSON.stringify({ at: new Date().toISOString(), role: "Editor", text: `berhenti, ${why}` }) + "\n");
  writeFileSync(RUN, JSON.stringify({ ...r, reported: true, failed: why }));
}

function start(e) {
  mkdirSync(LOGS, { recursive: true });
  const log = join(LOGS, `${e.at.replace(/[:.]/g, "-")}-${e.type}-${e.slug}.log`);
  const fd = openSync(log, "a");
  const prompt = `Event dari TERTORTOR Studio yang belum ditangani sesi mana pun:\n${JSON.stringify(e)}\nTangani event ini sekarang.`;
  const child = spawn(BIN, ["-p", prompt, "--output-format", "stream-json", "--verbose", "--permission-mode", "acceptEdits",
    "--allowedTools", ...ALLOWED, "--disallowedTools", ...DENIED, "--append-system-prompt", SYSTEM],
    { cwd: ROOT, windowsHide: true, detached: true, stdio: ["ignore", fd, fd], env: { ...process.env, TERTORTOR_RUNNER: "1" } });
  child.unref();
  writeFileSync(RUN, JSON.stringify({ pid: child.pid, event: e, log, at: new Date().toISOString() }));
  if (e.slug && existsSync(join(ROOT, "videos", e.slug)))
    appendFileSync(join(ROOT, "videos", e.slug, "joblines.jsonl"), JSON.stringify({ at: new Date().toISOString(), role: "Editor", text: `Studio menjalankan Claude untuk klik ${e.type} (tidak ada sesi yang menunggu)` }) + "\n");
  console.log(`event-runner: ${e.type} ${e.slug} → claude pid ${child.pid}`);
}

// one look: take the oldest click nobody handled, if nothing is running
export function tick() {
  const all = lines();
  if (!existsSync(CURSOR)) { writeFileSync(CURSOR, String(all.length)); return; } // first start: never replay old clicks
  let cur = +readFileSync(CURSOR, "utf8") || 0;
  if (cur > all.length) cur = all.length;
  if (running()) return;
  reportEnded();
  while (cur < all.length) {
    let e; try { e = JSON.parse(all[cur]); } catch { cur++; continue; }
    // a waiting session takes it (wait-event marks it seen); a click it already saw is not ours either
    const seen = existsSync(SEEN) ? +readFileSync(SEEN, "utf8") || 0 : 0;
    if (!PROCESSES[e.type] || !e.slug || cur < seen || waitingSession()) { cur++; continue; }
    if (Date.now() - Date.parse(e.at) < GRACE * 1000) break; // give a session the chance to pick it up first
    cur++;
    writeFileSync(CURSOR, String(cur));
    // mark it seen, so a session started later does not do the same work again
    if (seen < cur) writeFileSync(SEEN, String(cur));
    start(e);
    return;
  }
  writeFileSync(CURSOR, String(cur));
}

export function startRunner() {
  if (process.env.TERTORTOR_NO_RUNNER) return;
  setInterval(() => { try { tick(); } catch (err) { console.log(`event-runner: ${err.message}`); } }, 15000);
}

if (process.argv[1]?.endsWith("event-runner.mjs")) {
  const cmd = process.argv[2];
  if (cmd === "status") console.log(JSON.stringify({ running: running(), cursor: existsSync(CURSOR) ? +readFileSync(CURSOR, "utf8") : null, events: lines().length }, null, 1));
  else console.log("node tools/event-runner.mjs status");
}
