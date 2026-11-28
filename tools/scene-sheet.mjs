// scene-sheet.mjs <slug>: one picture of every shot before any clip is made (user 2026-11-23: "sebelum bikin clip, tahap
// satu tampilkan scene sheet dulu disini, jadikan ini default baru"). Storytelling (musafo.json) only.
// Per shot: its time in the voice, framing, the key visual and the image of each extra part (scene b, c, …), the spoken
// lines with the part they fall in, the camera move, and the cuts without people inside a part. The user approves the
// sheet in the chat (or asks for changes) before any Muse/H3/Flow clip is generated.
//   node tools/scene-sheet.mjs <slug>   → videos/<slug>/out/scene-sheet.png (+ scene-sheet.html)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { videoDir, readJSON, die } from "./lib.mjs";
import { musePlan } from "./musafo.mjs";

const slug = process.argv[2], dir = videoDir(slug);
if (!existsSync(join(dir, "musafo.json"))) die("scene sheet hanya untuk proyek Storytelling (musafo.json)");
const m = readJSON(join(dir, "musafo.json")), meta = readJSON(join(dir, "meta.json"));
const tl = existsSync(join(dir, "build", "timeline.json")) ? readJSON(join(dir, "build", "timeline.json")).beats : [];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
const src = (p) => (existsSync(join(dir, p)) ? pathToFileURL(join(dir, p)).href : null);

const cards = m.shots.map((s) => {
  const plan = musePlan(dir, s.id), b = tl.find((x) => x.id === s.id);
  const firstPart = (k) => plan.filter((p) => (p.fromLine ?? 0) <= k).at(-1)?.part ?? "a";
  const lines = (s.lines ?? []).map((l, k) => `<li><i>${firstPart(k)}</i>${esc(l.text)}</li>`).join("");
  const inner = (s.scenes ?? []).filter((x) => !plan.some((p) => p.fromLine === x.line && p.part !== "a"));
  const imgs = plan.map((p) => {
    const u = src(p.image);
    return `<figure>${u ? `<img src="${u}">` : `<div class="miss">belum ada</div>`}<figcaption>${s.id}-${p.part}</figcaption></figure>`;
  }).join("");
  return `<section class="card">
    <h2><b>${s.id}</b> ${b ? `${mmss(b.start)}–${mmss(b.start + b.duration)} · ${b.duration.toFixed(1)} s` : ""} · ${esc(s.framing)}</h2>
    <div class="imgs n${plan.length}">${imgs}</div>
    <ol>${lines}</ol>
    <p class="mv"><b>Kamera:</b> ${esc(s.motion)}${plan.slice(1).map((p) => ` · <b>${p.part}:</b> ${esc((s.scenes ?? []).find((x) => x.line === p.fromLine)?.motion ?? "")}`).join("")}</p>
    ${inner.length ? `<p class="mv"><b>Cut di dalam klip a:</b> ${inner.map((x) => esc(x.scene)).join(" · ")}</p>` : ""}
  </section>`;
}).join("");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#15171b;color:#e9edf1;font:15px/1.35 Inter,Segoe UI,Arial,sans-serif;width:2000px}
header{padding:22px 28px 6px;display:flex;align-items:baseline;gap:18px} header h1{margin:0;font-size:30px} header span{color:#98a2ac}
.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;padding:14px 28px 28px}
.card{background:#1f2328;border-radius:14px;padding:12px}
.card h2{margin:0 0 8px;font-size:15px;font-weight:500;color:#98a2ac} .card h2 b{color:#2BDDB0;font-size:20px;margin-right:4px}
.imgs{display:flex;gap:6px} figure{margin:0;flex:1;position:relative} .imgs.n1 figure{flex:0 0 calc(50% - 3px)} figure img,.miss{width:100%;aspect-ratio:9/16;object-fit:cover;border-radius:8px;display:block;background:#2b3036}
.miss{display:grid;place-items:center;color:#e5484d} figcaption{position:absolute;left:6px;top:6px;background:#000a;padding:1px 6px;border-radius:5px;font-size:12px}
ol{margin:8px 0 4px;padding:0;list-style:none} li{margin:3px 0} li i{font-style:normal;color:#17B8C4;font-weight:700;margin-right:6px}
.mv{margin:4px 0 0;color:#b8c1c9;font-size:13px} .mv b{color:#e9edf1}
</style></head><body><header><h1>${esc(meta.name ?? slug)}</h1><span>scene sheet · ${m.shots.length} shot · huruf = bagian klip (a = key visual, b = gambar adegan kedua)</span></header>
<div class="grid">${cards}</div></body></html>`;
const out = join(dir, "out");
mkdirSync(out, { recursive: true });
const hf = join(out, "scene-sheet.html"), png = join(out, "scene-sheet.png");
writeFileSync(hf, html);
const chrome = [process.env.CHROME, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"].find((p) => p && existsSync(p));
if (!chrome) die(`Chrome tidak ditemukan; buka ${hf} di browser`);
// puppeteer-core (comes with HyperFrames) on the installed Chrome: a full-page screenshot is exactly as tall as the cards
const { default: puppeteer } = await import("puppeteer-core");
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--allow-file-access-from-files"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 2000, height: 1000 });
  await page.goto(pathToFileURL(hf).href, { waitUntil: "load" });
  await page.screenshot({ path: png, fullPage: true });
} finally { await browser.close(); }
console.log(`✔ ${png}`);
