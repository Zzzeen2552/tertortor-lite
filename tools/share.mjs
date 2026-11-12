// Share a finished video by link (user 2026-11-07: "video hasil dilihat oleh orang yang punya link saja").
// The render is compressed to a phone-sized MP4 (out/share.mp4, ≤ ±80 MB so it passes Cloudflare's 100 MB limit) and
// uploaded to the web relay, which keeps it on the VPS and plays it at /v/<token> without login, also while the laptop
// is off. The token is random and unlisted; "Cabut link" deletes it on the relay, so the old link stops working.
// State: videos/<slug>/share.json { token, url, at, size, rendered }.
//
//   node tools/share.mjs <slug>          make or update the link
//   node tools/share.mjs <slug> --revoke delete the link
import { existsSync, readFileSync, writeFileSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

// async so Studio keeps answering while ffmpeg runs (a 2-minute video takes about a minute)
const ff = (args) => new Promise((ok, bad) => { let err = ""; const p = spawn("ffmpeg", ["-v", "error", "-y", ...args]); p.stderr.on("data", (d) => (err += d)); p.on("error", bad); p.on("close", (c) => (c ? bad(new Error(`ffmpeg: ${err.slice(-300)}`)) : ok())); });
import { ROOT } from "./lib.mjs";

const relayConf = () => {
  const url = (process.env.RELAY_URL || "").replace(/\/$/, ""), token = process.env.RELAY_WORKER_TOKEN || "";
  if (!url || !token) throw new Error("RELAY_URL dan RELAY_WORKER_TOKEN belum diisi di .env");
  return { url, auth: { authorization: `Bearer ${token}` } };
};
// one retry on a network error (the relay restarting, a tunnel hiccup)
const fetch = async (u, o) => { try { return await globalThis.fetch(u, o); } catch { await new Promise((r) => setTimeout(r, 3000)); return globalThis.fetch(u, o); } };
const stateFile = (dir) => join(dir, "share.json");
export const shareState = (dir) => (existsSync(stateFile(dir)) ? JSON.parse(readFileSync(stateFile(dir), "utf8")) : null);

// the render this link would show, and whether the link still shows an older render
export function shareInfo(dir, slug) {
  const s = shareState(dir), out = join(dir, "out", `${slug}.mp4`);
  if (!s) return null;
  return { url: s.url, at: s.at, size: s.size, stale: existsSync(out) && statSync(out).mtimeMs > (s.rendered ?? 0) + 1000 };
}

async function compress(dir, slug) {
  const src = join(dir, "out", `${slug}.mp4`), mp4 = join(dir, "out", "share.mp4"), jpg = join(dir, "out", "share.jpg");
  if (!existsSync(src)) throw new Error("Belum ada render (out/<slug>.mp4).");
  if (!existsSync(mp4) || statSync(mp4).mtimeMs < statSync(src).mtimeMs) {
    // H.264 CRF 23 capped at 3.5 Mbit/s: a 179 s video stays under ±80 MB; faststart so the phone starts playing at once
    await ff(["-i", src, "-c:v", "libx264", "-preset", "medium", "-crf", "23", "-maxrate", "3500k", "-bufsize", "7000k",
      "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", mp4]);
    await ff(["-ss", "1", "-i", src, "-frames:v", "1", "-vf", "scale=540:-2", "-q:v", "4", jpg]).catch(() => {});
  }
  if (statSync(mp4).size > 95e6) throw new Error("Video bagikan > 95 MB (batas Cloudflare).");
  return { mp4, jpg, rendered: statSync(src).mtimeMs };
}

export async function share(dir, slug, title) {
  const { url, auth } = relayConf();
  const { mp4, jpg, rendered } = await compress(dir, slug);
  const old = shareState(dir);
  const r = await fetch(`${url}/worker/share`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ token: old?.token, title: title || slug }), signal: AbortSignal.timeout(30e3) });
  if (!r.ok) throw new Error(`relay: ${r.status} ${await r.text()}`);
  const { token } = await r.json();
  // pieces of 3 MB: Cloudflare ends a request after ±100 s, and a slow home upload (measured ±67 KB/s, 2026-11-09)
  // moved 6 MB in 90 s, too close; 3 MB leaves room.
  // A piece that fails is sent again (up to 3 times); the relay appends them and publishes the file after the last one.
  const PIECE = 3e6;
  for (const [kind, file, type] of [["video", mp4, "video/mp4"], ["poster", jpg, "image/jpeg"]]) {
    if (!existsSync(file)) continue;
    const buf = readFileSync(file), of = Math.max(1, Math.ceil(buf.length / PIECE));
    for (let part = 0; part < of; part++) {
      const body = buf.subarray(part * PIECE, (part + 1) * PIECE);
      for (let tries = 1; ; tries++) {
        const u = await fetch(`${url}/worker/share/${token}/${kind}?part=${part}&of=${of}&at=${part * PIECE}`, { method: "PUT", headers: { ...auth, "content-type": type }, body, signal: AbortSignal.timeout(110e3) }).catch((e) => ({ ok: false, status: 0, text: async () => e.message }));
        if (u.ok) break;
        if (tries >= 3) throw new Error(`relay ${kind} bagian ${part + 1}/${of}: ${u.status} ${await u.text()}`);
      }
      if (kind === "video" && process.stdout.isTTY) process.stdout.write(`\r  unggah ${part + 1}/${of}`);
    }
  }
  const s = { token, url: `${url}/v/${token}`, at: new Date().toISOString(), size: statSync(mp4).size, rendered };
  writeFileSync(stateFile(dir), JSON.stringify(s, null, 2) + "\n");
  return s;
}

export async function revoke(dir) {
  const s = shareState(dir);
  if (!s) return { ok: true };
  const { url, auth } = relayConf();
  const r = await fetch(`${url}/worker/share/${s.token}`, { method: "DELETE", headers: auth, signal: AbortSignal.timeout(30e3) });
  if (!r.ok && r.status !== 404) throw new Error(`relay: ${r.status} ${await r.text()}`);
  unlinkSync(stateFile(dir));
  return { ok: true };
}

if (process.argv[1]?.endsWith("share.mjs")) {
  const [slug, flag] = process.argv.slice(2);
  const dir = slug && join(ROOT, "videos", slug);
  if (!dir || !existsSync(dir)) { console.error("Usage: node tools/share.mjs <slug> [--revoke]"); process.exit(1); }
  try {
    if (flag === "--revoke") { await revoke(dir); console.log("✔ link dicabut"); }
    else { const meta = existsSync(join(dir, "request.json")) ? JSON.parse(readFileSync(join(dir, "request.json"), "utf8")) : {}; const s = await share(dir, slug, meta.title); console.log(`✔ ${s.url} (${(s.size / 1e6).toFixed(1)} MB)`); }
  } catch (e) { console.error("✖ " + e.message); process.exit(1); }
}
