// studio-chat.mjs: the Chat panel in TERTORTOR Studio.
// The brain follows .env AGENT (tools/agent.mjs, user 2026-11-23): claude (default) runs Claude Code headless
// (`claude -p`, stream-json, --resume keeps the conversation); antigravity answers through the Gemini API.
// History in .studio-chat.json.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { ROOT } from "./lib.mjs";
import { gemini } from "./gemini-api.mjs";
import { AGENT, AGENT_NAME } from "./agent.mjs";

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
  "Bash(node tools/tebar.mjs send*)", "Bash(node tools/wait-event.mjs*)", "Bash(npx hyperframes publish*)", "Bash(taskkill*)",
];
const SYSTEM = `You are ${AGENT_NAME}, answering from the Chat panel inside TERTORTOR Studio (the user's dashboard at localhost:4331, TERTORTOR LITE).
- Reply in casual Indonesian, short, helpful, and plain: the panel is narrow and often read on a phone.
- You know all workflows in TERTORTOR LITE: Video Explainer (Hyperframe, VOX, SNAPCN), Storytelling (Berakit ke Hulu, BumiDiPijak), Advertisement (Flashcut, BRI, App Demo), and Cinematic (AWS).
- Never commit, push, send to Tebar, publish, delete videos, or spend money/credits unless the user asked for that exact action.
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

async function next() {
  const job = queue.shift();
  if (!job) return;
  const s = load();
  startedAt = new Date().toISOString();

  // AGENT=antigravity: Gemini API (needs GEMINI_API_KEY)
  if (AGENT === "antigravity") {
    if (!process.env.GEMINI_API_KEY) { push({ role: "error", text: "AGENT=antigravity butuh GEMINI_API_KEY di .env." }); return next(); }
    child = { isGemini: true };
    try {
      const recent = s.messages.slice(-8).map((m) => `${m.role === "user" ? "User" : "Antigravity"}: ${m.text}`).join("\n");
      const userText = (job.context ? `[Studio: ${job.context}]\n\n` : "") + job.text;
      const prompt = `Percakapan sebelumnya:\n${recent}\n\nPesan terbaru:\n${userText}`;
      const reply = await gemini({ system: SYSTEM, text: prompt, soft: true });
      if (reply) {
        push({ role: "assistant", text: String(reply).trim() });
      }
    } catch (e) {
      push({ role: "error", text: `Antigravity error: ${e.message}` });
    } finally {
      child = null;
      startedAt = null;
      next();
    }
    return;
  }

  // AGENT=claude (default): Claude Code CLI
  const args = ["-p", "--output-format", "stream-json", "--verbose", "--permission-mode", "acceptEdits",
    "--allowedTools", ...ALLOWED, "--disallowedTools", ...DENIED, "--append-system-prompt", SYSTEM,
    ...(s.sessionId ? ["--resume", s.sessionId] : [])];
  try {
    child = spawn(BIN, args, { cwd: ROOT, windowsHide: true, env: { ...process.env, TERTORTOR_CHAT: "1" } });
  } catch (e) { child = null; push({ role: "error", text: `Claude Code tidak bisa dijalankan (${e.message}). Pasang Claude desktop app / CLI, atau set AGENT=antigravity di .env.` }); return next(); }
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
    else if (!gotResult && code !== 0) push({ role: "error", text: `Keluar (kode ${code}). ${errText.trim().slice(-400)}` });
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
