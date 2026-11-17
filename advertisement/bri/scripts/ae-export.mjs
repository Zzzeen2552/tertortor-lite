#!/usr/bin/env node
// ae-export.mjs <slug>: BRI motion KV (compositions/kv.html) → After Effects package the client can edit.
// Chrome measures the laid-out composition (text baselines, rects, image sizes), the timing and motion numbers are read
// from kv.html itself, and advertisement/bri/ae/builder.jsx turns both into a native AE project: Inter text layers
// (editable), shape layers for the frame / box / bursts, precomps per scene, keyframes with eases, audio.
// Output: videos/<slug>/out/ae/<Name>.jsx + assets/ + BACA-SAYA.txt, zipped to videos/<slug>/out/<slug>-after-effects.zip.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const slug = process.argv[2];
if (!slug) { console.error("usage: node advertisement/bri/scripts/ae-export.mjs <slug>"); process.exit(1); }
const V = path.join(ROOT, "videos", slug);
const kvFile = path.join(V, "compositions/kv.html");
const kv = fs.readFileSync(kvFile, "utf8");
const index = fs.readFileSync(path.join(V, "index.html"), "utf8");
const meta = JSON.parse(fs.readFileSync(path.join(V, "meta.json"), "utf8"));
const reqF = path.join(V, "request.json"), req = fs.existsSync(reqF) ? JSON.parse(fs.readFileSync(reqF, "utf8")) : {};

// ---------- numbers from kv.html ----------
const num = (re, d) => { const m = kv.match(re); return m ? m.slice(1).map(Number) : d; };
const W = +kv.match(/id="root"[^>]*data-width="(\d+)"/)[1], H = +kv.match(/id="root"[^>]*data-height="(\d+)"/)[1];
const T = Object.fromEntries(kv.match(/const T = \{([^}]*)\}/)[1].split(",").map((s) => s.split(":").map((x) => x.trim())).filter((a) => a.length === 2).map(([k, v]) => [k, +v]));
const P = {
  aOrigin: num(/#kv-a \{[^}]*transform-origin: (-?[\d.]+)px (-?[\d.]+)px/, [W / 2, H / 2]),
  fly: num(/"#kv-big-g", \{ x: 0, y: 0, scale: 1 \}, \{ x: (-?[\d.]+), y: (-?[\d.]+), scale: ([\d.]+)/, [0, 0, 0.36]),
  head: num(/"#kv-head", \{ x: 0, y: 0, scale: 1 \}, \{ x: (-?[\d.]+), y: (-?[\d.]+), scale: ([\d.]+)/, [0, 0, 1]),
  circle: num(/circle\(130% at (-?[\d.]+)px (-?[\d.]+)px\)" \}, \{ clipPath: "circle\(0% at (-?[\d.]+)px (-?[\d.]+)px\)/, [W / 2, H / 2, W / 4, H / 3]),
  gb: num(/burst\(document\.querySelector\("#kv-gb"\), (\d+), (\d+), (\d+)\)/, [14, 330, 70]),
  bb: num(/burst\(document\.querySelector\("#kv-bb"\), (\d+), (\d+), (\d+)\)/, [10, 150, 34]),
  cutEnd: num(/const i = t < ([\d.]+) \?/, [2.78])[0],
  occ: JSON.parse(kv.match(/const OCC = \/\*@occ\*\/(\[[\s\S]*?\])\/\*@end\*\//)?.[1] || "[]"),
  dyn: JSON.parse(kv.match(/const DYN = \/\*@dyn\*\/(\{[\s\S]*?\})\/\*@end\*\//)?.[1] || '{"t0":0,"fps":30,"runs":[]}'),
  dynY: num(/points="\$\{a\},(\d+) \$\{b\},\d+ \$\{b\},(\d+)/, [468, 516]),
};
const dur = +index.match(/id="root"[^>]*data-duration="([\d.]+)"/)[1];

// ---------- media referenced by the composition and index ----------
const srcs = [...new Set([...kv.matchAll(/src="(assets\/[^"]+)"/g), ...index.matchAll(/src="(assets\/[^"]+)"/g)].map((m) => m[1]))];
const cut = srcs.filter((s) => /assets\/cutout\/f\d+\.png$/.test(s)).sort();
const audio = [...index.matchAll(/<audio id="([^"]+)" src="([^"]+)" data-start="([\d.]+)" data-duration="([\d.]+)" data-volume="([\d.]+)"/g)]
  .map(([, id, src, t, d, v]) => ({ id, file: src, t: +t, dur: +d, vol: +v }));
const vidM = kv.match(/<video id="kv-vid" src="([^"]+)" data-start="([\d.]+)" data-duration="([\d.]+)"/);
const stillM = kv.match(/<div id="kv-photo"[^>]*><img src="([^"]+)"/);
const bg2M = kv.match(/<img id="kv-bg2" src="([^"]+)"/);

// ---------- measure in Chrome ----------
const fontDir = path.join(os.homedir(), ".cache/hyperframes/fonts/inter");
const hashes = [...new Set(fs.readdirSync(fontDir).map((f) => f.replace(/^\d+-normal-/, "")))]
  .filter((h) => [400, 500, 600, 700].every((w) => fs.existsSync(path.join(fontDir, `${w}-normal-${h}`))));
const faces = hashes.map((h, i) => [400, 500, 600, 700].map((w) => `@font-face{font-family:"InterM${i}";font-weight:${w};src:url("${pathToFileURL(path.join(fontDir, `${w}-normal-${h}`))}") format("woff2")}`).join("")).join("");
const fams = hashes.map((_, i) => `"InterM${i}"`).join(",");
const tpl = kv.match(/<template>([\s\S]*)<\/template>/)[1];
const style = tpl.match(/<style>[\s\S]*?<\/style>/)[0];
const markup = tpl.replace(/<style>[\s\S]*?<\/style>/, "").replace(/<script>[\s\S]*?<\/script>/, "").replace(/<video[^>]*><\/video>/, "");
const brand = (index.match(/\/\*@brand\*\/([\s\S]*?)\/\*@end\*\//) || ["", ""])[1];
const page = `<!doctype html><html><head><meta charset="utf-8"><style>${faces}${brand}
:root{--font-body:${fams}} *{margin:0;padding:0;box-sizing:border-box} html,body{width:${W}px;height:${H}px;overflow:hidden;background:transparent}
.cap-hide,.cap-hide *{visibility:hidden!important} .cap-on,.cap-on *{visibility:visible!important}</style>${style}</head><body>${markup}</body></html>`;
const pageFile = path.join(V, ".ae-measure.html");
fs.writeFileSync(pageFile, page);

const OUT = path.join(V, "out/ae");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "assets/ae"), { recursive: true });

const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--allow-file-access-from-files", "--hide-scrollbars"] });
let M;
try {
  const pg = await browser.newPage();
  await pg.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await pg.goto(pathToFileURL(pageFile).href, { waitUntil: "load" });
  await pg.evaluate(async () => { await document.fonts.ready; });
  M = await pg.evaluate(() => {
    const $ = (s) => document.querySelector(s);
    const rgb = (c) => (c.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map((v) => +v / 255);
    const R = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
    // the giant number: the odometer columns are empty without the script, lay out a plain "25" in their place
    const pct = document.querySelector("#kv-big-a > span")?.textContent || "25";
    $("#kv-big-g").innerHTML = `<span id="m-g">${pct}</span><sup>%</sup>`;
    // text: every character's box, grouped into lines; the baseline from a zero-size marker at the line start
    const text = (el, align = "left") => {
      const chars = [];
      const walk = (n) => { for (const c of n.childNodes) { if (c.nodeType === 3) { for (let i = 0; i < c.length; i++) chars.push([c, i]); } else if (c.nodeType === 1 && c.tagName !== "SUP" && getComputedStyle(c).display !== "none") walk(c); } };
      walk(el);
      const boxes = chars.map(([n, i]) => { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1); const b = r.getBoundingClientRect(); return { n, i, ch: n.data[i], x: b.left, r: b.right, top: b.top, bot: b.bottom, h: b.height }; }).filter((b) => b.h > 0);
      const lines = [];
      for (const b of boxes) { const L = lines.at(-1); if (L && Math.abs(L.top - b.top) < b.h * 0.5) L.c.push(b); else lines.push({ top: b.top, c: [b] }); }
      const cs = getComputedStyle(boxes[0]?.n.parentElement || el);
      const out = lines.map((L) => {
        const c = L.c.filter((b) => b.ch.trim());
        const s = L.c.map((b) => b.ch).join("").replace(/\s+/g, " ").trim();
        const x = c[0].x, r = c.at(-1).r;
        return { s, x, r, cx: (x + r) / 2, top: c[0].top, bot: Math.max(...c.map((b) => b.bot)) };
      });
      // baseline sits at a fixed distance below the glyph box top for one font size: measure it once with a marker
      const first = lines[0].c.find((b) => b.ch.trim());
      const mk = document.createElement("span"); mk.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
      const tail = first.n.splitText(first.i); tail.parentNode.insertBefore(mk, tail);
      const off = mk.getBoundingClientRect().bottom - first.top;
      mk.remove(); tail.parentNode.normalize();
      for (const L of out) L.base = L.top + off;
      return { fs: parseFloat(cs.fontSize), fw: +cs.fontWeight, ls: parseFloat(cs.letterSpacing) || 0, lh: parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2, color: rgb(cs.color), align, lines: out };
    };
    const img = (el) => ({ ...R(el), nw: el.naturalWidth, nh: el.naturalHeight });
    const card = $("#kv-card"), cardw = $("#kv-cardw");
    const cr = R(card), cs = cardw ? (new DOMMatrix(getComputedStyle(cardw).transform).a || 1) : 1;
    const inCard = (r) => ({ x: (r.x - cr.x) / cs, y: (r.y - cr.y) / cs, w: r.w / cs, h: r.h / cs });
    const fr = $("#kv-frame-r"), br = $("#kv-box-r"), boxEl = $("#kv-box");
    const boxR = R(boxEl), boxScale = boxR.w / 244;
    return {
      kt: ["a", "b", "c", "d"].map((k) => ({ id: k, box: R($(`#kt-${k}`)), lines: [...document.querySelectorAll(`#kt-${k} .kt-box`)].map((b) => text(b)) })),
      cut: R($("#kv-cut")),
      promo: text($("#kv-promo-t")),
      bigA: { box: R($("#kv-big-a")), n: text($("#kv-big-a > span")), sup: text($("#kv-big-a sup")) },
      frame: { x: +fr.getAttribute("x"), y: +fr.getAttribute("y"), w: +fr.getAttribute("width"), h: +fr.getAttribute("height"), rx: +fr.getAttribute("rx"), sw: +fr.getAttribute("stroke-width") },
      box: { ...boxR, rx: 24 * boxScale, sw: 5 * boxScale, inset: 2.5 * boxScale, t: text($("#kv-box-t")), tBox: R($("#kv-box-t")), n: text($("#kv-num-b")), sup: text($("#kv-big-b sup")), big: R($("#kv-big-b")) },
      card: { ...cr, scale: cs, w0: card.offsetWidth, h0: card.offsetHeight,
        gh: [...document.querySelectorAll(".kv-gh")].map((e) => ({ id: e.id, ...inCard(R(e)) })),
        gv: [...document.querySelectorAll(".kv-gv")].map((e) => ({ id: e.id, ...inCard(R(e)) })),
        cells: [...document.querySelectorAll(".kv-cell img")].map((e) => ({ id: e.id, src: e.getAttribute("src"), ...inCard(R(e)), nw: e.naturalWidth, nh: e.naturalHeight })) },
      head: { box: R($("#kv-head")), l1: text($("#kv-ln1")), l2: text($("#kv-ln2")), r1: R($("#kv-ln1")), r2: R($("#kv-ln2")), sub: text($("#kv-sub")), subBox: R($("#kv-sub")) },
      foot: img($("#lg-foot")), qr: img($("#lg-qr")), qrcard: R($("#lg-qrcard")),
      end: { dan: img($("#lg-dan")), n131: img($("#lg-131")), bri: img($("#lg-bri")), legal: text($("#kv-legal"), "center") },
      giantK: text($("#kv-giant-k"), "center"),
      bigG: { box: R($("#kv-big-g")), n: text($("#m-g")), sup: text($("#kv-big-g sup")), supBox: R($("#kv-big-g sup")) },
      gb: R($("#kv-gb")), bb: R($("#kv-bb")),
      still: img($("#kv-photo img")), bg2: img($("#kv-bg2")),
      ground: rgb(getComputedStyle($("#root")).backgroundColor),
      accent: rgb(getComputedStyle(document.documentElement).getPropertyValue("--accent").trim().replace(/^#(..)(..)(..)$/, (_, r, g, b) => `rgb(${parseInt(r, 16)},${parseInt(g, 16)},${parseInt(b, 16)})`)),
    };
  });

  // ---------- decorative layers as PNGs (gradients, the dotted panel, the card) ----------
  const shot = async (name, sel, prep, margin = 0) => {
    const clip = await pg.evaluate((sel, prep, margin) => {
      document.querySelectorAll(".cap-on").forEach((e) => e.classList.remove("cap-on"));
      document.body.classList.add("cap-hide");
      const el = document.querySelector(sel);
      el.classList.add("cap-on");
      for (let a = el; a && a !== document.body; a = a.parentElement) { a.style.opacity = "1"; a.style.filter = "none"; a.style.clipPath = "none"; }
      document.querySelector("#root").style.background = "transparent";
      if (prep) new Function(prep)();
      const r = el.getBoundingClientRect();
      return { x: Math.floor(r.left - margin), y: Math.floor(r.top - margin), width: Math.ceil(r.width + 2 * margin), height: Math.ceil(r.height + 2 * margin) };
    }, sel, prep || "", margin);
    await pg.screenshot({ path: path.join(OUT, `assets/ae/${name}.png`), clip, omitBackground: true, captureBeyondViewport: true });
    return clip;
  };
  const caps = {};
  caps.veil = await shot("veil", "#kv-veil");
  caps.wash = await shot("wash", "#kv-wash");
  caps.shade = await shot("foot-shade", "#kv-foot-shade");
  caps.gpanel = await shot("panel-biru", "#kv-gpanel");
  const cardPrep = `const w=document.querySelector("#kv-cardw"); if(w){w.style.transform="none";w.style.left="0px";w.style.top="0px";} const c=document.querySelector("#kv-card"); c.style.left="80px"; c.style.top="80px"; c.style.transform="none";`;
  caps.card = await shot("kartu", "#kv-card", cardPrep + `document.querySelectorAll("#kv-card > *").forEach(e=>e.style.display="none");`, 80);
  caps.wipe = await shot("kartu-biru", "#kv-card", cardPrep + `c.style.boxShadow="none"; c.style.background="transparent"; document.querySelectorAll("#kv-card > *").forEach(e=>e.style.display=e.id==="kv-card-wipe"?"":"none");`, 0);
  caps.qrcard = await shot("kartu-qr", "#lg-qrcard");
  M.caps = caps;
} finally {
  await browser.close();
  fs.rmSync(pageFile, { force: true });
}

// ---------- copy media ----------
const copy = (rel) => { const to = path.join(OUT, rel); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(path.join(V, rel), to); return rel; };
for (const s of srcs) if (fs.existsSync(path.join(V, s))) copy(s);
for (const a of audio) if (fs.existsSync(path.join(V, a.file))) copy(a.file);

const fps = 30;
const name = (req.title || meta.title || "BRI").replace(/\s*\(.*?\)\s*/g, " ").replace(/[^\w\- ]+/g, "").replace(/\s+/g, " ").trim() + (W === H ? " 1x1" : W > H ? " 16x9" : H / W > 1.5 ? " 9x16" : " 4x5");
const D = {
  name, slug, W, H, fps, dur, T, P,
  files: { still: stillM?.[1], video: vidM?.[1], videoStart: +(vidM?.[2] || 0), videoDur: +(vidM?.[3] || 10), bg2: bg2M?.[1], cutFirst: cut[0], cutCount: cut.length },
  audio, m: M,
};
const builder = fs.readFileSync(path.join(ROOT, "advertisement/bri/ae/builder.jsx"), "utf8");
const jsx = `// ${name}: After Effects build script (generated by TERTORTOR LITE advertisement/bri/scripts/ae-export.mjs, ${new Date().toISOString().slice(0, 10)})
// File > Scripts > Run Script File... and pick this file. Keep the assets/ folder next to it.
#target aftereffects
var D = ${JSON.stringify(D)};
${builder}`;
const jsxName = name.replace(/\s+/g, "-") + ".jsx";
fs.writeFileSync(path.join(OUT, jsxName), jsx);
fs.copyFileSync(path.join(ROOT, "advertisement/bri/ae/BACA-SAYA.txt"), path.join(OUT, "BACA-SAYA.txt"));

// zip (PowerShell's Compress-Archive keeps the folder layout)
const zip = path.join(V, `out/${slug}-after-effects.zip`);
fs.rmSync(zip, { force: true });
const z = spawnSync("powershell", ["-NoProfile", "-Command", `Compress-Archive -Path '${OUT}\\*' -DestinationPath '${zip}'`], { stdio: "inherit" });
console.log(JSON.stringify({ jsx: path.relative(ROOT, path.join(OUT, jsxName)), zip: z.status === 0 ? path.relative(ROOT, zip) : null, W, H, texts: M.kt.length }));
