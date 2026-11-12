// worker.mjs: the laptop half of TERTORTOR-on-the-web (see tools/relay.mjs, docs/hybrid-plan.md). Long-polls the relay
// over outgoing HTTPS (the laptop is never opened to the internet), replays each browser request against the Studio
// that already runs here (npm run studio, 127.0.0.1:4331) and posts the answer back. Everything the Studio does
// (new.mjs, ref.mjs, stories.mjs, cues.mjs, .events.jsonl for wait-event and Claude) keeps happening on this laptop.
//   npm run worker            (.env: RELAY_URL, RELAY_WORKER_TOKEN; optional STUDIO_URL)
// /files/… are answered from disk here: a video over 8 MB goes up as a small preview (540 px wide, ±1.2 Mbps, made
// once per file version in .preview/), never the full render; the full file stays on the laptop. An image over 400 KB
// (a key visual PNG is ±2.4 MB) goes up as a JPEG at most 1080 px wide (±150-250 KB): the home upload runs at ±150 KB/s,
// so one full PNG took 15 s and a project page 2-3 minutes (user 2026-11-09). ?full=1 sends the original.
import { existsSync, statSync, mkdirSync, createReadStream, renameSync } from "node:fs";
import { join, normalize, extname, sep } from "node:path";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { ROOT } from "./lib.mjs";

const RELAY = (process.env.RELAY_URL || "").replace(/\/$/, ""), TOKEN = process.env.RELAY_WORKER_TOKEN || "";
const STUDIO = (process.env.STUDIO_URL || "http://127.0.0.1:4331").replace(/\/$/, "");
if (!RELAY || !TOKEN) { console.error("worker: isi RELAY_URL dan RELAY_WORKER_TOKEN di .env"); process.exit(1); }
const AUTH = { authorization: `Bearer ${TOKEN}` };
const LOOPS = 4; // parallel requests (a page load fires several fetches + images at once)
const PREVIEW_OVER = 8e6, MAX_FILE = 95e6; // Cloudflare Tunnel: request bodies up to 100 MB (free plan)
const PREVIEW = join(ROOT, ".preview");
const VIDEO = new Set([".mp4", ".mov", ".webm", ".mkv"]);
const IMAGE = new Set([".png", ".jpg", ".jpeg", ".webp"]), IMAGE_OVER = 4e5;
const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm", ".wav": "audio/wav", ".m4a": "audio/mp4", ".mp3": "audio/mpeg", ".md": "text/plain; charset=utf-8", ".json": "application/json", ".ico": "image/x-icon" };
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);

const answer = (id, status, body, { type = "application/json", mtime } = {}) =>
  fetch(`${RELAY}/worker/result/${id}`, {
    method: "POST", duplex: "half",
    headers: { ...AUTH, "x-status": String(status), "x-type": type, ...(mtime ? { "x-mtime": String(Math.round(mtime)) } : {}) },
    body: typeof body === "string" ? body : body ?? "",
  });

// one preview per (file, mtime); concurrent requests for the same file share the transcode
const making = new Map();
function preview(abs, st, image = false) {
  const out = join(PREVIEW, createHash("sha1").update(`${abs}|${st.mtimeMs}`).digest("hex") + (image ? ".jpg" : ".mp4"));
  if (existsSync(out)) return Promise.resolve(out);
  if (making.has(out)) return making.get(out);
  mkdirSync(PREVIEW, { recursive: true });
  const p = new Promise((ok, bad) => {
    const part = out + (image ? ".part.jpg" : ".part.mp4");
    const args = image
      ? ["-y", "-v", "error", "-i", abs, "-vf", "scale='min(1080,iw)':-2:flags=lanczos", "-frames:v", "1", "-q:v", "3", part]
      : ["-y", "-v", "error", "-i", abs, "-vf", "scale=540:-2", "-c:v", "libx264", "-preset", "veryfast", "-b:v", "1200k", "-maxrate", "1500k", "-bufsize", "3000k",
        "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", part];
    const c = spawn("ffmpeg", args, { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    let err = ""; c.stderr.on("data", (d) => (err += d));
    c.on("error", bad).on("exit", (code) => (code === 0 ? (renameSync(part, out), ok(out)) : bad(new Error(err.slice(-300) || `ffmpeg ${code}`))));
  }).finally(() => making.delete(out));
  making.set(out, p);
  return p;
}

async function fileJob(job) {
  const rel = normalize(decodeURIComponent(job.path.split("?")[0].slice("/files/".length)));
  if (rel.startsWith("..") || !/^(videos|library)[\\/]/.test(rel)) return answer(job.id, 403, JSON.stringify({ error: "forbidden" }));
  const abs = join(ROOT, rel);
  if (!abs.startsWith(ROOT + sep) || !existsSync(abs) || statSync(abs).isDirectory()) return answer(job.id, 404, JSON.stringify({ error: "not found" }));
  const st = statSync(abs);
  if (job.ifMtime && Math.abs(job.ifMtime - st.mtimeMs) < 1000) return answer(job.id, 304, "", { mtime: st.mtimeMs });
  const ext = extname(abs).toLowerCase();
  let src = abs;
  const full = /[?&]full=1(&|$)/.test(job.path);
  let type = VIDEO.has(ext) ? "video/mp4" : MIME[ext] || "application/octet-stream";
  if (VIDEO.has(ext) && st.size > PREVIEW_OVER) { log("preview", rel); src = await preview(abs, st); }
  else if (IMAGE.has(ext) && st.size > IMAGE_OVER && !full) { src = await preview(abs, st, true).catch(() => abs); if (src !== abs) type = "image/jpeg"; }
  else if (st.size > MAX_FILE) return answer(job.id, 413, JSON.stringify({ error: "File terlalu besar untuk dibuka dari web; ada di laptop." }));
  return answer(job.id, 200, createReadStream(src), { type, mtime: st.mtimeMs });
}

async function studioJob(job) {
  const body = job.blob
    ? (await fetch(`${RELAY}/worker/blob/${job.id}`, { headers: AUTH })).body
    : job.body ? Buffer.from(job.body, "base64") : undefined;
  let r;
  try {
    r = await fetch(STUDIO + job.path, { method: job.method, duplex: "half", headers: job.type ? { "content-type": job.type } : {}, body: job.method === "GET" ? undefined : body });
  } catch {
    return answer(job.id, 503, JSON.stringify({ error: "Studio di laptop belum jalan (npm run studio)." }));
  }
  return answer(job.id, r.status, Buffer.from(await r.arrayBuffer()), { type: r.headers.get("content-type") || "application/octet-stream" });
}

async function handle(job) {
  const t = Date.now();
  try {
    const r = await (job.path.startsWith("/files/") ? fileJob(job) : studioJob(job));
    if (job.method !== "GET" || Date.now() - t > 3000) log(job.method, job.path, `${Date.now() - t} ms`, r.ok ? "" : `relay ${r.status}`);
  } catch (e) {
    log("gagal", job.method, job.path, e.message);
    await answer(job.id, 500, JSON.stringify({ error: `Worker: ${e.message}` })).catch(() => {});
  }
}

let offline = false;
async function loop() {
  for (;;) {
    try {
      const r = await fetch(`${RELAY}/worker/next?wait=25`, { headers: AUTH, signal: AbortSignal.timeout(40e3) });
      if (offline) { offline = false; log("tersambung ke", RELAY); }
      if (r.status === 204) continue;
      if (r.status === 401) { log("token ditolak relay; cek RELAY_WORKER_TOKEN"); await wait(60e3); continue; }
      if (!r.ok) { await wait(5e3); continue; }
      await handle(await r.json());
    } catch (e) {
      if (!offline) { offline = true; log("relay tidak terjangkau, coba lagi tiap 10 s:", e.cause?.code || e.message); }
      await wait(10e3);
    }
  }
}
log(`worker: ${RELAY} → ${STUDIO}`);
for (let i = 0; i < LOOPS; i++) loop();
