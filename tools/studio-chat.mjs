// studio-chat.mjs: the Chat panel in TERTORTOR Studio (user 2026-11-13). Each message runs Claude Code headless in this folder
// (`claude -p`, stream-json) and continues the same conversation with --resume, so the user can talk to Claude without
// switching to Claude Desktop. It reads the same CLAUDE.md, so it knows every workflow here.
// State in .studio-chat.json (gitignored): { sessionId, messages: [{ role: user|assistant|tool|error|info, text, at }] }.
// One claude process at a time; messages sent while it works wait in a queue. Only the child this module started is ever
// stopped (never other node/claude processes: other sessions run tools/wait-event.mjs).
// Safety: no permission prompt is possible here, so tools are limited: edits in this folder (acceptEdits), read/search,
// npm/node tools/npx hyperframes, read-only git. Commit, push, Buffer send, and publish are refused; Claude is told to ask
// the user to approve them in chat first and to do anything outside the allowlist in Claude Desktop.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { ROOT } from "./lib.mjs";

const FILE = join(ROOT, ".studio-chat.json");
const ARCHIVE = join(ROOT, ".studio-chat");
const BIN = process.env.CLAUDE_BIN || (existsSync(join(homedir(), ".local", "bin", "claude.exe")) ? join(homedir(), ".local", "bin", "claude.exe") : "claude");
const MAX_MESSAGES = 400;

const ALLOWED = [
  "Read", "Glob", "Grep", "Edit", "Write", "NotebookEdit", "WebSearch", "WebFetch",
  "Bash(npm run *)", "Bash(npm install*)", "Bash(node tools/*)", "Bash(npx hyperframes *)", "Bash(ffprobe *)",
  "Bash(git status*)", "Bash(git diff*)", "Bash(git log*)", "Bash(git show*)", "Bash(ls *)", "Bash(cat *)", "Bash(head *)", "Bash(tail *)", "Bash(wc *)",
];
const DENIED = [
  "Bash(git commit*)", "Bash(git push*)", "Bash(git reset*)", "Bash(git checkout*)", "Bash(git clean*)", "Bash(rm *)",
  "Bash(node tools/buffer.mjs send*)", "Bash(node tools/wait-event.mjs*)", "Bash(npx hyperframes publish*)", "Bash(taskkill*)",
];
const SYSTEM = `You are answering from the Chat panel inside TERTORTOR Studio (the user's dashboard at localhost:4331, TERTORTOR LITE), not from Claude Desktop.
- Reply in casual Indonesian, short and plain: the panel is narrow and often read on a phone.
- There is no permission prompt here. If a tool is denied, say what you wanted to run and ask the user to do it in Claude Desktop (or to approve a different route); never try to get around the limit.
- Never commit, push, send to Buffer, publish, delete videos, or spend money/credits (RunningHub coins, paid APIs) unless the user asked for that exact action in this chat. Free Flow images are fine when the user asks for them.
- Do not run tools/wait-event.mjs and do not edit .events.jsonl: Studio clicks already reach the sessions that wait for them.
- When a page context line like "[Studio: …]" opens a message, it tells you which video or page the user is looking at.`;

let child = null, queue = [], startedAt = null;

function load() {
  try { return JSON.parse(readFileSync(FILE, "utf8")); } catch { return { sessionId: null, messages: [] }; }
}
function save(s) {
  s.messages = s.messages.slice(-MAX_MESSAGES);
  writeFileSync(FILE + ".tmp", JSON.stringify(s, null, 1));
  renameSync(FILE + ".tmp", FILE);
}
function push(msg) { const s = load(); s.messages.push({ ...msg, at: new Date().toISOString() }); save(s); }

// one line per tool call, enough to follow along without the full output
function toolLine(name, input = {}) {
  const v = input.command ?? input.file_path ?? input.path ?? input.pattern ?? input.url ?? input.query ?? input.description ?? "";
  return `${name}${v ? ": " + String(v).replace(/\s+/g, " ").slice(0, 160) : ""}`;
}

export function state() {
  const s = load();
  return { sessionId: s.sessionId, running: !!child, startedAt, queued: queue.map((q) => q.text), messages: s.messages };
}

export function send(text, context = "") {
  text = String(text || "").trim();
  if (!text) throw new Error("Pesan kosong.");
  if (text.length > 20000) throw new Error("Pesan terlalu panjang.");
  push({ role: "user", text });
  queue.push({ text, context: String(context || "").slice(0, 300) });
  if (!child) next();
  return state();
}

function next() {
  const job = queue.shift();
  if (!job) return;
  const s = load();
  const args = ["-p", "--output-format", "stream-json", "--verbose", "--permission-mode", "acceptEdits",
    "--allowedTools", ...ALLOWED, "--disallowedTools", ...DENIED, "--append-system-prompt", SYSTEM,
    ...(s.sessionId ? ["--resume", s.sessionId] : [])];
  startedAt = new Date().toISOString();
  try {
    child = spawn(BIN, args, { cwd: ROOT, windowsHide: true, env: { ...process.env, TERTORTOR_CHAT: "1" } });
  } catch (e) { child = null; push({ role: "error", text: `Claude tidak bisa dijalankan: ${e.message}` }); return next(); }
  const me = child;
  me.stdin.end((job.context ? `[Studio: ${job.context}]\n\n` : "") + job.text);
  let buf = "", errText = "", gotResult = false;
  me.stdout.on("data", (d) => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line) continue;
      let ev; try { ev = JSON.parse(line); } catch { continue; }
      if (ev.session_id && ev.type === "system" && ev.subtype === "init") { const st = load(); if (st.sessionId !== ev.session_id) { st.sessionId = ev.session_id; save(st); } }
      if (ev.type === "assistant") {
        for (const c of ev.message?.content ?? []) {
          if (c.type === "text" && c.text.trim()) push({ role: "assistant", text: c.text.trim() });
          else if (c.type === "tool_use") push({ role: "tool", text: toolLine(c.name, c.input) });
        }
      }
      if (ev.type === "user") {
        for (const c of ev.message?.content ?? []) {
          if (c.type === "tool_result" && c.is_error) {
            const t = (Array.isArray(c.content) ? c.content.map((x) => x.text ?? "").join(" ") : String(c.content ?? "")).replace(/\s+/g, " ");
            if (/permission|not allowed|denied|izin/i.test(t)) push({ role: "info", text: `Ditolak di panel ini: ${t.slice(0, 200)}` });
          }
        }
      }
      if (ev.type === "result") {
        gotResult = true;
        if (ev.session_id) { const st = load(); st.sessionId = ev.session_id; save(st); }
        if (ev.is_error && ev.subtype !== "success") push({ role: "error", text: `Berhenti: ${ev.subtype || "error"}${ev.result ? " · " + String(ev.result).slice(0, 300) : ""}` });
      }
    }
  });
  me.stderr.on("data", (d) => { errText = (errText + d.toString()).slice(-2000); });
  me.on("error", (e) => { errText += e.message; });
  me.on("close", (code) => {
    if (child === me) child = null;
    startedAt = null;
    if (me.killed || me.stoppedByUser) push({ role: "info", text: "Dihentikan." });
    else if (!gotResult && code !== 0) push({ role: "error", text: `Claude keluar (kode ${code}). ${errText.trim().slice(-400)}` });
    next();
  });
}

export function stop() {
  queue = [];
  if (!child) return state();
  child.stoppedByUser = true;
  // the CLI may start its own children (bash, node): end the whole tree of this one process only
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
  else child.kill("SIGTERM");
  return state();
}

export function reset() {
  stop();
  const s = load();
  if (s.messages.length) {
    mkdirSync(ARCHIVE, { recursive: true });
    writeFileSync(join(ARCHIVE, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`), JSON.stringify(s, null, 1));
  }
  save({ sessionId: null, messages: [] });
  return state();
}
