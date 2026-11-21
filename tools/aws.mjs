// aws.mjs: look AWS under Cinematic (user 2026-11-17). Recap films that mix real event footage (graded as cinema) with
// motion graphics, above all data visualisation: big counted numbers, a funnel, dot grids, a Top-20 board, a timeline,
// the partner logo card. Thai on screen with an English line under it (and an .srt). No narration by default.
// The whole film is one composition (compositions/film.html) written from aws.json, at any of three frames:
// 16:9 master, 9:16 and 1:1 (meta.json "format"), so the cut-downs are re-laid out, never cropped.
//
//   node tools/aws.mjs new <slug> "Judul" [--format horizontal|vertical|square] [--idea "…"]
//   node tools/aws.mjs build <slug>      aws.json -> compositions/film.html + index.html + music + sfx + out/<slug>.en.srt
//   node tools/aws.mjs check <slug>      build -> rules (TBC numbers, missing footage/logos) -> hyperframes check
//   node tools/aws.mjs formats <slug> [--only 9x16,1x1]   make/refresh videos/<slug>-9x16 and -1x1 from the master's aws.json
//   then: npm run finish -- <slug> --no-thumbnail
//
// aws.json (all text is { th, en }: Thai on screen, English under it and in the .srt):
// { title, source: { th, en } (small data-source line), music: { track?: "assets/music/x.mp3", vol?, off? },
//   grade?: media-treatment grading JSON (default presets/aws/preset.json → grade),
//   data: { <key>: { value: number|null (null = TBC), th, en, prefix?, suffix?, series?: [numbers] } },
//   scenes: [
//     { id, kind: "open",    dur, footage: [F…], title: "Event Name", line?: { th, en } },
//     { id, kind: "stat",    dur, footage: [F…], line: { th, en }, stats: ["key", …] (1-2), viz?: "dots"|"curve" },
//     { id, kind: "funnel",  dur, footage: [F…], line: { th, en }, steps: ["key", …], themes?: [{ th, en }] },
//     { id, kind: "montage", dur, footage: [F… with theme], line: { th, en }, count: "key" (the board size, e.g. top20) },
//     { id, kind: "end",     dur, footage?: [F], timeline: [{ th, en, date: { th, en } }], prize?: "key",
//       logos: [{ src: "assets/logos/x.png", name }], powered?: { src, name } } ] }
// F (footage) = { src: "x.mp4"|"x.jpg" in assets/footage/, need: "what the shot must show" (the slate text while the
//   file is missing), in?: seconds into the file, theme?: { th, en } (montage label) }.
// A missing file renders as a labelled slate, a null number as a dashed "TBC" chip: the film can be reviewed as an
// animatic before the client's footage and numbers arrive, and `check` lists everything still missing.
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, rmSync, statSync, cpSync } from "node:fs";
import { join, extname } from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT, readJSON, writeJSON, die, videoDir, brandCss, loadBrand, FRAMES, probeDuration } from "./lib.mjs";
import { renderScore } from "./anim-music.mjs";
import { createVariant, variantSlug } from "./variant.mjs";

const FPS = 30;
const snap = (t) => Math.round(t * FPS) / FPS;
const r1 = (n) => Math.round(n * 10) / 10;
const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmtN = (n) => Number(n).toLocaleString("en-US");
const readMeta = (dir) => (existsSync(join(dir, "meta.json")) ? readJSON(join(dir, "meta.json")) : {});
// Semua gaya Cinematic memakai alur kerja AWS (user 2026-11-21): mesin, aws.json, tab, render, 9:16 + 1:1, paket After
// Effects. Gaya baru punya preset sendiri di presets/<look>/ (disalin dari presets/aws saat dibuat); berkas yang tidak ada di
// sana diambil dari presets/aws. Font Amazon Ember berlisensi tetap hanya di presets/aws/fonts/ember/.
export const isAws = (dir) => readMeta(dir).type === "cinematic";
const lookOfDir = (dir) => readMeta(dir).look || "aws";
export const presetDirOf = (look) => (look && existsSync(join(ROOT, "presets", look, "preset.json")) ? join(ROOT, "presets", look) : join(ROOT, "presets", "aws"));
const presetFile = (look, ...p) => { const own = join(presetDirOf(look), ...p); return existsSync(own) ? own : join(ROOT, "presets", "aws", ...p); };
export const loadAws = (dir) => (existsSync(join(dir, "aws.json")) ? readJSON(join(dir, "aws.json")) : null);
const VIDEO_EXT = new Set([".mp4", ".mov", ".webm", ".m4v"]);

// ---------- new ----------
export function create(slug, title, { format = "horizontal", idea = "", look = "aws" } = {}) {
  if (!FRAMES[format]) die("--format harus horizontal, vertical, atau square");
  if (!/^[a-z0-9-]+$/.test(look)) die("--look tidak valid");
  const preset = presetDirOf(look).split(/[\\/]/).pop();
  const r = spawnSync("node", [join(ROOT, "tools", "new.mjs"), slug, title, "--preset", preset, "--format", format], { encoding: "utf8" });
  if (r.status !== 0) die(r.stderr || r.stdout);
  const dir = join(ROOT, "videos", slug);
  writeJSON(join(dir, "meta.json"), { ...readJSON(join(dir, "meta.json")), type: "cinematic", look, watermark: false });
  const idx = join(dir, "index.html");
  writeFileSync(idx, readFileSync(idx, "utf8").replace(/\s*<div id="captions"[\s\S]*?<\/div>/, "").replace(/\s*<audio id="voice"[^>]*><\/audio>/, "").replace("<!--@beats-end-->", "<!--@beats-end-->\n      <!--@sfx-->\n      <!--@sfx-end-->"));
  for (const f of ["beats.json", "script.md"]) rmSync(join(dir, f), { force: true });
  for (const d of ["assets/footage", "assets/logos", "assets/music", "assets/reference"]) mkdirSync(join(dir, d), { recursive: true });
  writeJSON(join(dir, "request.json"), { type: "cinematic", look, title, idea, format, created: new Date().toISOString() });
  writeJSON(join(dir, "aws.json"), { title, source: { th: "", en: "" }, music: { vol: 0.8 }, data: {}, scenes: [] });
  writeFileSync(join(dir, "sources.txt"), "");
  writeFileSync(join(dir, "brief.md"), `# Brief: ${title}\n\n> Cinematic · ${look === "aws" ? "AWS" : `${look} (alur AWS)`}. Claude: baca ${existsSync(join(ROOT, "cinematic", look, "style.md")) ? `cinematic/${look}/style.md` : "cinematic/aws/style.md"}${look === "aws" ? "" : " (gaya look ini; aturan alur tetap dari cinematic/aws/style.md)"}, tulis aws.json (data + adegan), lalu node tools/aws.mjs check ${slug}.\n\n## Ide / brief (dari user)\n\n${idea || "(kosong)"}\n`);
  return dir;
}

// ---------- layout per frame ----------
// h = 16:9 master, v = 9:16, s = 1:1. Text block (Thai line + English) and the data area move per frame; sizes in px.
function layout(fmt, W, H) {
  if (fmt === "horizontal") return { k: "h", pad: 120, hud: 40, cloud: { x: 960, y: 430, rx: 470, ry: 270 }, tiles: { x: 1380, y: 840, cols: 12, rows: 6, size: 44, gap: 8, lift: 46 }, hub: { x: 1420, y: 520, r: 270, sx: 1.05 }, blk: { left: 120, bottom: 150, width: 860 }, viz: { left: 1040, top: 170, width: 760, height: 700 }, th: 84, en: 32, num: 210, lab: 44, title: 230, board: { cell: 64, gap: 12, right: 120, top: 150 } };
  if (fmt === "vertical") return { k: "v", pad: 90, hud: 44, cloud: { x: 540, y: 1000, rx: 400, ry: 380 }, tiles: { x: 540, y: 1450, cols: 11, rows: 8, size: 46, gap: 8, lift: 46 }, hub: { x: 540, y: 960, r: 300, sx: 1 }, blk: { left: 90, top: 250, width: 900 }, viz: { left: 90, top: 700, width: 900, height: 600 }, th: 86, en: 34, num: 220, lab: 44, title: 200, board: { cell: 74, gap: 14, right: 90, top: 1000 } };
  return { k: "s", pad: 80, hud: 30, cloud: { x: 540, y: 650, rx: 340, ry: 250 }, tiles: { x: 760, y: 700, cols: 10, rows: 5, size: 34, gap: 6, lift: 34 }, hub: { x: 540, y: 660, r: 250, sx: 1.05 }, blk: { left: 80, top: 116, width: 920 }, viz: { left: 80, top: 380, width: 920, height: 560 }, th: 66, en: 30, num: 150, lab: 40, title: 180, board: { cell: 52, gap: 10, right: 80, top: 640 } };
}

// "*word*" = the one accent word of a line (the reference reels: "Swap models. *Not code.*", "Grow with *partners.*")
const acc = (t = "") => esc(t).replace(/\*([^*]+)\*/g, '<span class="acc">$1</span>');
export const plain = (t = "") => String(t).replace(/\*/g, "");
const thEn = (cls, id, t, extra = "", head = "") => (t?.th || t?.en ? `<div class="${cls}" id="${id}"${extra}>${head}${t.th ? `<div class="th">${acc(t.th)}</div>` : ""}${t.en ? `<div class="en">${acc(t.en)}</div>` : ""}</div>` : "");
// seeded random for particle and tile layouts (written into the HTML: the page itself never draws a random number)
const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// text that becomes an editable After Effects text layer (tools/aws-ae.mjs); the graphics pass hides only its glyphs
export const AE_TEXT = [".blk .th", ".blk .en", ".title", ".num b", ".num em", ".num.tbc", ".lab .th", ".lab .en", ".fth", ".fen", ".chip b", ".chip i", ".tag b", ".tag i", ".nxl span", ".nxl i", ".nd-date", ".nd-th", ".nd-en", ".src", ".say .th", ".say .en", ".hubc", ".vosub span"];

// pass: "full" (the film), "plate" (graded footage + shade only) or "gfx" (graphics on alpha, AE text glyphs hidden)
export function build(slug, { pass = "full" } = {}) {
  const dir = videoDir(slug);
  if (!isAws(dir)) die(`videos/${slug} bukan proyek AWS (meta.json type cinematic, look aws).`);
  const aws = loadAws(dir);
  if (!aws?.scenes?.length) die("aws.json belum punya adegan.");
  const brand = loadBrand(dir);
  const { w: W, h: H, format: fmt } = brand.frame;
  const L = layout(fmt, W, H);
  const data = aws.data ?? {};
  const val = (k) => data[k]?.value ?? null;
  const missing = { footage: [], numbers: new Set(), logos: [] };

  const ftg = [], dom = [], js = [], srt = [], hudSecs = [], hudJs = [];
  const sfx = { whoosh: [], hit: [], tick: [], pop: [], riser: [] };
  const cuts = [], counts = {};
  let t = 0, nf = 0;

  // footage strip: every shot is its own timed clip in the footage layer (never inside a faded scene), its wrapper
  // carries the slow push; a missing file is a slate that says which shot belongs there
  const shot = (sceneId, f, at, d, j) => {
    const id = `${sceneId}-f${j}`, start = snap(at), dur = snap(d);
    const file = f.src ? join(dir, "assets", "footage", f.src) : null;
    const push = j % 2 ? [1.12, 1.04] : [1.04, 1.12];
    const drift = (j % 3) - 1;
    js.push(`T.fromTo("#${id}-w", { scale: ${push[0]}, xPercent: ${-drift * 1.2} }, { scale: ${push[1]}, xPercent: ${drift * 1.2}, duration: ${dur}, ease: "none" }, ${start});`);
    // flip: mirror the picture only (a face that would sit under the numbers moves to the free side; user 2026-11-18)
    const flip = f.flip ? ` style="transform: scaleX(-1)"` : "";
    if (file && existsSync(file)) {
      const isVid = VIDEO_EXT.has(extname(file).toLowerCase());
      const media = isVid
        ? `<video id="${id}" class="clip ftg" src="assets/footage/${esc(f.src)}" data-start="${start}" data-duration="${dur}"${f.in ? ` data-media-start="${f.in}"` : ""} muted playsinline${flip}></video>`
        : `<img id="${id}" class="clip ftg" src="assets/footage/${esc(f.src)}" data-start="${start}" data-duration="${dur}" alt=""${flip}>`;
      // bulbs (user 2026-11-18): a Blender-rendered light bulb (sprite sheet, aws.json → bulb) pops up over each head,
      // following the head through the shot; inside the wrapper so the slow push moves them with the picture
      const B = aws.bulb, bul = [];
      if (B && f.bulbs?.length) {
        const bw = B.width ?? 150, bh = Math.round(bw * B.h / B.w), cols = B.cols ?? 10, rows = Math.ceil(B.frames / cols);
        f.bulbs.forEach((b, q) => {
          const bid = `${id}-b${q}`, t0 = start + (b.delay ?? 0), first = b.frame0 ?? 0, tr = b.track;
          const left = (x) => r1(x - bw / 2), top = (y) => r1(y - bh * (B.anchor ?? 0.86));
          bul.push(`<div class="bulb" id="${bid}" style="left:${left(tr[0][1])}px;top:${top(tr[0][2])}px;width:${bw}px;height:${bh}px"><div class="bf" id="${bid}-f"><i class="halo" id="${bid}-h"></i><i class="spr" id="${bid}-s" style="background-image:url(${esc(B.sprite)});background-size:${cols * bw}px ${rows * bh}px"></i><i class="core" id="${bid}-c"></i></div></div>`);
          js.push(`T.set("#${bid}", { opacity: 1 }, ${r1(t0)}); T.set("#${bid}", { opacity: 0 }, ${r1(start + dur)});`);
          for (let k = 1; k < tr.length; k++) js.push(`T.fromTo("#${bid}", { x: ${r1(tr[k - 1][1] - tr[0][1])}, y: ${r1(tr[k - 1][2] - tr[0][2])} }, { x: ${r1(tr[k][1] - tr[0][1])}, y: ${r1(tr[k][2] - tr[0][2])}, duration: ${r1(tr[k][0] - tr[k - 1][0])}, ease: "none", immediateRender: false }, ${r1(start + tr[k - 1][0])});`);
          // one frame of the sprite per 1/30 s, held on the last frame
          const nfr = Math.min(B.frames - first, Math.ceil((start + dur - t0) * 30) + 1);
          for (let k = 0; k < nfr; k++) { const fr = first + k; js.push(`T.set("#${bid}-s", { backgroundPosition: "${-(fr % cols) * bw}px ${-Math.floor(fr / cols) * bh}px" }, ${r1(t0 + k / 30)});`); }
          // warm halo once the filament is on (sprite frame ~15), breathing a little
          const on = Math.max(0, (B.litFrame ?? 15) - first) / 30;
          js.push(`T.fromTo(["#${bid}-h", "#${bid}-c"], { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.3, ease: "power2.out" }, ${r1(t0 + on)}); T.to("#${bid}-h", { opacity: 0.8, duration: 0.45, ease: "sine.inOut", yoyo: true, repeat: 3 }, ${r1(t0 + on + 0.35)});`);
          // float (user 2026-11-18): each bulb bobs gently above its head, its own phase
          const amp = B.float ?? 0, per = 0.7 + (q % 3) * 0.12;
          if (amp) js.push(`T.fromTo("#${bid}-f", { y: ${-amp} }, { y: ${amp}, duration: ${r1(per)}, ease: "sine.inOut", yoyo: true, repeat: ${Math.ceil(dur / per)} }, ${r1(t0 + (q % 2) * 0.2)});`);
        });
      }
      ftg.push(`<div class="fw" id="${id}-w">${media}${bul.join("")}</div>`);
      nf++;
    } else {
      missing.footage.push({ scene: sceneId, src: f.src ?? "(tanpa nama)", need: f.need ?? "" });
      ftg.push(`<div class="fw" id="${id}-w"><div class="clip slate" id="${id}" data-start="${start}" data-duration="${dur}"><div class="sl-in" data-layout-ignore><b>FOOTAGE</b><span>${esc(f.src ?? "")}</span><i>${esc(f.need ?? "")}</i></div></div></div>`);
    }
    if (j > 0 || at > 0) cuts.push(start);
  };
  const footageRun = (s, start, dur) => {
    const list = s.footage ?? [];
    if (!list.length) return;
    // equal slices on the 0.5 s grid (120 bpm), the last slice takes the rest
    const step = Math.max(0.5, Math.round(dur / list.length / 0.5) * 0.5);
    // f.dur (seconds) = a hand-timed cut, e.g. to land on a VO word; the rest share what is left equally
    if (list.some((f) => f.dur)) { let a = start; list.forEach((f, j) => { const d = j === list.length - 1 ? start + dur - a : f.dur ?? step; if (d > 0.05) shot(s.id, f, a, d, j); a += d; }); return; }
    list.forEach((f, j) => { const a = start + j * step, d = j === list.length - 1 ? start + dur - a : step; if (d > 0.05) shot(s.id, f, a, d, j); });
  };
  const sub = (start, end, text) => { if (text) srt.push({ start, end, text: plain(text) }); };
  const numHtml = (id, k) => {
    const v = val(k);
    if (v == null) { missing.numbers.add(k); return `<span class="num tbc" id="${id}">TBC</span>`; }
    return `<span class="num" id="${id}" data-to="${v}">${data[k].prefix ? `<em>${esc(data[k].prefix)}</em>` : ""}<b>0</b>${data[k].suffix ? `<em>${esc(data[k].suffix)}</em>` : ""}</span>`;
  };
  const count = (id, k, at, d = 1.4) => { if (val(k) == null) { js.push(`T.fromTo("#${id}", { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(2)" }, ${at});`); return; } js.push(`count("${id}", ${val(k)}, ${at}, ${d});`); counts[id] = { at, d, to: val(k) }; sfx.hit.push(at + d - 0.08); };
  const label = (k) => ({ th: data[k]?.th ?? k, en: data[k]?.en ?? "" });
  const enNum = (k) => (val(k) == null ? "[TBC]" : `${data[k].prefix ?? ""}${fmtN(val(k))}${data[k].suffix ?? ""}`);

  for (const [i, s0] of aws.scenes.entries()) {
    const s = { ...s0, id: s0.id ?? `s${i + 1}` };
    const id = s.id, start = snap(t), dur = snap(s.dur ?? 5), end = start + dur;
    const parts = [], tl = [];
    footageRun(s, start, dur);
    if (i > 0) { sfx.whoosh.push(start); tl.push(`flash(${start});`); }
    // HUD section label (bottom left) and the kicker "■ 03 — ONLINE" that decodes above the line
    const secNo = String(i + 1).padStart(2, "0"), secName = String(s.section ?? s.id).toUpperCase();
    hudSecs.push(`<span class="hs" id="hud-s${i}">${secNo} / ${esc(secName)}</span>`);
    hudJs.push(`T.set("#hud-s${i}", { opacity: 1 }, ${start}); T.set("#hud-s${i}", { opacity: 0 }, ${end});`);
    const kick = `<div class="kick" id="${id}-k"><i></i><b>${secNo}</b><span class="kl"></span><span class="kt" id="${id}-kt" data-text="${esc(secName)}">${esc(secName)}</span></div>`;
    const kickIn = (at) => tl.push(`T.fromTo("#${id}-k", { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.4, ease: "expo.out" }, ${at}); decode("${id}-kt", ${at}, 0.6);`);
    const line = (at) => {
      if (!s.line) return;
      parts.push(thEn("blk line", `${id}-line`, s.line, "", aws.hud === false ? "" : kick));
      if (aws.hud !== false) kickIn(at - 0.15);
      tl.push(`T.fromTo("#${id}-line .th", { y: 50, opacity: 0, filter: "blur(14px)" }, { y: 0, opacity: 1, filter: "blur(0px)", duration: 0.7, ease: "expo.out" }, ${at}); T.fromTo("#${id}-line .en", { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "expo.out" }, ${at + 0.15});`);
      sub(at, end, s.line.en);
    };

    if (s.kind === "photowall") {
      // (user 2026-11-18, ref "YOUR SELFIES."): a dark grid floor, N photos pop in one by one into a 5-column wall, each
      // with an AWS-gradient number badge; near the cut they lift off toward the camera with depth blur, top rows first
      const ph = s.photos ?? [], n = ph.length, cols = s.cols ?? 5, rows = Math.ceil(n / cols);
      const G = s.grid ?? {}, tw = G.w ?? Math.round(W * 0.135), th = G.h ?? Math.round(tw * 0.66), gap = G.gap ?? 14;
      const gw = cols * tw + (cols - 1) * gap, gx = Math.round((W - gw) / 2), gy = G.top ?? Math.round(H * 0.09);
      parts.push(`<div class="pwbg" id="${id}-bg"></div>`);
      line(start + 0.2);
      const pop = r1(Math.min(0.1, (dur * 0.55) / Math.max(1, n))), lift = end - (s.lift ?? 1.0);
      ph.forEach((p, q) => {
        const c = q % cols, r = Math.floor(q / cols), x = gx + c * (tw + gap), y = gy + r * (th + gap);
        parts.push(`<div class="pww" id="${id}-w${q}" style="left:${x}px;top:${y}px;width:${tw}px;height:${th}px">${p ? `<img src="${esc(p.src ?? p)}" alt="">` : `<i class="pwe"></i>`}<b>${q + 1}</b></div>`);
        const at = r1(start + 0.15 + q * pop);
        tl.push(`T.fromTo("#${id}-w${q}", { opacity: 0, scale: 0.55, y: 30 }, { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: "back.out(2.2)" }, ${at});`);
        if (q % 4 === 0) sfx.tick.push(at);
        // lift off: rows from the top leave first, each tile toward the camera, blurring as it passes
        const lt = r1(lift + r * 0.12 + (c % 2) * 0.05), dx = (c - (cols - 1) / 2) * tw * 0.5;
        tl.push(`T.to("#${id}-w${q}", { scale: 2.3, x: ${r1(dx)}, y: ${r1(-H * 0.35 - r * 40)}, filter: "blur(14px)", opacity: 0, duration: 0.85, ease: "power2.in" }, ${lt});`);
      });
      sfx.riser.push(Math.max(start, lift - 0.4));
    } else if (s.kind === "triptych") {
      // (user 2026-11-18, ref "03 - Products"): the frame splits into N tall panels, one product shot each, wiped in one
      // after another with a slow push; a mono index top-left and the project name bottom-left of every panel
      // dynamic (ref 0:08-0:11): a blurred word reveal on black first, then each panel cycles through its shots with a
      // vertical push (the old shot slides up, the next comes from below), panels offset in time, and they leave the
      // same way at the end. panels[q].shots = [{ src, name, cx, z }, …] (one shot = the old single-panel behaviour)
      const ps = s.panels ?? [], pw = W / Math.max(1, ps.length);
      let t0 = start;
      if (s.word) {
        const wd = s.wordDur ?? 0.6;
        parts.push(`<div class="tpw" id="${id}-word">${esc(s.word)}</div>`);
        tl.push(`T.fromTo("#${id}-word", { opacity: 0, scale: 1.12, filter: "blur(22px)" }, { opacity: 1, scale: 1, filter: "blur(0px)", duration: ${r1(wd * 0.75)}, ease: "expo.out" }, ${r1(start)}); T.to("#${id}-word", { yPercent: -120, opacity: 0, duration: 0.25, ease: "power3.in" }, ${r1(start + wd - 0.12)});`);
        sfx.riser.push(Math.max(0, start - 0.6)); t0 = start + wd;
      }
      // device shot (user 2026-11-18, 9 ideas): a real app screenshot inside a phone / tilted phone / tablet frame drawn in
      // CSS on an AWS-tone background; the long screenshot scrolls slowly inside the screen. Only the frame is drawn, the
      // screen is always the client's own screenshot (sh.screen, sh.screenH = its height at 720 px wide).
      const devs = {
        phone: { w: 300, h: 640, r: 44, b: 10, tf: "" },
        tilt: { w: 300, h: 640, r: 44, b: 10, tf: "perspective(1400px) rotateY(-24deg) rotateX(8deg) rotateZ(6deg)" },
        tablet: { w: 470, h: 640, r: 30, b: 16, tf: "perspective(1600px) rotateY(14deg) rotateZ(-3deg)" },
      };
      const BGS = { blue: "radial-gradient(120% 90% at 30% 20%, #2b49e0 0%, #13238f 45%, #070c33 100%)", orange: "radial-gradient(120% 90% at 70% 15%, #ffb347 0%, #ff8a00 40%, #8a3a00 100%)", purple: "radial-gradient(120% 90% at 40% 10%, #8a5cff 0%, #4b1fb8 45%, #14062e 100%)", magenta: "radial-gradient(120% 90% at 60% 20%, #ff4fa3 0%, #b8166e 45%, #2e0620 100%)" };
      const device = (sh, iid) => {
        const D = devs[sh.device] ?? devs.phone, sw = D.w - 2 * D.b, sh2 = D.h - 2 * D.b, imgH = Math.round((sh.screenH ?? 2200) * sw / 720);
        const scroll = Math.max(0, Math.min(imgH - sh2, Math.round(imgH * (sh.scroll ?? 0.28))));
        js.push(`T.fromTo("#${iid}-scr", { y: 0 }, { y: ${-scroll}, duration: ${r1(Math.max(1, end - start))}, ease: "sine.inOut" }, ${r1(start)});`);
        return `<div class="tps dev" id="${iid}" style="background:${BGS[sh.bg] ?? sh.bg ?? BGS.blue}"><i class="tex"></i><div class="dv" style="width:${D.w}px;height:${D.h}px;border-radius:${D.r}px;padding:${D.b}px;transform:translate(-50%,-50%) ${D.tf}"><div class="dvs" style="border-radius:${D.r - D.b}px"><img id="${iid}-scr" src="${esc(sh.screen)}" alt="" style="width:${sw}px;height:${imgH}px"></div>${sh.device === "tablet" ? "" : `<i class="isl"></i>`}</div><span class="tpl"><i></i>${esc(sh.name ?? "")}</span></div>`;
      };
      const img = (sh, cls, iid) => {
        if (sh.screen) return device(sh, iid);
        const ar = sh.ar ?? 16 / 9, z = sh.z ?? 1, ih = Math.round(H * z), iw = Math.round(ih * ar), il = Math.round(pw / 2 - (sh.cx ?? 0.5) * iw), it = Math.round((H - ih) / 2);
        const bg = z < 1 ? `<img class="tpb" src="${esc(sh.src)}" alt="" style="left:${Math.round(pw / 2 - (sh.cx ?? 0.5) * H * ar)}px;width:${Math.round(H * ar)}px;height:${H}px">` : "";
        return `<div class="tps ${cls}" id="${iid}">${bg}<img src="${esc(sh.src)}" alt="" style="left:${il}px;top:${it}px;width:${iw}px;height:${ih}px"><span class="tpl"><i></i>${esc(sh.name ?? "")}</span></div>`;
      };
      const hold = s.hold ?? 0.6, push = 0.38;
      ps.forEach((p, q) => {
        const shots = p.shots ?? [p], at = r1(t0 + q * (s.stagger ?? 0.12));
        parts.push(`<div class="tp" id="${id}-p${q}" style="left:${Math.round(q * pw)}px;width:${Math.ceil(pw)}px">${shots.map((sh, k) => img(sh, "", `${id}-p${q}s${k}`)).join("")}<span class="tpn">${String(q + 1).padStart(2, "0")}</span></div>`);
        tl.push(`T.fromTo("#${id}-p${q}", { yPercent: 100 }, { yPercent: 0, duration: 0.5, ease: "expo.out" }, ${at});`);
        tl.push(`T.set("#${id}-p${q}s0", { yPercent: 0 }, ${start});`);
        shots.forEach((_, k) => { if (k) tl.push(`T.set("#${id}-p${q}s${k}", { yPercent: 100 }, ${start});`); });
        sfx.tick.push(at);
        // panels change shot at their own moments: offset by panel so the cuts ripple across the frame
        for (let k = 1; k < shots.length; k++) {
          const c = r1(at + 0.5 + hold * k - 0.2 + ((q * 0.23) % hold));
          if (c > end - 0.5) break;
          tl.push(`T.to("#${id}-p${q}s${k - 1}", { yPercent: -100, duration: ${push}, ease: "expo.inOut" }, ${c}); T.fromTo("#${id}-p${q}s${k}", { yPercent: 100 }, { yPercent: 0, duration: ${push}, ease: "expo.inOut", immediateRender: false }, ${c});`);
          if (q === 1) sfx.tick.push(c);
        }
        // leave: panels drop away one after another
        tl.push(`T.to("#${id}-p${q}", { yPercent: ${q % 2 ? -100 : 100}, duration: 0.35, ease: "power3.in" }, ${r1(end - 0.4 + q * 0.05)});`);
      });
      sfx.hit.push(t0);
    } else if (s.kind === "maskopen") {
      // (user 2026-11-18, ref "Brands"): a flat colour card with hairlines; the logo is cut out of it, so the footage
      // layer underneath plays inside the letters and cuts to the next shot (a white wipe runs through the letters on
      // each cut); at the end the logo grows from one stroke until the card is gone: the logo turns into a window.
      const M = s.mask, W0 = s.maskWidth ?? Math.round(W * 0.82), H0 = Math.round(W0 * M.h / M.w);
      const X0 = Math.round((W - W0) / 2), Y0 = Math.round(H * (s.maskY ?? 0.42) - H0 / 2);
      const pos = (w, px, py, fx, fy) => ({ w: r1(w), x: r1(px - fx * w), y: r1(py - fy * w * M.h / M.w) });
      const v = (p) => `{ "--mw": "${p.w}px", "--mx": "${p.x}px", "--my": "${p.y}px" }`;
      const cx = X0 + W0 / 2, cy = Y0 + H0 / 2, a0 = pos(W0 * 1.18, cx, cy, 0.5, 0.5), a1 = pos(W0, cx, cy, 0.5, 0.5);
      const zDur = s.zoomDur ?? 0.9, zAt = end - zDur - 0.05, P = [X0 + M.fx * W0, Y0 + M.fy * H0];
      const z1 = pos(s.zoomTo ?? 32000, P[0] + (W / 2 - P[0]) * 0.6, P[1] + (H / 2 - P[1]) * 0.6, M.fx, M.fy);
      const src = esc(M.src), bg = s.bg ?? "#1d4ed8";
      parts.push(`<div class="mg" id="${id}-mg" style="--mw:${a1.w}px;--mx:${a1.x}px;--my:${a1.y}px">
        <div class="mk" id="${id}-mk" style="background-color:${esc(bg)};-webkit-mask-image:linear-gradient(#000 0 0),url(${src});mask-image:linear-gradient(#000 0 0),url(${src})"></div>
        <div class="mkw" id="${id}-mkw" style="-webkit-mask-image:url(${src});mask-image:url(${src})"></div></div>`);
      tl.push(`T.fromTo("#${id}-mg", ${v(a0)}, { ...${v(a1)}, duration: 0.7, ease: "expo.out" }, ${r1(start)});`);
      tl.push(`T.fromTo("#${id}-mk", { opacity: 0 }, { opacity: 1, duration: 0.12 }, ${r1(start)});`);
      // white wipe through the letters on every cut of the footage underneath
      const n = (s.footage ?? []).length, step = n ? Math.max(0.5, Math.round(dur / n / 0.5) * 0.5) : dur;
      // toggle (user 2026-11-18): between the intro and the punch-through the frame flips on the beat between
      // "mask" (card, footage inside the letters) and "full" (the whole picture with the logo in solid white on top),
      // each flip a small scale punch so it feels driven, never a fade
      const lift = s.lift ?? 1.6, clips = (s.footage ?? []).map((_, j) => `#${id}-f${j}`);
      for (const [rt, mode] of s.toggle ?? []) {
        const c = start + rt, full = mode === "full";
        if (c > zAt - 0.1) break;
        const tgt = pos(W0 * (full ? 0.9 : 1), cx, cy, 0.5, 0.5), from = pos(W0 * (full ? 0.9 : 1) * 1.07, cx, cy, 0.5, 0.5);
        tl.push(`T.set("#${id}-mk", { opacity: ${full ? 0 : 1} }, ${r1(c)}); T.set("#${id}-mkw", { clipPath: "${full ? "inset(0% 0% 0% 0%)" : "inset(0% 100% 0% 0%)"}" }, ${r1(c)}); T.fromTo("#${id}-mg", ${v(from)}, { ...${v(tgt)}, duration: 0.45, ease: "expo.out", immediateRender: false }, ${r1(c)});`);
        js.push(`T.set(${JSON.stringify(clips)}, { filter: "${full ? "brightness(0.85) saturate(1)" : `brightness(${lift}) saturate(1.1)`}" }, ${r1(c)});`);
        sfx.tick.push(c);
      }
      for (let j = 0; j < n; j++) {
        const c = start + j * step;
        if (s.toggle?.length) break;
        if (c > zAt - 0.2) break;
        tl.push(`T.fromTo("#${id}-mkw", { clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.16, ease: "power2.in", immediateRender: false }, ${r1(Math.max(start, c - 0.16))}); T.to("#${id}-mkw", { clipPath: "inset(0% 0% 0% 100%)", duration: 0.2, ease: "power2.out" }, ${r1(Math.max(start + 0.16, c))});`);
      }
      // the line and the partner names under the logo (reference: client names in mono, one lit at a time)
      if (s.line) parts.push(`<div class="mkline" id="${id}-line" style="top:${Y0 + H0 + 46}px">${thEn("", `${id}-lt`, s.line)}</div>`);
      const names = s.names ?? [];
      if (names.length) parts.push(`<div class="mkp" id="${id}-p" style="top:${Y0 + H0 + (s.line ? 190 : 70)}px">${names.map((x, q) => `<span id="${id}-p${q}">${esc(x)}</span>`).join("")}</div>`);
      // logoStrip (user 2026-11-19): one partner lock-up image under the line, in place of names
      const ls = s.logoStrip;
      if (ls) {
        // full-width row, centred by text-align (a translate on the img itself is overwritten by GSAP's transform)
        parts.push(`<div class="mkls" id="${id}-ls" style="top:${Y0 + H0 + (s.line ? 190 : 70)}px"><img src="${esc(ls.src)}" alt="" style="height:${ls.h ?? 84}px"></div>`);
        tl.push(`T.fromTo("#${id}-ls", { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "expo.out" }, ${r1(start + 0.8)}); T.to("#${id}-ls", { opacity: 0, duration: 0.25, ease: "power2.in" }, ${r1(zAt - 0.25)});`);
      }
      tl.push(`T.fromTo("#${id}-line", { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "expo.out" }, ${r1(start + 0.6)});`);
      if (names.length) {
        tl.push(`T.fromTo("#${id}-p", { opacity: 0 }, { opacity: 1, duration: 0.5 }, ${r1(start + 0.8)});`);
        names.forEach((_, q) => { const t0 = start + 1.0 + q * ((zAt - start - 1.3) / names.length); tl.push(`T.to("#${id}-p${q}", { color: "#ffffff", duration: 0.15 }, ${r1(t0)}); T.to("#${id}-p${q}", { color: "rgba(255,255,255,.72)", duration: 0.3 }, ${r1(t0 + 0.55)});`); });
      }
      tl.push(`T.to(["#${id}-line", "#${id}-p"], { opacity: 0, duration: 0.25, ease: "power2.in" }, ${r1(zAt - 0.25)});`);
      // punch through one stroke of the logo
      tl.push(`T.to("#${id}-mg", { ...${v(z1)}, duration: ${zDur}, ease: "power3.in" }, ${r1(zAt)}); T.to("#${id}-mk", { opacity: 0, duration: 0.4, ease: "power1.in" }, ${r1(zAt + zDur - 0.42)});`);
      // footage seen through the letters is lifted so the letters read as pictures, not black; back to normal as it opens up
      // (lift is set above)
      (s.footage ?? []).forEach((_, j) => { js.push(`T.set("#${id}-f${j}", { filter: "brightness(${lift}) saturate(1.1)" }, ${r1(start)}); T.to("#${id}-f${j}", { filter: "brightness(1) saturate(1)", duration: ${zDur}, ease: "power2.in" }, ${r1(zAt)});`); });
      sfx.riser.push(Math.max(0, zAt - 0.8)); sfx.hit.push(zAt + zDur);
      sub(start + 0.6, end, s.title ?? aws.title);
    } else if (s.kind === "open") {
      // fast cuts on faces and hands, the name slams in on a beat in the middle, the line under it
      const at = start + Math.min(2.5, dur * 0.45);
      parts.push(`<div class="title" id="${id}-title">${esc(s.title ?? aws.title ?? "")}</div>`);
      tl.push(`T.fromTo("#${id}-title", { scale: 1.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.55, ease: "expo.out" }, ${at}); T.fromTo("#${id}-title", { filter: "blur(18px)" }, { filter: "blur(0px)", duration: 0.4, ease: "power2.out" }, ${at});`);
      tl.push(`flash(${at - 0.02});`);
      sfx.hit.push(at); sfx.riser.push(Math.max(0, at - 1.2));
      sub(at, end, s.title ?? aws.title);
      if (s.line) { parts.push(thEn("blk line center", `${id}-line`, s.line)); tl.push(`T.fromTo("#${id}-line", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "expo.out" }, ${at + 0.6});`); }
    } else if (s.kind === "stat") {
      line(start + 0.3);
      const keys = s.stats ?? [];
      const st = keys.map((k, j) => `<div class="stat" id="${id}-st${j}">${numHtml(`${id}-n${j}`, k)}${thEn("lab", `${id}-l${j}`, label(k))}</div>`).join("");
      parts.push(`<div class="viz stats n${keys.length}${s.viz === "cloud" ? " hero" : ""}" id="${id}-viz"${s.vizStyle ? ` style="${esc(s.vizStyle)}"` : ""}>${st}</div>`);
      keys.forEach((k, j) => {
        // statAt (absolute s): the moment the count lands, so it meets the VO word (user 2026-11-19)
        const land = s.statAt?.[j], at = land != null ? land - 0.9 : start + 0.9 + j * 1.6;
        tl.push(`T.fromTo("#${id}-st${j}", { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "expo.out" }, ${at - 0.2});`);
        count(`${id}-n${j}`, k, at, land != null ? 0.9 : 1.4);
        // fadeAt (user 2026-11-18): { "<stat index>": absolute seconds } = that number fades away while the shot goes on
        const fo = s.fadeAt?.[j]; if (fo != null) tl.push(`T.to("#${id}-st${j}", { opacity: 0, y: -24, filter: "blur(8px)", duration: 0.9, ease: "power2.inOut" }, ${r1(fo)});`);
        sub(at, end, `${enNum(k)} ${label(k).en}`);
      });
      // second picture of the same number: one dot per unit (e.g. venues), or the registrations curve
      if (s.viz === "dots" && keys[0]) {
        const v = val(keys[0]), n = v == null ? 24 : Math.min(v, 120), cols = n > 60 ? 15 : 12;
        parts.push(`<div class="dots${v == null ? " ghost" : ""}" id="${id}-dots" style="grid-template-columns:repeat(${cols},1fr)">${Array.from({ length: n }, (_, q) => `<i id="${id}-d${q}"></i>`).join("")}</div>`);
        tl.push(`T.fromTo("#${id}-dots i", { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(3)", stagger: ${r1(1.3 / n * 100) / 100} }, ${start + 0.95});`);
      }
      // a cloud of confetti dashes that gathers around the counted number (reference: "1,273,523 EVENTS INGESTED")
      if (s.viz === "cloud") {
        const rnd = mulberry(7 + i), n = 150, C = L.cloud, cols = ["var(--ink)", "var(--ink)", "var(--ink)", "var(--accent)", "var(--cool)"];
        const bits = Array.from({ length: n }, (_, q) => {
          const a = rnd() * Math.PI * 2, rr = 0.72 + rnd() * 0.42, x = Math.cos(a) * C.rx * rr, y = Math.sin(a) * C.ry * rr;
          const far = 1.9 + rnd() * 1.6, rot = Math.round(rnd() * 360);
          return { x: r1(x), y: r1(y), fx: r1(x * far), fy: r1(y * far), rot, c: cols[Math.floor(rnd() * cols.length)], w: rnd() < 0.15 ? 6 : 14 + Math.round(rnd() * 10) };
        });
        parts.push(`<div class="cloud" id="${id}-cloud" style="left:${C.x}px;top:${C.y}px">${bits.map((b, q) => `<i id="${id}-p${q}" style="left:${b.x}px;top:${b.y}px;width:${b.w}px;background:${b.c};transform:rotate(${b.rot}deg)"></i>`).join("")}</div>`);
        bits.forEach((b, q) => tl.push(`T.fromTo("#${id}-p${q}", { x: ${r1(b.fx - b.x)}, y: ${r1(b.fy - b.y)}, rotation: ${b.rot - 90}, opacity: 0 }, { x: 0, y: 0, rotation: ${b.rot}, opacity: 1, duration: 1.3, ease: "expo.out" }, ${r1(start + 0.6 + (q % 30) * 0.03)});`));
        tl.push(`T.fromTo("#${id}-cloud", { rotation: -8 }, { rotation: 10, duration: ${dur}, ease: "none" }, ${start});`);
      }
      // a floor of tiles seen from above; one tile rises per unit (reference: "EVERY WINDOW, METERED ON ITS OWN")
      if (s.viz === "tiles" && keys[0]) {
        const v = val(keys[0]), G = L.tiles, total = G.cols * G.rows, n = v == null ? 0 : Math.min(v, total);
        const rnd = mulberry(11 + i), order = Array.from({ length: total }, (_, q) => q);
        // rising tiles fill from the middle outwards so the shape reads as one block
        const cx = (G.cols - 1) / 2, cy = (G.rows - 1) / 2;
        order.sort((a, b) => Math.hypot(a % G.cols - cx, (a / G.cols | 0) - cy) + rnd() * 0.8 - (Math.hypot(b % G.cols - cx, (b / G.cols | 0) - cy) + rnd() * 0.8));
        const up = new Set(order.slice(0, n));
        parts.push(`<div class="tilewrap" id="${id}-tw" style="left:${G.x}px;top:${G.y}px"><div class="tiles" style="grid-template-columns:repeat(${G.cols},${G.size}px);gap:${G.gap}px">${Array.from({ length: total }, (_, q) => `<i id="${id}-tl${q}"${up.has(q) ? ' class="up"' : ""}></i>`).join("")}</div></div>`);
        tl.push(`T.fromTo("#${id}-tw .tiles", { opacity: 0, rotationX: 62, rotationZ: -38, y: 80 }, { opacity: 1, rotationX: 56, rotationZ: -34, y: 0, duration: 1, ease: "expo.out" }, ${start + 0.4});`);
        if (n) tl.push(`T.fromTo("#${id}-tw i.up", { z: 0 }, { z: ${G.lift}, duration: 0.5, ease: "back.out(2)", stagger: ${r1(1.2 / n * 100) / 100} }, ${start + 1.1});`);
        else tl.push(`T.fromTo("#${id}-tw i", { z: 0 }, { z: 18, duration: 0.35, ease: "sine.inOut", yoyo: true, repeat: 1, stagger: { each: 0.012, from: "center" } }, ${start + 1.1});`);
      }
      if (s.viz === "curve" && keys[0]) {
        const ser = data[keys[0]]?.series;
        const pts = Array.isArray(ser) && ser.length > 1 ? ser.reduce((a, x) => [...a, (a.at(-1) ?? 0) + x], []) : null;
        const cw = 1000, ch = 300;
        let path = "";
        if (pts) { const mx = pts.at(-1) || 1; path = pts.map((p, q) => `${q ? "L" : "M"}${r1((q / (pts.length - 1)) * cw)},${r1(ch - (p / mx) * ch)}`).join(" "); }
        else missing.numbers.add(`${keys[0]}.series`);
        const ax = data[keys[0]]?.axis ?? [];
        parts.push(`<svg class="curve" id="${id}-curve" viewBox="0 -10 ${cw} ${ch + 60}" preserveAspectRatio="none"><line x1="0" y1="${ch}" x2="${cw}" y2="${ch}" class="ax"/>${pts ? `<path d="${path} L${cw},${ch} L0,${ch} Z" class="area" id="${id}-area"/><path d="${path}" class="ln" id="${id}-ln" pathLength="1"/>` : `<path d="M0,${ch} L${cw},${ch * 0.1}" class="ln ghost" id="${id}-ln" pathLength="1"/>`}${ax.map((a, q) => `<text x="${q ? cw : 0}" y="${ch + 44}" text-anchor="${q ? "end" : "start"}">${esc(a)}</text>`).join("")}</svg>`);
        tl.push(`T.fromTo("#${id}-ln", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.6, ease: "power2.inOut" }, ${start + 0.9});`);
        if (pts) tl.push(`T.fromTo("#${id}-area", { opacity: 0 }, { opacity: 1, duration: 0.8 }, ${start + 1.8});`);
      }
    } else if (s.kind === "funnel") {
      // from everyone who signed up to the few ideas still standing: linear bars, so the narrowing is the story
      line(start + 0.3);
      const steps = s.steps ?? [];
      // widths are only drawn to scale when every step is known; until then every bar is a placeholder step
      const vals = steps.map(val), all = vals.every((v) => v != null), mx = all ? Math.max(...vals) : 1;
      const rows = steps.map((k, j) => {
        const v = vals[j], w = all ? Math.max(0.006, v / mx) : Math.max(0.1, 1 - j * 0.2);
        return `<div class="frow${j === steps.length - 1 ? " last" : ""}" id="${id}-r${j}"><div class="flab"><span class="fth">${esc(label(k).th)}</span><span class="fen">${esc(label(k).en)}</span></div><div class="fline"><div class="ftrack"><div class="fbar${all ? "" : " ghost"}" id="${id}-b${j}" style="width:${r1(w * 100)}%"></div></div>${numHtml(`${id}-n${j}`, k).replace('class="num', 'class="num fnum')}</div></div>`;
      });
      // window: rows come one by one; once `window` rows sit under a row it fades and the list slides up a row, so the
      // screen never fills (user 2026-11-18). Rows get a fixed height so the slide is exact.
      const win = s.window, RH = L.k === "s" ? 110 : L.k === "v" ? 150 : 150, stepT = win ? s.step ?? 1.4 : 0.55;
      parts.push(`<div class="viz funnel${win ? " win" : ""}" id="${id}-viz"${win ? ` style="--rh:${RH}px"` : ""}>${rows.join("")}</div>`);
      // stepAt (absolute s): each row comes in on its VO word (user 2026-11-19)
      const stepAt = (j) => s.stepAt?.[j] ?? start + 0.8 + j * stepT;
      if (win) steps.forEach((_, j) => { if (j < win) return; const at = stepAt(j); tl.push(`T.to("#${id}-r${j - win}", { opacity: 0, duration: 0.45, ease: "power2.out" }, ${r1(at)}); T.to("#${id}-viz .frow", { y: ${-(j - win + 1) * RH}, duration: 0.6, ease: "expo.inOut" }, ${r1(at)});`); });
      steps.forEach((k, j) => {
        const at = stepAt(j);
        tl.push(`T.fromTo("#${id}-r${j}", { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.5, ease: "expo.out" }, ${at}); T.fromTo("#${id}-b${j}", { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: "expo.out" }, ${at + 0.1});`);
        count(`${id}-n${j}`, k, at + 0.1, 0.9);
      });
      sub(start + 0.8, end, steps.map((k) => `${enNum(k)} ${label(k).en}`).join(" · "));
      if (s.themes?.length) {
        // second half: the funnel makes way for a hub (the event) wired to its themes, a light running down each wire
        const at = r1(start + Math.max(5, dur * 0.55));
        tl.push(`T.to("#${id}-viz", { opacity: 0, x: 40, duration: 0.4, ease: "power2.in" }, ${at - 0.45});`);
        const D = L.hub, nt = s.themes.length;
        const pos = s.themes.map((_, q) => { const a = -Math.PI / 2 + (q / nt) * Math.PI * 2; return [r1(Math.cos(a) * D.r * D.sx), r1(Math.sin(a) * D.r)]; });
        parts.push(`<div class="hub" id="${id}-hub" style="left:${D.x}px;top:${D.y}px"><svg class="wires" viewBox="${-D.r * D.sx - 20} ${-D.r - 20} ${2 * D.r * D.sx + 40} ${2 * D.r + 40}" style="left:${-D.r * D.sx - 20}px;top:${-D.r - 20}px;width:${2 * D.r * D.sx + 40}px;height:${2 * D.r + 40}px">${pos.map(([x, y], q) => `<line id="${id}-w${q}" x1="0" y1="0" x2="${x}" y2="${y}" pathLength="1"/>`).join("")}</svg>
          <div class="hubc" id="${id}-hc">${esc(s.hub ?? aws.title ?? "")}</div>
          ${pos.map(([x, y], q) => `<span class="chip node" id="${id}-c${q}" style="left:${x}px;top:${y}px"><b>${esc(s.themes[q].th)}</b>${s.themes[q].en ? `<i>${esc(s.themes[q].en)}</i>` : ""}</span><span class="spark" id="${id}-sp${q}"></span>`).join("")}</div>`);
        tl.push(`T.fromTo("#${id}-hc", { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(2)" }, ${at}); T.fromTo("#${id}-hub line", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.6, ease: "power2.out", stagger: 0.08 }, ${at + 0.2});`);
        pos.forEach(([x, y], q) => {
          const t0 = r1(at + 0.45 + q * 0.12);
          tl.push(`T.fromTo("#${id}-c${q}", { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.45, ease: "back.out(2)" }, ${t0}); T.fromTo("#${id}-sp${q}", { x: 0, y: 0, opacity: 0 }, { x: ${x}, y: ${y}, opacity: 1, duration: 0.9, ease: "power2.inOut" }, ${r1(t0 + 0.6)}); T.to("#${id}-sp${q}", { opacity: 0, duration: 0.2 }, ${r1(t0 + 1.5)});`);
          sfx.pop.push(t0 + 0.05);
        });
        sub(at, end, `${nt} themes: ${s.themes.map((x) => x.en).join(", ")}`);
      }
    } else if (s.kind === "statement") {
      // one short sentence, centred, on a full-bleed colour card (reference: "Payouts." "One platform." between data shots)
      const bg = s.bg ?? "accent";
      parts.push(`<div class="card-bg ${bg}" id="${id}-bg"></div>${thEn("say " + bg, `${id}-say`, s.line)}`);
      tl.push(`T.fromTo("#${id}-bg", { opacity: 0 }, { opacity: 1, duration: 0.12 }, ${start}); T.fromTo("#${id}-say .th", { scale: 1.12, opacity: 0, filter: "blur(16px)" }, { scale: 1, opacity: 1, filter: "blur(0px)", duration: 0.55, ease: "expo.out" }, ${start + 0.05}); T.fromTo("#${id}-say .en", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5, ease: "expo.out" }, ${start + 0.3});`);
      sfx.hit.push(start);
      sub(start, end, s.line?.en);
    } else if (s.kind === "burst") {
      // a run of single words, one per beat, each on its own colour card (reference: nine cuts 0.25 s apart)
      const words = s.words ?? [], step = snap(dur / Math.max(1, words.length)), bgs = s.bgs ?? ["accent", "light", "dark"];
      words.forEach((w, q) => {
        const at = start + q * step, bg = bgs[q % bgs.length], until = q === words.length - 1 ? end : at + step;
        parts.push(`<div class="card-bg ${bg}" id="${id}-bg${q}"></div>${thEn("say bw " + bg, `${id}-w${q}`, w)}`);
        tl.push(`T.set(["#${id}-bg${q}", "#${id}-w${q}"], { opacity: 1 }, ${r1(at)}); T.fromTo("#${id}-w${q} .th", { scale: 1.18, filter: "blur(10px)" }, { scale: 1, filter: "blur(0px)", duration: ${Math.min(0.3, step * 0.7).toFixed(2)}, ease: "expo.out" }, ${r1(at)}); T.set(["#${id}-bg${q}", "#${id}-w${q}"], { opacity: 0 }, ${until});`);
        if (q) cuts.push(at);
        sfx.tick.push(at);
        sub(at, until, w.en);
      });
      sfx.hit.push(start);
    } else if (s.kind === "montage") {
      // fast cuts of the finalists; each cut lights one cell of the board and names its theme
      line(start + 0.2);
      const n = val(s.count) ?? 20, cols = 5, list = s.footage ?? [];
      const B = L.board, bw = cols * B.cell + (cols - 1) * B.gap;
      const circ = s.board === "circles";
      parts.push(`<div class="board${circ ? " circ" : ""}" id="${id}-board" style="width:${bw}px;grid-template-columns:repeat(${cols},${B.cell}px);gap:${B.gap}px">${Array.from({ length: n }, (_, q) => `<i id="${id}-c${q}"><span>${q + 1}</span></i>`).join("")}</div>`);
      // circles (user 2026-11-18): AWS-gradient discs that pop in one by one across the shot, no separate lighting pass
      const pop = circ ? r1(Math.min(0.12, (dur - 0.9) / n)) : 0.02;
      tl.push(`T.fromTo("#${id}-board i", { opacity: 0, scale: ${circ ? 0.2 : 0.6} }, { opacity: 1, scale: 1, duration: ${circ ? 0.35 : 0.3}, ease: "back.out(${circ ? 2.6 : 2})", stagger: ${pop} }, ${start + 0.3});`);
      if (circ) for (let q = 0; q < n; q++) if (q % 5 === 0) sfx.tick.push(start + 0.3 + q * pop);
      const step = list.length ? Math.max(0.5, Math.round(dur / list.length / 0.5) * 0.5) : dur;
      const per = Math.max(1, Math.floor(n / Math.max(1, list.length)));
      list.forEach((f, j) => {
        const at = start + j * step;
        if (at >= end - 0.05) return;
        if (!circ) for (let q = j * per; q < Math.min(n, (j + 1) * per); q++) tl.push(`lit("#${id}-c${q}", ${r1(at + 0.1 + (q - j * per) * 0.08)});`);
        if (f.theme) {
          parts.push(`<div class="tag" id="${id}-t${j}"><b>${esc(f.theme.th)}</b>${f.theme.en ? `<i>${esc(f.theme.en)}</i>` : ""}</div>`);
          const te = Math.min(end, at + step);
          tl.push(`T.fromTo("#${id}-t${j}", { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.3, ease: "expo.out" }, ${at + 0.05}); T.set("#${id}-t${j}", { opacity: 0 }, ${te - 0.02});`);
        }
        if (j) sfx.tick.push(at);
      });
      // every cell lit by the end, even when fewer clips than finalists
      if (!circ) tl.push(`lit("#${id}-board i", ${r1(end - 1)});`);
      sfx.riser.push(Math.max(0, start - 1.2));
    } else if (s.kind === "plain") {
      // footage only, no graphics (user 2026-11-19: a closing illustration over the VO)
    } else if (s.kind === "banner") {
      // (user 2026-11-19, ref: AWS blog banners) deep blue to warm gradient, a halftone dot field on the right, the white
      // aws mark top left, a spaced kicker, a big white headline that changes on the VO (heads[].at, absolute seconds),
      // a footer line bottom left ("Read the blog ›") and a counted figure bottom right ("In collaboration with")
      const heads = s.heads ?? [];
      parts.push(`<div class="bnbg" id="${id}-bg"></div><div class="bnlight" id="${id}-lt"></div><div class="bndots" id="${id}-dots"><i></i><b></b></div>`);
      if (s.mark) parts.push(`<img class="bnmark" id="${id}-mk" src="${esc(s.mark)}" alt="">`);
      if (s.kicker) parts.push(`<div class="bnkick" id="${id}-kc">${esc(s.kicker)}</div>`);
      heads.forEach((h, q) => parts.push(`<div class="bnhead" id="${id}-h${q}"><div class="bnen">${String(h.en ?? "").split("\n").map((l, k) => `<span id="${id}-h${q}l${k}">${esc(l)}</span>`).join("")}</div>${h.th ? `<div class="bnth" id="${id}-h${q}t">${esc(h.th)}</div>` : ""}</div>`));
      // timeline (user 2026-11-19): keep the banner background but show the old "next stop" text instead of VO headlines:
      // kicker, the rail with its dated nodes (the highlight), then the prize counted up; nothing follows the VO word by word
      const tlItems = s.timeline ?? [];
      if (tlItems.length) {
        parts.push(`<div class="next bnnext" id="${id}-next" style="top:${Math.round(H * (s.timelineTop ?? 0.27))}px"><div class="nxl"><span>${esc(s.kickerTl?.th ?? "ต่อไป")}</span><i>${esc(s.kickerTl?.en ?? "Next")}</i></div><div class="rail"><div class="railln" id="${id}-rl"></div>${tlItems.map((x, q) => `<div class="node" id="${id}-nd${q}"><span class="dot"></span><div class="nd-date">${esc(x.date?.th ?? "")}</div><div class="nd-th">${esc(x.th)}</div><div class="nd-en">${esc([x.en, x.date?.en].filter(Boolean).join(" · "))}</div></div>`).join("")}</div></div>`);
        tl.push(`T.fromTo("#${id}-next", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6, ease: "expo.out" }, ${start + 0.3}); T.fromTo("#${id}-rl", { scaleX: 0 }, { scaleX: 1, duration: 1.2, ease: "power2.inOut" }, ${start + 0.6});`);
        tlItems.forEach((x, q) => { const at = start + 0.8 + q * 0.9; tl.push(`T.fromTo("#${id}-nd${q}", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.5, ease: "back.out(1.8)" }, ${at});`); sfx.pop.push(at + 0.05); });
        sub(start + 0.6, start + 4.6, `Next: ${tlItems.map((x) => [x.en, x.date?.en].filter(Boolean).join(" ")).join(" → ")}`);
        if (s.prize) {
          const pAt = start + 0.8 + tlItems.length * 0.9 + 0.3;
          parts.push(`<div class="prize" id="${id}-pz">${numHtml(`${id}-pn`, s.prize)}${thEn("lab", `${id}-pl`, label(s.prize))}</div>`);
          tl.push(`T.fromTo("#${id}-pz", { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.6, ease: "expo.out" }, ${pAt - 0.1});`);
          count(`${id}-pn`, s.prize, pAt, 1.5);
        }
      }
      if (s.footer) parts.push(`<div class="bnfoot" id="${id}-ft">${esc(s.footer)} <b>›</b></div>`);
      if (s.prize && !tlItems.length) parts.push(`<div class="bnprize" id="${id}-pz"><span>${esc(s.prizeLabel ?? label(s.prize).en)}</span>${numHtml(`${id}-pn`, s.prize)}</div>`);
      tl.push(`T.fromTo("#${id}-bg", { scale: 1.08 }, { scale: 1, duration: ${r1(dur)}, ease: "none" }, ${start});`);
      tl.push(`T.fromTo("#${id}-dots", { clipPath: "inset(0% 0% 0% 100%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.4, ease: "expo.out" }, ${start + 0.1}); T.fromTo("#${id}-dots", { x: 0 }, { x: -60, duration: ${r1(dur)}, ease: "none" }, ${start});`);
      tl.push(`T.fromTo("#${id}-lt", { opacity: 0, x: 120 }, { opacity: 1, x: 0, duration: 2.2, ease: "power2.out" }, ${start});`);
      if (s.mark) tl.push(`T.fromTo("#${id}-mk", { opacity: 0, y: -16 }, { opacity: 1, y: 0, duration: 0.6, ease: "expo.out" }, ${start + 0.2});`);
      if (s.kicker) tl.push(`T.fromTo("#${id}-kc", { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: 0.5, ease: "expo.out" }, ${start + 0.3});`);
      heads.forEach((h, q) => {
        const at = h.at ?? start + 0.4, nx = heads[q + 1]?.at, n = String(h.en ?? "").split("\n").length;
        tl.push(`T.fromTo("#${id}-h${q} .bnen span", { y: 70, opacity: 0, filter: "blur(12px)" }, { y: 0, opacity: 1, filter: "blur(0px)", duration: 0.7, ease: "expo.out", stagger: 0.12 }, ${r1(at)});`);
        if (h.th) tl.push(`T.fromTo("#${id}-h${q}t", { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "expo.out" }, ${r1(at + 0.2 + n * 0.12)});`);
        if (nx != null) tl.push(`T.to("#${id}-h${q}", { y: -50, opacity: 0, filter: "blur(10px)", duration: 0.4, ease: "power2.in" }, ${r1(nx - 0.4)});`);
        if (q) sfx.pop.push(at);
      });
      if (s.footer) tl.push(`T.fromTo("#${id}-ft", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5, ease: "expo.out" }, ${start + (s.footerIn ?? 1.2)});`);
      if (s.prize && !tlItems.length) { const pAt = start + (s.prizeIn ?? 1.6); tl.push(`T.fromTo("#${id}-pz", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: "expo.out" }, ${pAt - 0.2});`); count(`${id}-pn`, s.prize, pAt, 1.4); }
      sfx.hit.push(start);
    } else if (s.kind === "end") {
      // what comes next: two dates on a line, the prize counted up, then the logo card
      const tlItems = s.timeline ?? [];
      parts.push(`<div class="endbg" id="${id}-bg"></div>`);
      const hasNext = tlItems.length > 0 || !!s.kicker;
      if (hasNext) parts.push(`<div class="next" id="${id}-next"><div class="nxl"><span>${esc(s.kicker?.th ?? "ต่อไป")}</span><i>${esc(s.kicker?.en ?? "Next")}</i></div><div class="rail"><div class="railln" id="${id}-rl"></div>${tlItems.map((x, q) => `<div class="node" id="${id}-nd${q}"><span class="dot"></span><div class="nd-date">${esc(x.date?.th ?? "")}</div><div class="nd-th">${esc(x.th)}</div><div class="nd-en">${esc([x.en, x.date?.en].filter(Boolean).join(" · "))}</div></div>`).join("")}</div></div>`);
      if (!hasNext) tl.push(`T.fromTo("#${id}-bg", { opacity: 0 }, { opacity: 1, duration: 0.5 }, ${start});`);
      if (hasNext) tl.push(`T.fromTo("#${id}-bg", { opacity: 0 }, { opacity: 1, duration: 0.5 }, ${start}); T.fromTo("#${id}-next", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6, ease: "expo.out" }, ${start + 0.2}); T.fromTo("#${id}-rl", { scaleX: 0 }, { scaleX: 1, duration: 1.2, ease: "power2.inOut" }, ${start + 0.5});`);
      tlItems.forEach((x, q) => { const at = start + 0.6 + q * 0.9; tl.push(`T.fromTo("#${id}-nd${q}", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.5, ease: "back.out(1.8)" }, ${at});`); sfx.pop.push(at + 0.05); });
      if (hasNext) sub(start + 0.6, start + 4.6, `Next: ${tlItems.map((x) => [x.en, x.date?.en].filter(Boolean).join(" ")).join(" → ")}`);
      // logoIn (s from the scene start) brings the logo card in on a VO word instead of the last 4 s
      const logoAt = start + (s.logoIn ?? Math.max(4, dur - 4));
      if (s.prize) {
        const pAt = start + 0.6 + tlItems.length * 0.9 + 0.3;
        parts.push(`<div class="prize" id="${id}-pz">${numHtml(`${id}-pn`, s.prize)}${thEn("lab", `${id}-pl`, label(s.prize))}</div>`);
        tl.push(`T.fromTo("#${id}-pz", { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.6, ease: "expo.out" }, ${pAt - 0.1});`);
        count(`${id}-pn`, s.prize, pAt, 1.5);
        sub(pAt, logoAt, `${label(s.prize).en} ${enNum(s.prize)}`);
      }
      const outs = [hasNext && `#${id}-next`, s.prize && `#${id}-pz`].filter(Boolean);
      if (outs.length) tl.push(`T.to(${JSON.stringify(outs)}, { opacity: 0, y: -30, duration: 0.5, ease: "power2.in" }, ${logoAt - 0.5});`);
      // logo card: the main event logo big, partners in one row, "Powered by AWS" set apart (lock-up rules come from the partners)
      const logos = s.logos ?? [];
      const logoHtml = (l, cls, lid) => {
        if (l.src && existsSync(join(dir, l.src))) return `<div class="${cls}" id="${lid}"><img src="${esc(l.src)}" alt="${esc(l.name ?? "")}"></div>`;
        missing.logos.push(l.name ?? l.src);
        return `<div class="${cls} ph" id="${lid}"><span>${esc(l.name ?? "logo")}</span></div>`;
      };
      const [main, ...partners] = logos;
      // lockup (user 2026-11-19): the partners + "Powered by AWS" as one supplied image
      if (s.lockup) {
        parts.push(`<div class="logos lk" id="${id}-logos" style="gap:${s.lockup.gap ?? 80}px;--lkw:${s.lockup.mainW ?? Math.round(W * 0.52)}px">${main ? logoHtml(main, "lg main", `${id}-lg0`) : ""}${s.tagline ? thEn("blk tagline", `${id}-tag`, s.tagline) : ""}<img class="lockup" id="${id}-lk" src="${esc(s.lockup.src)}" alt="" style="height:${s.lockup.h ?? 300}px"></div>`);
        tl.push(`T.fromTo("#${id}-lg0", { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.7, ease: "expo.out" }, ${logoAt}); T.fromTo("#${id}-lk", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.6, ease: "expo.out" }, ${logoAt + 0.5});`);
        if (s.tagline) tl.push(`T.fromTo("#${id}-tag", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5, ease: "expo.out" }, ${logoAt + 0.3});`);
        sfx.hit.push(logoAt);
        sub(logoAt, end, logos.map((l) => l.name).filter(Boolean).join(" · ") + (s.powered ? ` · ${s.powered.label ?? "Powered by"} ${s.powered.name ?? ""}` : ""));
      } else {
      parts.push(`<div class="logos${s.logoPanel ? " panel" : ""}${s.logoPanel === "clear" ? " clear" : ""}" id="${id}-logos">${main ? logoHtml(main, "lg main", `${id}-lg0`) : ""}${s.tagline ? thEn("blk tagline", `${id}-tag`, s.tagline) : ""}<div class="lrow">${partners.map((l, q) => logoHtml(l, "lg", `${id}-lg${q + 1}`)).join("")}</div>${s.powered ? `<div class="pw"><span>${esc(s.powered.label ?? "Powered by")}</span>${logoHtml(s.powered, "lg pwl", `${id}-pw`)}</div>` : ""}</div>`);
      tl.push(`T.fromTo("#${id}-lg0", { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.7, ease: "expo.out" }, ${logoAt}); T.fromTo("#${id}-logos .lrow .lg", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: "expo.out", stagger: 0.1 }, ${logoAt + 0.5});`);
      if (s.logoPanel) tl.push(`T.fromTo("#${id}-logos .lrow", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: "expo.out" }, ${logoAt + 0.4});`);
      if (s.tagline) tl.push(`T.fromTo("#${id}-tag", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5, ease: "expo.out" }, ${logoAt + 0.3});`);
      if (s.powered) tl.push(`T.fromTo("#${id}-logos .pw", { opacity: 0 }, { opacity: 1, duration: 0.5 }, ${logoAt + 0.6 + partners.length * 0.1});`);
      sfx.hit.push(logoAt);
      sub(logoAt, end, logos.map((l) => l.name).filter(Boolean).join(" · ") + (s.powered ? ` · ${s.powered.label ?? "Powered by"} ${s.powered.name ?? ""}` : ""));
      }
    } else die(`${id}: kind "${s.kind}" tidak dikenal (photowall|maskopen|triptych|open|stat|funnel|statement|burst|montage|plain|banner|end)`);

    if (["stat", "funnel"].includes(s.kind) && (aws.source?.th || aws.source?.en)) parts.push(`<div class="src" id="${id}-src">${esc([aws.source.th, aws.source.en].filter(Boolean).join(" · "))}</div>`);
    dom.push(`<section class="scene" id="${id}">\n${parts.join("\n")}\n</section>`);
    js.push(`// ${id} · ${s.kind} · ${start.toFixed(2)}-${end.toFixed(2)}\nT.set("#${id}", { opacity: 1 }, ${start}); T.set("#${id}", { opacity: 0 }, ${end});\n${tl.join("\n")}`);
    t = end;
  }
  const total = snap(t);
  if (total > 179) die(`durasi ${total} s > 179 s`);
  // voice-over (user 2026-11-18): aws.json → vo { track, vol?, subs?: false, lines: [{ start, end, en }] }; when it is
  // there, the English subtitles follow the VO (burned in at the bottom + .srt) instead of the on-screen text
  const vo = aws.vo?.track && existsSync(join(dir, aws.vo.track)) ? aws.vo : null;
  if (vo) {
    srt.length = 0;
    for (const [q, c] of (vo.lines ?? []).entries()) {
      srt.push({ start: c.start, end: c.end, text: plain(c.en) });
      if (vo.subs === false) continue;
      dom.push(`<div class="vosub" id="vs${q}"><span>${esc(plain(c.en))}</span></div>`);
      js.push(`T.set("#vs${q}", { opacity: 1 }, ${r1(c.start)}); T.set("#vs${q}", { opacity: 0 }, ${r1(c.end)});`);
    }
  }
  // numbers filled in for preview only (data.<key>.placeholder): the HUD says so on every frame until the client's arrive
  const usedKeys = new Set(aws.scenes.flatMap((s) => [...(s.stats ?? []), ...(s.steps ?? []), s.count, s.prize].filter(Boolean)));
  const dummy = [...usedKeys].filter((k) => data[k]?.placeholder && data[k]?.value != null);
  missing.dummy = dummy;

  // ---------- composition ----------
  const B = L.board;
  const css = `
    #root { position: absolute; inset: 0; overflow: hidden; background: var(--ground); font-family: var(--font-body); color: var(--ink); }
    #ftg { position: absolute; inset: 0; }
    .logos .tagline { position: static; margin: 4px 0 26px; text-align: center; }
    .logos .tagline .th { font-size: ${Math.round(Math.min(W, H) * 0.05)}px; font-weight: 700; }
    .logos .tagline .en { font-size: ${Math.round(Math.min(W, H) * 0.026)}px; }
    .pwbg { position: absolute; inset: 0; background: radial-gradient(60% 50% at 50% 35%, rgba(255,153,0,.10), transparent 70%), linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px) 0 0/ ${Math.round(W / 24)}px ${Math.round(W / 24)}px, linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px) 0 0/ ${Math.round(W / 24)}px ${Math.round(W / 24)}px, #0b0b0d; }
    .pww { position: absolute; border-radius: 14px; overflow: hidden; background: #1a1a1f; box-shadow: 0 10px 30px rgba(0,0,0,.55); opacity: 0; }
    .pww img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 28%; display: block; }
    .pww .pwe { position: absolute; inset: 0; background: linear-gradient(135deg, rgba(26,47,176,.55), rgba(91,43,214,.45) 40%, rgba(196,38,143,.4) 72%, rgba(255,153,0,.45)); }
    .pww b { position: absolute; left: 10px; top: 10px; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; font: 700 22px/1 var(--font-display); color: #fff; background: linear-gradient(135deg, #1a2fb0 0%, #5b2bd6 38%, #c4268f 70%, #ff9900 100%); }
    .tp { position: absolute; top: 0; height: 100%; overflow: hidden; background: #0b0d14; box-shadow: inset 2px 0 0 rgba(0,0,0,.85); }
    .tp img { position: absolute; top: 0; object-fit: cover; transform-origin: 50% 45%; }
    .tp .tps { position: absolute; inset: 0; overflow: hidden; }
    .tps.dev .tex { position: absolute; inset: 0; background: repeating-linear-gradient(90deg, rgba(255,255,255,.05) 0 2px, transparent 2px 9px), radial-gradient(70% 50% at 50% 55%, rgba(255,255,255,.12), transparent 70%); mix-blend-mode: soft-light; }
    .dv { position: absolute; left: 50%; top: 50%; background: linear-gradient(145deg, #3a3d44, #111317 55%, #2a2c31); box-shadow: 0 40px 80px rgba(0,0,0,.55), inset 0 0 0 2px rgba(255,255,255,.12); box-sizing: border-box; }
    .dvs { position: relative; width: 100%; height: 100%; overflow: hidden; background: #fff; }
    .dvs img { position: absolute; left: 0; top: 0; display: block; }
    .dv .isl { position: absolute; left: 50%; top: 20px; width: 84px; height: 24px; margin-left: -42px; border-radius: 12px; background: #050505; }
    .tpw { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); text-align: center; font: 600 ${Math.round(H * 0.17)}px/1 var(--font-display); color: #fff; opacity: 0; }
    .tp img.tpb { filter: blur(28px) brightness(.9); transform: scale(1.15); }
    .tp .tpn, .tp .tpl { position: absolute; left: ${Math.round(W * 0.016)}px; font: 500 ${Math.max(28, Math.round(Math.min(W, H) * 0.026))}px/1 var(--font-mono); letter-spacing: .12em; text-transform: uppercase; color: rgba(255,255,255,.85); text-shadow: 0 1px 8px rgba(0,0,0,.6); }
    .tp .tpn { top: ${Math.round(H * 0.07)}px; } .tp .tpl { bottom: ${Math.round(H * 0.13)}px; display: flex; align-items: center; gap: 12px; }
    .tp .tpl i { width: 12px; height: 12px; background: var(--accent); }
    .mg { position: absolute; inset: 0; }
    .mk, .mkw { position: absolute; inset: 0; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; }
    .mk { background-image: repeating-linear-gradient(90deg, rgba(255,255,255,.16) 0 1px, transparent 1px ${Math.round(W / 20)}px);
      -webkit-mask-size: 100% 100%, var(--mw) auto; mask-size: 100% 100%, var(--mw) auto; -webkit-mask-position: 0 0, var(--mx) var(--my); mask-position: 0 0, var(--mx) var(--my);
      -webkit-mask-composite: xor; mask-composite: exclude; }
    .mkw { background: #fff; clip-path: inset(0% 100% 0% 0%); -webkit-mask-size: var(--mw) auto; mask-size: var(--mw) auto; -webkit-mask-position: var(--mx) var(--my); mask-position: var(--mx) var(--my); }
    .mkline { position: absolute; left: 0; right: 0; text-align: center; opacity: 0; }
    .mkls { position: absolute; left: 0; right: 0; text-align: center; opacity: 0; }
    .mkls img { display: inline-block; width: auto; vertical-align: top; }
    .logos .lockup { width: auto; max-width: ${W - 2 * L.pad}px; object-fit: contain; opacity: 0; }
    .mkline .th { font: 700 ${Math.round(Math.min(W, H) * 0.05)}px/1.15 var(--font-display); color: #fff; }
    .mkline .en { font: 400 ${Math.round(Math.min(W, H) * 0.024)}px/1.3 var(--font-body); color: rgba(255,255,255,.75); margin-top: 6px; }
    .mkp { position: absolute; left: 0; right: 0; display: flex; justify-content: center; gap: ${Math.round(W * 0.03)}px; opacity: 0;
      font: 500 ${Math.max(28, Math.round(Math.min(W, H) * 0.026))}px/1 var(--font-mono); letter-spacing: .14em; text-transform: uppercase; }
    .mkp span { color: rgba(255,255,255,.72); }
    .bulb { position: absolute; opacity: 0; pointer-events: none; }
    .bulb .spr { position: absolute; inset: 0; background-repeat: no-repeat; background-position: 0 0; filter: brightness(1.35) contrast(1.05); }
    .bulb .bf { position: absolute; inset: 0; }
    .bulb .core { position: absolute; left: 50%; top: 38%; width: 62%; aspect-ratio: 1; transform: translate(-50%, -50%); border-radius: 50%; opacity: 0; mix-blend-mode: screen; background: radial-gradient(circle, rgba(255,250,210,1) 0%, rgba(255,230,120,.85) 35%, rgba(255,210,60,0) 72%); }
    .bulb .halo { position: absolute; left: 50%; top: 38%; width: 260%; aspect-ratio: 1; transform: translate(-50%, -50%); border-radius: 50%; opacity: 0; mix-blend-mode: screen;
      background: radial-gradient(circle, rgba(255,248,190,1) 0%, rgba(255,226,100,.9) 16%, rgba(255,205,50,.45) 36%, rgba(255,190,30,.15) 54%, rgba(255,190,30,0) 70%); }
    .vosub { position: absolute; left: 8%; right: 8%; bottom: ${Math.round(H * 0.045)}px; text-align: center; opacity: 0; z-index: 60; pointer-events: none; }
    .vosub span { display: inline-block; padding: 6px 16px; font-family: var(--font-body); font-weight: 500; font-size: ${Math.round(Math.min(W, H) * 0.03)}px; line-height: 1.3; color: #fff; background: rgba(0,0,0,.55); }
    .fw { position: absolute; inset: 0; transform-origin: 50% 45%; }
    .fw .ftg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .slate { position: absolute; inset: 0; background: repeating-linear-gradient(135deg, #0C1424 0 26px, #0A1120 26px 52px); display: grid; place-items: center; }
    .sl-in { display: flex; flex-direction: column; align-items: center; gap: 14px; max-width: 70%; text-align: center; padding: 28px 40px; border: 2px dashed rgba(245,247,250,.28); border-radius: 14px; background: rgba(7,11,20,.55); }
    .sl-in b { font: 600 ${Math.max(28, Math.round(L.en * 0.8))}px/1 var(--font-mono); letter-spacing: .3em; color: var(--accent); }
    .sl-in span { font: 500 ${L.en}px/1.1 var(--font-mono); color: var(--ink); }
    .sl-in i { font: 300 ${Math.max(28, Math.round(L.en * 0.9))}px/1.3 var(--font-body); font-style: normal; color: var(--muted); }
    #shade { position: absolute; inset: 0; --shade-g: ${L.k === "h" ? "linear-gradient(90deg, rgba(7,11,20,.82) 0%, rgba(7,11,20,.35) 55%, rgba(7,11,20,.55) 100%)" : "linear-gradient(180deg, rgba(7,11,20,.8) 0%, rgba(7,11,20,.35) 45%, rgba(7,11,20,.75) 100%)"}; }
    .scene { position: absolute; inset: 0; opacity: 0; }
    .blk { position: absolute; left: ${L.blk.left}px; width: ${L.blk.width}px; ${L.blk.bottom != null ? `bottom: ${L.blk.bottom}px;` : `top: ${L.blk.top}px;`} }
    .blk .th { font: 700 ${L.th}px/1.12 var(--font-display); letter-spacing: -0.01em; color: var(--ink); text-wrap: balance; }
    .blk .en { margin-top: 14px; font: 300 ${L.en}px/1.3 var(--font-body); color: var(--muted); }
    .blk.center { left: 0; right: 0; width: auto; text-align: center; top: auto; bottom: ${L.k === "h" ? 170 : L.k === "v" ? 640 : 160}px; }
    .blk.center .th { font-size: ${Math.round(L.th * 0.62)}px; font-weight: 500; }
    .title { position: absolute; left: 0; right: 0; top: 50%; margin-top: -${Math.round(L.title * 0.6)}px; text-align: center; font: 700 ${L.title}px/1.1 var(--font-display); color: var(--ink); white-space: nowrap; text-shadow: 0 10px 60px rgba(0,0,0,.5); }
    .viz { position: absolute; left: ${L.viz.left}px; top: ${L.viz.top}px; width: ${L.viz.width}px; }
    .fbar { opacity: ${aws.barOpacity ?? 1}; }
    .stats { display: flex; flex-direction: column; gap: ${L.k === "h" ? 36 : 28}px; }
    .stat { display: flex; flex-direction: column; }
    .num { font: 700 ${L.num}px/0.95 var(--font-display); font-variant-numeric: tabular-nums; color: var(--accent); letter-spacing: -0.02em; white-space: nowrap; text-shadow: 0 8px 40px rgba(0,0,0,.45); }
    .stats.n2 .num { font-size: ${Math.round(L.num * 0.72)}px; }
    .num em { font-style: normal; font-size: .5em; margin: 0 .12em; color: var(--ink); }
    .num.tbc { display: inline-block; align-self: flex-start; font-size: ${Math.round(L.num * 0.42)}px; padding: .12em .4em; border: 4px dashed var(--accent); border-radius: 18px; color: var(--accent); letter-spacing: .08em; }
    .lab .th { font: 700 ${L.lab}px/1.15 var(--font-display); color: var(--ink); }
    .lab .en { font: 300 ${Math.max(28, Math.round(L.lab * 0.62))}px/1.3 var(--font-body); color: var(--muted); }
    .dots { position: absolute; left: ${L.viz.left}px; ${L.k === "h" ? `top: ${L.viz.top + 540}px; width: ${L.viz.width}px;` : L.k === "v" ? `top: 1360px; width: ${L.viz.width}px;` : `top: 880px; width: ${L.viz.width}px;`} display: grid; gap: 8px; }
    .dots i { display: block; aspect-ratio: 1; border-radius: 50%; background: var(--cool); box-shadow: 0 0 14px color-mix(in srgb, var(--cool) 60%, transparent); }
    .dots.ghost i { background: transparent; border: 2px dashed var(--line); box-shadow: none; }
    .curve { position: absolute; left: ${L.viz.left}px; ${L.k === "h" ? `top: ${L.viz.top + 420}px; width: ${L.viz.width}px; height: 260px;` : L.k === "v" ? `top: 1080px; width: ${L.viz.width}px; height: 240px;` : `top: 640px; width: ${L.viz.width}px; height: 260px;`} overflow: visible; }
    .curve .ax { stroke: var(--line); stroke-width: 2; }
    .curve .ln { fill: none; stroke: var(--cool); stroke-width: 5; stroke-dasharray: 1; vector-effect: non-scaling-stroke; }
    .curve .ln.ghost { stroke: var(--line); stroke-dasharray: 0.02 0.015; }
    .curve .area { fill: color-mix(in srgb, var(--cool) 22%, transparent); }
    .curve text { fill: var(--muted); font: 300 40px var(--font-body); }
    .funnel { display: flex; flex-direction: column; gap: ${L.k === "s" ? 8 : 18}px; }
    .frow { display: flex; flex-direction: column; gap: 6px; }
    .funnel.win { gap: 0; }
    .funnel.win .frow { height: var(--rh); justify-content: center; }
    .flab { display: flex; align-items: baseline; gap: 14px; white-space: nowrap; }
    .fth { font: 700 ${Math.round(L.lab * 0.8)}px/1.1 var(--font-display); color: var(--ink); }
    .fen { font: 300 ${Math.max(28, Math.round(L.lab * 0.52))}px/1.2 var(--font-body); color: var(--muted); }
    .fline { display: grid; grid-template-columns: 1fr ${L.k === "s" ? 170 : 200}px; align-items: center; gap: 20px; }
    .ftrack { height: ${L.k === "s" ? 26 : 34}px; border-radius: 8px; background: rgba(245,247,250,.07); overflow: hidden; }
    .fbar { height: 100%; min-width: 6px; border-radius: 8px; background: var(--cool); transform-origin: 0 50%; }
    .frow.last .fbar { background: var(--accent); box-shadow: 0 0 24px color-mix(in srgb, var(--accent) 70%, transparent); }
    .fbar.ghost { background: repeating-linear-gradient(135deg, rgba(245,247,250,.22) 0 10px, transparent 10px 20px); }
    .fnum { font-size: ${Math.round(L.num * 0.25)}px; text-align: right; color: var(--ink); }
    .frow.last .fnum { color: var(--accent); }
    .fnum.tbc { font-size: ${Math.max(28, Math.round(L.num * 0.16))}px; border-width: 3px; justify-self: end; padding: .05em .35em; }
    .frow.last .fbar.ghost { background: repeating-linear-gradient(135deg, color-mix(in srgb, var(--accent) 70%, transparent) 0 10px, transparent 10px 20px); }
    .chips { margin-top: ${L.k === "s" ? 8 : 16}px; display: flex; flex-wrap: wrap; gap: 12px; }
    .viz.funnel { top: ${L.k === "v" ? 600 : L.k === "s" ? 340 : L.viz.top}px; }
    .chip { display: inline-flex; align-items: baseline; gap: 10px; padding: 10px 18px; border-radius: 999px; background: rgba(7,11,20,.7); border: 2px solid color-mix(in srgb, var(--accent) 70%, transparent); }
    .chip b { font: 700 ${Math.round(L.en * 0.95)}px/1 var(--font-display); color: var(--ink); }
    .chip i { font: 300 ${Math.max(28, Math.round(L.en * 0.62))}px/1 var(--font-body); font-style: normal; color: var(--muted); }
    .board { position: absolute; right: ${B.right}px; top: ${B.top}px; display: grid; }
    .board i { display: grid; place-items: center; width: ${B.cell}px; height: ${B.cell}px; border-radius: 10px; border: 2px solid var(--line); background: rgba(7,11,20,.55); }
    .board.circ i { border-radius: 50%; border: none; background: linear-gradient(135deg, #1a2fb0 0%, #5b2bd6 38%, #c4268f 70%, #ff9900 100%); box-shadow: 0 6px 22px rgba(20,10,60,.45); }
    .board.circ i span { color: #fff; }
    .board i span { font: 700 ${Math.max(28, Math.round(B.cell * 0.36))}px/1 var(--font-display); color: var(--muted); font-variant-numeric: tabular-nums; }
    .tag { position: absolute; left: ${L.blk.left}px; ${L.k === "h" ? `bottom: ${L.blk.bottom + 230}px;` : L.k === "v" ? "top: 560px;" : "top: 360px;"} display: inline-flex; align-items: baseline; gap: 12px; padding: 12px 22px; border-radius: 10px; background: var(--accent); opacity: 0; }
    .tag b { font: 700 ${Math.round(L.en * 1.15)}px/1 var(--font-display); color: var(--on-accent); }
    .tag i { font: 300 ${Math.max(28, Math.round(L.en * 0.75))}px/1 var(--font-body); font-style: normal; color: var(--on-accent); opacity: .8; }
    .bnbg { position: absolute; inset: 0; background: radial-gradient(70% 90% at 100% 100%, rgba(255,153,0,.85) 0%, rgba(255,153,0,0) 60%), radial-gradient(60% 70% at 100% 0%, rgba(214,196,170,.75) 0%, rgba(214,196,170,0) 65%), linear-gradient(100deg, #061A6B 0%, #0A2FB0 34%, #1F63D6 58%, #4E8FE0 74%, #C9B48E 92%); transform-origin: 20% 50%; }
    .bnlight { position: absolute; inset: 0; background: linear-gradient(118deg, transparent 52%, rgba(255,255,255,.10) 58%, transparent 66%); mix-blend-mode: screen; }
    .bndots { position: absolute; top: 0; bottom: 0; right: -60px; width: ${Math.round(W * 0.55)}px; -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 45%); mask-image: linear-gradient(90deg, transparent 0%, #000 45%); }
    .bndots i, .bndots b { position: absolute; inset: 0; }
    .bndots i { background: radial-gradient(circle, rgba(255,255,255,.55) 0 3px, transparent 3.6px) 0 0 / 26px 26px; opacity: .55; }
    .bndots b { background: radial-gradient(circle, transparent 0 6px, rgba(255,255,255,.45) 6.5px 7.6px, transparent 8.2px) 13px 13px / 52px 52px; opacity: .5; }
    .bnmark { position: absolute; left: ${L.pad}px; top: ${Math.round(H * 0.075)}px; height: ${Math.round(H * 0.09)}px; width: auto; opacity: 0; }
    .bnkick { position: absolute; left: ${L.pad}px; top: ${Math.round(H * 0.26)}px; font: 700 ${Math.max(28, Math.round(L.en * 0.95))}px/1 var(--font-body); letter-spacing: .16em; text-transform: uppercase; color: rgba(255,255,255,.92); opacity: 0; }
    .bnhead { position: absolute; left: ${L.pad}px; top: ${Math.round(H * 0.26) + 64}px; max-width: ${Math.round(W * 0.62)}px; }
    .bnen span { display: block; font: 700 ${Math.round(L.th * 1.35)}px/1.06 var(--font-display); color: #fff; letter-spacing: -.01em; opacity: 0; }
    .bnth { margin-top: 22px; font: 500 ${Math.round(L.en * 1.25)}px/1.3 var(--font-body); color: rgba(255,255,255,.85); opacity: 0; }
    .bnnext .railln { background: rgba(255,255,255,.55); }
    .bnnext .nd-date { color: #fff; } .bnnext .nd-th { color: #fff; }
    .bnfoot { position: absolute; left: ${L.pad}px; bottom: ${Math.round(H * 0.125)}px; font: 600 ${Math.max(28, Math.round(L.en * 1.05))}px/1.2 var(--font-body); color: #fff; opacity: 0; }
    .bnfoot b { font-weight: 700; }
    .bnprize { position: absolute; right: ${L.pad}px; bottom: ${Math.round(H * 0.115)}px; text-align: right; color: #fff; opacity: 0; }
    .bnprize > span { display: block; font: 500 ${Math.max(28, Math.round(L.en * 0.85))}px/1.2 var(--font-body); color: rgba(255,255,255,.9); margin-bottom: 6px; }
    .bnprize .num { font-size: ${Math.round(L.num * 0.42)}px; }
    .endbg { position: absolute; inset: 0; background: radial-gradient(ellipse at 85% 95%, #5A0F4A 0%, transparent 55%), linear-gradient(135deg, #141B6B 0%, #2A1460 55%, #3A0F4E 100%); }
    .next { position: absolute; left: ${L.pad}px; right: ${L.pad}px; top: ${L.k === "h" ? 170 : L.k === "v" ? 320 : 120}px; }
    .nxl { font: 700 ${Math.round(L.lab * 1.1)}px/1 var(--font-display); color: var(--accent); }
    .nxl i { font: 300 ${Math.max(28, Math.round(L.en * 0.8))}px/1 var(--font-body); font-style: normal; color: var(--muted); margin-left: 16px; }
    .rail { position: relative; margin-top: 40px; display: flex; ${L.k === "v" ? "flex-direction: column; gap: 70px; padding-left: 50px;" : "justify-content: space-between; padding-top: 50px;"} }
    .railln { position: absolute; background: var(--line); ${L.k === "v" ? "left: 12px; top: 12px; bottom: 30px; width: 4px; transform-origin: 50% 0;" : "left: 12px; right: 12px; top: 12px; height: 4px; transform-origin: 0 50%;"} }
    .node { position: relative; ${L.k === "v" ? "" : "width: 46%;"} }
    .node .dot { position: absolute; ${L.k === "v" ? "left: -50px; top: 4px;" : "left: 0; top: -50px;"} width: 28px; height: 28px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 8px color-mix(in srgb, var(--accent) 25%, transparent); }
    .nd-date { font: 700 ${Math.round(L.lab * 1.25)}px/1.05 var(--font-display); color: var(--ink); }
    .nd-th { margin-top: 8px; font: 700 ${L.lab}px/1.15 var(--font-display); color: var(--ink); }
    .nd-en { margin-top: 6px; font: 300 ${Math.max(28, Math.round(L.en * 0.85))}px/1.3 var(--font-body); color: var(--muted); }
    .prize { position: absolute; left: ${L.pad}px; ${L.k === "h" ? "bottom: 140px;" : L.k === "v" ? "top: 1000px;" : "bottom: 90px;"} }
    .prize .num { font-size: ${Math.round(L.num * (L.k === "s" ? 0.62 : 0.78))}px; }
    .logos { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: ${L.k === "h" ? 56 : 70}px; }
    .lg { display: grid; place-items: center; height: ${L.k === "h" ? 90 : 84}px; min-width: 120px; opacity: 0; }
    .lg img { max-height: 100%; max-width: ${L.k === "h" ? 260 : 220}px; object-fit: contain; }
    .lg.main { height: ${L.k === "h" ? 200 : 220}px; }
    .lg.main img { max-width: ${L.k === "h" ? 640 : 760}px; }
    .logos.lk .lg.main { height: auto; } .logos.lk .lg.main img { width: var(--lkw); max-width: none; height: auto; max-height: none; }
    .lg.ph { border: 2px dashed var(--line); border-radius: 12px; padding: 0 24px; }
    .lg.ph span { font: 500 ${Math.max(28, Math.round(L.en * 0.85))}px/1.1 var(--font-mono); color: var(--muted); text-align: center; }
    .lg.main.ph span { font-size: ${L.en * 1.6}px; color: var(--ink); }
    .lrow { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: ${L.k === "h" ? 56 : 40}px; max-width: ${W - 2 * L.pad}px; }
    .pw { display: flex; align-items: center; gap: 18px; opacity: 0; }
    .pw > span { font: 300 ${Math.max(28, Math.round(L.en * 0.85))}px/1 var(--font-body); color: var(--muted); }
    .pw .lg { opacity: 1; height: ${L.k === "h" ? 70 : 64}px; }
    /* logoPanel: partner logos that come on white (JPG/boxed PNG, dark AWS wordmark) sit on one white strip */
    .logos.panel { gap: ${L.k === "h" ? 34 : 44}px; }
    .logos.panel .lg img { width: auto; max-width: none; }
    .logos.panel .lg.main, .logos.panel .lg.main img { height: ${L.k === "h" ? 76 : 64}px; }
    .logos.panel .lg.main img { max-width: ${W - 2 * L.pad}px; }
    .logos.panel .lrow { opacity: 0; background: #fff; padding: 22px 56px; border-radius: 16px; gap: ${L.k === "h" ? 64 : 40}px; }
    .logos.panel .lrow .lg, .logos.panel .lrow .lg img { height: ${L.k === "h" ? 104 : 88}px; }
    .logos.panel .pw { background: #fff; padding: 12px 30px; border-radius: 12px; }
    .logos.panel .pw .lg, .logos.panel .pw .lg img { height: ${L.k === "h" ? 60 : 52}px; }
    .logos.panel .pw > span { color: #232F3E; }
    .logos.panel.clear .lrow, .logos.panel.clear .pw { background: none; }
    .logos.panel.clear .pw > span { color: var(--muted); }
    .logos.panel.clear .lg.main, .logos.panel.clear .lg.main img { height: ${L.k === "h" ? 96 : 80}px; }
    .logos.panel.clear .lrow .lg, .logos.panel.clear .lrow .lg img { height: ${L.k === "h" ? 150 : 120}px; }
    .logos.panel.clear .pw .lg, .logos.panel.clear .pw .lg img { height: ${L.k === "h" ? 84 : 70}px; }
    .src { position: absolute; right: ${L.pad}px; bottom: ${L.hud + 60}px; font: 500 ${Math.max(28, Math.round(L.en * 0.7))}px/1 var(--font-mono); color: var(--muted); letter-spacing: .04em; }
    .acc { color: var(--accent); }
    .blk .en, .lab .en, .fen, .nd-en, .chip i { color: rgba(245,247,250,.86) !important; text-shadow: 0 2px 14px rgba(0,0,0,.55); }
    .blk .th, .lab .th, .num, .fth { text-shadow: 0 4px 30px rgba(0,0,0,.45); }
    .chips { display: flex; flex-wrap: wrap; gap: 12px; }
    #shade { background-image: radial-gradient(rgba(245,247,250,.07) 1.2px, transparent 1.4px), var(--shade-g); background-size: 28px 28px, 100% 100%; }
    .kick { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; font: 500 ${Math.max(28, Math.round(L.en * 0.85))}px/1 var(--font-mono); letter-spacing: .18em; color: var(--muted); }
    .kick i { width: 14px; height: 14px; background: var(--accent); }
    .kick b { color: var(--accent); font-weight: 600; }
    .kick .kl { width: 40px; height: 2px; background: var(--muted); opacity: .6; }
    .blk.line .th { filter: none; }
    .stats.hero { left: 0; right: 0; width: auto; top: ${L.cloud.y - Math.round(L.num * 0.62)}px; align-items: center; text-align: center; }
    .stats.hero .stat { align-items: center; }
    .stats.hero .lab .en { letter-spacing: .3em; text-transform: uppercase; font-family: var(--font-mono); }
    .stats.hero .num.tbc { align-self: center; }
    .cloud { position: absolute; width: 0; height: 0; }
    .cloud i { position: absolute; left: 0; top: 0; height: 6px; border-radius: 3px; display: block; }
    .tilewrap { position: absolute; width: 0; height: 0; perspective: 1800px; }
    .tiles { position: absolute; transform: translate(-50%, -50%); display: grid; transform-style: preserve-3d; opacity: 0; }
    .tiles i { display: block; aspect-ratio: 1; border-radius: 6px; background: rgba(214,224,236,.32); border: 1px solid rgba(245,247,250,.28); transform-style: preserve-3d; }
    .tiles i.up { background: var(--accent); border-color: var(--accent); box-shadow: 0 0 22px color-mix(in srgb, var(--accent) 55%, transparent); }
    .hub { position: absolute; width: 0; height: 0; }
    .hub .wires { position: absolute; overflow: visible; }
    .hub line { stroke: color-mix(in srgb, var(--accent) 65%, transparent); stroke-width: 2.5; stroke-dasharray: 1; }
    .hubc { position: absolute; transform: translate(-50%, -50%); white-space: nowrap; padding: 16px 30px; border-radius: 999px; background: var(--accent); color: var(--on-accent); font: 700 ${Math.round(L.lab * 0.9)}px/1 var(--font-display); box-shadow: 0 0 60px color-mix(in srgb, var(--accent) 50%, transparent); opacity: 0; }
    .chip.node { position: absolute; transform: translate(-50%, -50%); flex-direction: column; align-items: center; gap: 6px; padding: 14px 22px; border-radius: 16px; background: rgba(7,11,20,.82); opacity: 0; }
    .spark { position: absolute; left: -9px; top: -9px; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 0 18px 6px color-mix(in srgb, var(--accent) 80%, transparent); opacity: 0; }
    .card-bg { position: absolute; inset: 0; opacity: 0; }
    .card-bg.accent { background: var(--accent); } .card-bg.light { background: #F2F0EA; } .card-bg.dark { background: radial-gradient(ellipse at 85% 95%, #5A0F4A 0%, transparent 55%), linear-gradient(135deg, #141B6B 0%, #2A1460 55%, #3A0F4E 100%); }
    .say.bw { opacity: 0; }
    .say { position: absolute; left: ${L.pad}px; right: ${L.pad}px; top: 50%; transform: translateY(-50%); text-align: center; }
    .say .th { font: 700 ${Math.round(L.title * 0.62)}px/1.1 var(--font-display); letter-spacing: -0.02em; text-wrap: balance; }
    .say .en { margin-top: 18px; font: 300 ${Math.max(28, L.en)}px/1.3 var(--font-body); }
    .say.accent .th, .say.accent .en { color: var(--on-accent); } .say.accent .acc { color: var(--ground); text-decoration: underline; text-decoration-thickness: .08em; text-underline-offset: .12em; }
    .say.light .th { color: #0B0F18; } .say.light .en { color: #5A6372; }
    .say.dark .th { color: var(--ink); } .say.dark .en { color: var(--muted); }
    #hud { position: absolute; inset: 0; pointer-events: none; font: 500 ${Math.max(28, Math.round(L.en * 0.72))}px/1 var(--font-mono); letter-spacing: .16em; color: rgba(245,247,250,.62); z-index: 20; }
    #hud .cn { position: absolute; width: 26px; height: 26px; border-color: rgba(245,247,250,.55); border-style: solid; border-width: 0; }
    #hud .c1 { left: ${L.hud}px; top: ${L.hud}px; border-left-width: 2px; border-top-width: 2px; } #hud .c2 { right: ${L.hud}px; top: ${L.hud}px; border-right-width: 2px; border-top-width: 2px; }
    #hud .c3 { left: ${L.hud}px; bottom: ${L.hud}px; border-left-width: 2px; border-bottom-width: 2px; } #hud .c4 { right: ${L.hud}px; bottom: ${L.hud}px; border-right-width: 2px; border-bottom-width: 2px; }
    #hud .tl { position: absolute; left: ${L.hud + 40}px; top: ${L.hud + 8}px; } #hud .tl i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: var(--accent); margin-right: 14px; }
    #hud .dummy { display: block; margin-top: 12px; color: var(--alert); letter-spacing: .14em; }
    #hud .tr { position: absolute; right: ${L.hud + 40}px; top: ${L.hud + 8}px; font-variant-numeric: tabular-nums; }
    #hud .bl { position: absolute; left: ${L.hud + 40}px; bottom: ${L.hud + 8}px; } #hud .hs { position: absolute; left: 0; bottom: 0; white-space: nowrap; opacity: 0; }
    #hud .br { position: absolute; right: ${L.hud + 40}px; bottom: ${L.hud + 14}px; width: ${L.k === "h" ? 220 : 160}px; height: 2px; background: rgba(245,247,250,.18); }
    #hud .br b { position: absolute; inset: 0; background: var(--accent); transform-origin: 0 50%; transform: scaleX(0); }
    #flash { position: absolute; inset: -10%; background: radial-gradient(ellipse at 30% 40%, color-mix(in srgb, var(--accent) 80%, white) 0%, transparent 60%); mix-blend-mode: screen; opacity: 0; pointer-events: none; }`;

  const passCss = pass === "plate" ? `\n    .scene, #flash { display: none !important; }`
    : pass === "gfx" ? `\n    #ftg, #shade { display: none !important; } #root { background: transparent !important; }\n    ${AE_TEXT.join(", ")} { color: transparent !important; text-shadow: none !important; }\n    .curve text { fill: transparent !important; }` : "";
  // Amazon Ember (AWS brand type, not free): used first when the user drops the licensed files in presets/aws/fonts/ember/
  const emberDir = join(ROOT, "presets", "aws", "fonts", "ember");
  const ember = existsSync(emberDir) ? readdirSync(emberDir).filter((f) => /\.(ttf|otf|woff2?)$/i.test(f)) : [];
  let emberCss = "";
  if (ember.length) {
    mkdirSync(join(dir, "assets", "fonts", "ember"), { recursive: true });
    for (const f of ember) {
      copyFileSync(join(emberDir, f), join(dir, "assets", "fonts", "ember", f));
      const wt = /th(in)?|lt|light/i.test(f) ? 300 : /he(avy)?|black/i.test(f) ? 800 : /bd|bold/i.test(f) ? 700 : /md|medium/i.test(f) ? 500 : 400;
      emberCss += `\n    @font-face { font-family: "Amazon Ember"; src: url("assets/fonts/ember/${f}"); font-weight: ${wt}; font-style: ${/it/i.test(f.replace(/lt|light/i, "")) ? "italic" : "normal"}; }`;
    }
  }
  mkdirSync(join(dir, "compositions"), { recursive: true });
  if (ember.length) emberCss += `
    #root { --font-display: "Amazon Ember", "AWS Sans", sans-serif; --font-body: "Amazon Ember", "AWS Sans", sans-serif; }`;
  const comp = `<template>
  <!-- AWS look (generated by tools/aws.mjs from aws.json, do not edit by hand: change aws.json and build again).
       Footage layer first (graded via hyperframes media-treatment, class "ftg"), then shade, scenes, flash. -->
  <div id="root" data-composition-id="film" data-width="${W}" data-height="${H}">
  <style>${emberCss}${css}${passCss}
  </style>
  <div id="ftg">
${ftg.join("\n")}
  </div>
  <div id="shade"></div>
${dom.join("\n")}
  <div id="flash"></div>
${aws.corner ? `  <img id="corner" src="${esc(aws.corner.src)}" alt="" style="position:absolute;top:${L.hud + 4}px;right:${L.pad}px;height:${aws.corner.h ?? 40}px;width:auto;opacity:0">` : ""}
${aws.hud === false ? "" : `  <div id="hud"><span class="cn c1"></span><span class="cn c2"></span><span class="cn c3"></span><span class="cn c4"></span>
    <div class="tl"><i></i>${esc(String(aws.hudLabel ?? `${plain(aws.title ?? "")} / RECAP`).toUpperCase())}${dummy.length ? `<b class="dummy">ANGKA SEMENTARA · DUMMY DATA</b>` : ""}</div><div class="tr" id="hud-tc">00:00:00:00</div>
    <div class="bl">${hudSecs.join("")}</div><div class="br"><b id="hud-pb"></b></div></div>`}
  <script>
    (() => {
    const T = gsap.timeline({ paused: true });
    // counted numbers: tabular figures, 1.2-1.6 s, then hold
    const count = (id, to, at, d) => {
      const el = document.querySelector("#" + id + " b"); if (!el) return;
      const o = { v: 0 };
      T.fromTo(o, { v: 0 }, { v: to, duration: d, ease: "power3.out", immediateRender: false, onUpdate: () => { el.textContent = Math.round(o.v).toLocaleString("en-US"); } }, at);
      T.fromTo("#" + id, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4, ease: "expo.out" }, at);
    };
    // decoding kicker: letters scramble until they lock left to right (deterministic per frame, no random)
    const CH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&";
    const decode = (id, at, d) => {
      const el = document.getElementById(id); if (!el) return;
      const full = el.dataset.text, o = { p: 0 };
      T.fromTo(o, { p: 0 }, { p: 1, duration: d, ease: "none", immediateRender: false, onUpdate: () => {
        const n = Math.floor(o.p * full.length), f = Math.round(T.time() * 30);
        let s = ""; for (let i = 0; i < full.length; i++) s += i < n || full[i] === " " ? full[i] : CH[(i * 7 + f * 13 + i * f) % CH.length];
        el.textContent = s; } }, at);
    };
    // a finalist's cell lights up in the accent
    const cs = getComputedStyle(document.documentElement), ACC = cs.getPropertyValue("--accent").trim() || "#FFB020", ON = cs.getPropertyValue("--on-accent").trim() || "#0B0B0F";
    const lit = (sel, at) => { T.set(sel, { backgroundColor: ACC, borderColor: ACC }, at); T.set(sel + " span", { color: ON }, at); };
    // a warm light leak on every cut
    const flash = (at) => { T.fromTo("#flash", { opacity: 0 }, { opacity: 0.55, duration: 0.08, ease: "none", immediateRender: false }, at - 0.04); T.to("#flash", { opacity: 0, duration: 0.35, ease: "power2.out" }, at + 0.04); };
${js.join("\n")}
${(aws.corner?.at ?? []).map(([a, b]) => `    T.fromTo("#corner", { opacity: 0, x: 12 }, { opacity: 0.9, x: 0, duration: 0.4, ease: "expo.out", immediateRender: false }, ${a}); T.to("#corner", { opacity: 0, duration: 0.3, ease: "power2.in" }, ${b - 0.3});`).join("\n")}
${aws.hud === false ? "" : `    // HUD: running timecode and the progress line over the whole film, one section label at a time
    { const tc = document.getElementById("hud-tc"), o = { v: 0 }, p2 = (n) => String(n).padStart(2, "0");
      T.fromTo(o, { v: 0 }, { v: ${total}, duration: ${total}, ease: "none", onUpdate: () => { const fr = Math.round(o.v * 30); tc.textContent = "00:" + p2(Math.floor(fr / 1800)) + ":" + p2(Math.floor(fr / 30) % 60) + ":" + p2(fr % 30); } }, 0);
      T.fromTo("#hud-pb", { scaleX: 0 }, { scaleX: 1, duration: ${total}, ease: "none" }, 0); }
    ${hudJs.join("\n    ")}`}
    T.set({}, {}, ${total});
    window.__timelines = window.__timelines || {};
    window.__timelines["film"] = T;
    })();
  </script>
  </div>
</template>
`;
  writeFileSync(join(dir, "compositions", "film.html"), comp);

  // grade every real shot (media-treatment writes data-color-grading on .ftg; never CSS filters)
  if (nf) {
    // the grade goes in as a file: inline JSON loses its quotes through the Windows shell
    const gf = join(dir, "build", "grade.json");
    mkdirSync(join(dir, "build"), { recursive: true });
    writeFileSync(gf, JSON.stringify(aws.grade ?? readJSON(presetFile(lookOfDir(dir), "preset.json")).grade ?? readJSON(join(ROOT, "presets", "aws", "preset.json")).grade));
    const g = spawnSync("npx", ["hyperframes", "media-treatment", "--project", dir, "--file", "compositions/film.html", "--selector", ".ftg", "--grading", gf, "--apply", "--json"], { encoding: "utf8", shell: process.platform === "win32" });
    if (g.status !== 0) console.log(`⚠ grade gagal: ${(g.stdout || g.stderr).slice(-400)}`);
  }

  // ---------- fonts (presets/aws/fonts -> assets/fonts) ----------
  for (const ff of brand.fontFaces ?? []) {
    const m = /^assets\/fonts\/([^/]+)$/.exec(ff.src ?? "");
    if (!m || existsSync(join(dir, ff.src))) continue;
    mkdirSync(join(dir, "assets", "fonts"), { recursive: true });
    copyFileSync(presetFile(lookOfDir(dir), "fonts", m[1]), join(dir, ff.src));
  }

  // ---------- audio ----------
  const tags = [], lines = [], sfxEvents = [];
  mkdirSync(join(dir, "assets", "sfx"), { recursive: true });
  const mu = aws.music ?? {};
  if (vo) {
    tags.push(`<audio id="vo" src="${esc(vo.track)}" data-start="0" data-duration="${total}" data-volume="${vo.vol ?? 1}" data-track-index="9"></audio>`);
    lines.push(`${vo.track}\t${vo.origin ?? "voice-over"}`);
  }
  if (!mu.off) {
    if (mu.track && existsSync(join(dir, mu.track))) {
      tags.push(`<audio id="music" src="${esc(mu.track)}" data-start="0" data-duration="${total}"${mu.in ? ` data-media-start="${mu.in}"` : ""} data-volume="${vo ? mu.duck ?? 0.32 : mu.vol ?? 0.85}" data-track-index="10"></audio>`);
      lines.push(`${mu.track}\tlagu berlisensi pilihan user/klien (${mu.license ?? "lisensi: isi aws.json → music.license"})`);
    } else {
      // temp score until the licensed track is chosen: the energy follows the brief (build, peak at the Top 20, ease off)
      const base = readJSON(presetFile(lookOfDir(dir), "preset.json")).music ?? readJSON(join(ROOT, "presets", "aws", "preset.json")).music;
      const secs = [], sc = aws.scenes;
      let a = 0;
      for (const s of sc) {
        const d = snap(s.dur ?? 5);
        const density = s.kind === "open" ? 0.25 : s.kind === "montage" ? 0.75 : s.kind === "end" ? 0.3 : 0.45;
        secs.push({ start: a, dur: d, music: { ...base, density, drums: s.kind === "end" ? "lofi" : base.drums }, seed: 31 + secs.length });
        a += d;
      }
      renderScore(secs, total, join(dir, "assets", "music.wav"));
      tags.push(`<audio id="music" src="assets/music.wav" data-start="0" data-duration="${total}" data-volume="${mu.vol ?? 0.8}" data-track-index="10"></audio>`);
      lines.push("assets/music.wav\tmusik sementara, dikomposisi dari matematika oleh tools/anim-music.mjs (seeded), bebas lisensi; ganti dengan lagu berlisensi (aws.json → music.track)");
    }
  }
  // aws.json → sfxVol overrides per effect; 0 drops it (user 2026-11-19: no whoosh, louder music instead)
  const VOL = { whoosh: 0.14, hit: 0.32, tick: 0.18, pop: 0.2, riser: 0.22, ...(aws.sfxVol ?? {}) };
  let k = 0, lane = 12;
  for (const [name, times] of Object.entries(sfx)) {
    if (!times.length || !VOL[name]) continue;
    copyFileSync(join(ROOT, "library", "sfx", `${name}.wav`), join(dir, "assets", "sfx", `${name}.wav`));
    const len = Math.floor(probeDuration(join(dir, "assets", "sfx", `${name}.wav`)) * 1000) / 1000;
    // one pair of lanes per effect, alternating, so no two sounds overlap on a lane
    times.sort((a, b) => a - b).forEach((at) => sfxEvents.push({ file: `assets/sfx/${name}.wav`, at: Math.max(0, at - (name === "whoosh" ? 0.16 : 0.04)), vol: VOL[name] }));
    times.forEach((at, q) => tags.push(`<audio id="sfx-${k++}" src="assets/sfx/${name}.wav" data-start="${Math.max(0, at - (name === "whoosh" ? 0.16 : 0.04)).toFixed(3)}" data-duration="${len}" data-volume="${VOL[name]}" data-track-index="${lane + (q % 2)}"></audio>`));
    lane += 2;
    lines.push(`assets/sfx/${name}.wav\tkit SFX library/sfx (dibuat dari matematika), bebas lisensi`);
  }

  // ---------- index.html ----------
  const idxPath = join(dir, "index.html");
  let html = readFileSync(idxPath, "utf8").replace(/\/\*@brand\*\/[\s\S]*?\/\*@end\*\//, () => brandCss(brand));
  const host = `<div id="film" class="clip" data-composition-id="film" data-composition-src="compositions/film.html" data-start="0" data-duration="${total}" data-track-index="0" data-track-kind="graphics" data-width="${W}" data-height="${H}"></div>`;
  html = html.replace(/<!--@beats-->[\s\S]*?<!--@beats-end-->/, () => `<!--@beats-->\n      ${host}\n      <!--@beats-end-->`);
  html = html.replace(/(<div id="root"[^>]*\bdata-duration=")[^"]*"/, (_, a) => `${a}${total}"`);
  html = html.replace(/<!--@sfx-->[\s\S]*?<!--@sfx-end-->/, () => `<!--@sfx-->\n      ${(pass === "full" ? tags : []).join("\n      ")}\n      <!--@sfx-end-->`);
  html = html.replace(/(html, body \{[^}]*background: )[^;]+;/, (_, a) => `${a}${pass === "gfx" ? "transparent" : "var(--ground)"};`);
  writeFileSync(idxPath, html);
  if (pass !== "full") return { dir, total };

  // ---------- sources.txt: footage and logos the client handed over, plus generated audio ----------
  const srcFile = join(dir, "sources.txt");
  const have = existsSync(srcFile) ? readFileSync(srcFile, "utf8").split(/\r?\n/).filter(Boolean) : [];
  // generated lines are rewritten every build (footage origin may change from previz to the client's real footage)
  const keep = have.filter((l) => !/^assets\/(music\.wav|sfx\/|footage\/|music\/|vo\/)/.test(l));
  const used = [];
  for (const s of aws.scenes) {
    for (const f of s.footage ?? []) if (f.src && existsSync(join(dir, "assets", "footage", f.src))) used.push([`assets/footage/${f.src}`, f.origin ?? "footage asli acara dari klien, hanya peserta dengan persetujuan PDPA"]);
    for (const l of [...(s.logos ?? []), ...(s.powered ? [s.powered] : [])]) if (l.src && existsSync(join(dir, l.src))) used.push([l.src, `logo resmi ${l.name ?? ""} dari klien/mitra`]);
  }
  const fresh = used.filter(([p], q) => used.findIndex(([x]) => x === p) === q && !keep.some((l) => l.startsWith(`${p}\t`))).map(([p, w]) => `${p}\t${w}`);
  writeFileSync(srcFile, [...keep, ...fresh, ...lines].join("\n") + "\n");

  // ---------- English subtitles (.srt), one cue per text group ----------
  mkdirSync(join(dir, "out"), { recursive: true });
  const ts = (x) => { const ms = Math.round(x * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`; };
  const cues = srt.filter((c) => c.text).sort((a, b) => a.start - b.start).map((c, q, all) => ({ ...c, end: Math.min(c.end, all[q + 1]?.start ?? c.end) })).filter((c) => c.end - c.start > 0.3);
  writeFileSync(join(dir, "out", `${slug}.en.srt`), cues.map((c, q) => `${q + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n`).join("\n"));

  const scenes = [];
  writeJSON(join(dir, "build", "ae.json"), { width: W, height: H, fps: FPS, duration: total, counts, sfx: sfxEvents, music: tags.find((x) => x.startsWith('<audio id="music"'))?.match(/src="([^"]+)"/)?.[1] ?? null, musicVol: vo ? mu.duck ?? 0.32 : mu.vol ?? 0.8, vo: vo?.track ?? null, voVol: vo?.vol ?? 1, scenes: aws.scenes.reduce((a, s) => [...a, { id: s.id, kind: s.kind, start: a.length ? a.at(-1).start + a.at(-1).duration : 0, duration: snap(s.dur ?? 5), label: s.line?.en ?? s.title ?? s.kind }], []) });
  { let a = 0; for (const s of aws.scenes) { const d = snap(s.dur ?? 5); scenes.push({ id: s.id, kind: s.kind, start: a, duration: d, line: s.line?.th ?? s.title ?? "" }); a += d; } }
  writeJSON(join(dir, "build", "timeline.json"), { duration: total, beats: scenes.map(({ id, kind, start, duration, line }) => ({ id, start, duration, register: kind, hero: line || kind, framing: kind, job: line || id, character: false, marks: {} })) });
  console.log(`✔ ${W}×${H}, ${scenes.length} adegan, ${total.toFixed(2)} s, ${nf} shot asli`);
  for (const s of scenes) console.log(`  ${s.start.toFixed(2).padStart(6)}  ${s.duration.toFixed(2).padStart(5)}s  ${s.id.padEnd(8)} ${s.kind.padEnd(8)} ${s.line}`);
  return { dir, aws, total, missing, scenes };
}

export function lint(slug) {
  const r = build(slug);
  const { aws, missing, total, scenes } = r;
  const errors = [], warns = [];
  if (scenes[0]?.kind === "end") errors.push("adegan pertama tidak boleh kartu logo");
  if (scenes.at(-1)?.kind !== "end") warns.push("tanpa kartu penutup (kind end)");
  if (missing.dummy?.length) warns.push(`angka DUMMY (placeholder): ${missing.dummy.join(", ")}. HUD menandainya; ganti dengan angka klien sebelum dikirim.`);
  if (missing.numbers.size) warns.push(`angka belum dikonfirmasi (TBC): ${[...missing.numbers].join(", ")}. Jangan kirim ke publik sebelum klien mengisi.`);
  if (missing.footage.length) warns.push(`${missing.footage.length} shot masih slate:\n${missing.footage.map((f) => `     ${f.scene}: ${f.src}  (${f.need})`).join("\n")}`);
  if (missing.logos.length) warns.push(`logo belum ada (kotak nama): ${missing.logos.join(", ")}`);
  if (!aws.music?.track) warns.push("musik masih skor sementara dari kode; brief minta lagu berlisensi (aws.json → music.track)");
  for (const s of aws.scenes) for (const t of [s.line, ...(s.themes ?? [])].filter(Boolean)) if (t.th && !t.en) warns.push(`${s.id}: teks Thai tanpa terjemahan Inggris`);
  if (total < 10) warns.push(`total ${total} s, sangat pendek`);
  for (const w of warns) console.log(`⚠ ${w}`);
  for (const e of errors) console.log(`✖ ${e}`);
  return { ...r, errors, warns };
}

// what TERTORTOR shows in the AWS tab: numbers (TBC or not), footage slots, logos, music, and every output
export function awsInfo(dir, slug) {
  const aws = loadAws(dir);
  if (!aws) return null;
  const f = (p) => (existsSync(join(dir, p)) ? `/files/videos/${slug}/${p}` : null);
  const used = new Set((aws.scenes ?? []).flatMap((s) => [...(s.stats ?? []), ...(s.steps ?? []), s.count, s.prize].filter(Boolean)));
  const data = Object.entries(aws.data ?? {}).map(([key, d]) => ({ key, th: d.th ?? "", en: d.en ?? "", value: d.value ?? null, note: d.note ?? "", prefix: d.prefix ?? "", suffix: d.suffix ?? "", used: used.has(key) }));
  const slots = [], logos = [];
  for (const s of aws.scenes ?? []) {
    (s.footage ?? []).forEach((x, i) => slots.push({ scene: s.id, index: i, src: x.src ?? "", need: x.need ?? "", theme: x.theme?.en ?? "", url: x.src ? f(`assets/footage/${x.src}`) : null }));
    for (const l of [...(s.logos ?? []), ...(s.powered ? [s.powered] : [])]) logos.push({ name: l.name ?? "", src: l.src ?? "", url: l.src ? f(l.src) : null });
  }
  const variants = ["9x16", "1x1"].map((k) => { const vs = `${slug}-${k}`; return { kind: k, slug: vs, exists: existsSync(join(ROOT, "videos", vs, "meta.json")), video: existsSync(join(ROOT, "videos", vs, "out", `${vs}.mp4`)) ? `/files/videos/${vs}/out/${vs}.mp4` : null }; });
  return {
    data, slots, logos, variants, master: !readMeta(dir).variantOf,
    // only numbers a scene shows count as TBC (an optional metric nobody uses does not block the film)
    tbc: data.filter((d) => d.value == null && used.has(d.key)).map((d) => d.key),
    music: aws.music?.track ? { track: aws.music.track, url: f(aws.music.track), license: aws.music.license ?? "" } : null,
    srt: f(`out/${slug}.en.srt`), ae: f(`out/ae/${slug}.jsx`) ? { jsx: f(`out/ae/${slug}.jsx`), plate: !!f("out/ae/plate.mov"), gfx: !!f("out/ae/graphics.mov"), dir: `videos/${slug}/out/ae` } : null,
  };
}

// a footage file uploaded for one slot: saved under the slot's name (its own extension) and aws.json follows
export function setSlot(dir, scene, index, ext) {
  const aws = loadAws(dir);
  const s = aws?.scenes?.find((x) => x.id === scene);
  const slot = s?.footage?.[index];
  if (!slot) throw new Error(`slot ${scene}:${index} tidak ada`);
  const base = (slot.src || `${scene}-${index + 1}`).replace(/\.[^.]+$/, "");
  slot.src = `${base}${ext.toLowerCase()}`;
  writeJSON(join(dir, "aws.json"), aws);
  return join(dir, "assets", "footage", slot.src);
}

// the 9:16 and 1:1 cut-downs: own projects (Ubah format), same aws.json + assets, laid out again by build()
export function formats(slug, kinds = ["9x16", "1x1"]) {
  const src = videoDir(slug);
  if (readMeta(src).variantOf) die("jalankan dari proyek master (16:9)");
  const out = [];
  for (const kind of kinds) {
    const vs = variantSlug(slug, kind), vd = join(ROOT, "videos", vs);
    if (!existsSync(vd)) createVariant(slug, kind);
    // always the master's current aws.json and assets (footage, logos, music, fonts): the variants never drift
    copyFileSync(join(src, "aws.json"), join(vd, "aws.json"));
    for (const d of ["footage", "logos", "music", "fonts"]) {
      const a = join(src, "assets", d);
      if (!existsSync(a)) continue;
      mkdirSync(join(vd, "assets", d), { recursive: true });
      for (const f of readdirSync(a)) {
        const from = join(a, f), to = join(vd, "assets", d, f);
        if (statSync(from).isDirectory()) { cpSync(from, to, { recursive: true }); continue; }
        if (!existsSync(to) || statSync(to).size !== statSync(from).size || statSync(to).mtimeMs < statSync(from).mtimeMs) copyFileSync(from, to);
      }
    }
    writeFileSync(join(vd, "FORMAT.md"), `# Versi ${kind.replace("x", ":")} dari \`${slug}\` (AWS)\n\nDibuat ulang dari aws.json master oleh \`node tools/aws.mjs formats ${slug}\`: footage, angka, dan teks sama; tata letak\nadegan disusun untuk bingkai ini (bukan dipotong). Jangan edit aws.json di sini: ubah master lalu jalankan formats lagi.\n`);
    build(vs);
    out.push(vs);
  }
  return out;
}

if (process.argv[1]?.endsWith("aws.mjs")) {
  const [cmd, slug, ...rest] = process.argv.slice(2);
  const opt = (k, d) => (rest.includes(k) ? rest[rest.indexOf(k) + 1] : d);
  if (!cmd || !slug) die("pakai: node tools/aws.mjs new|build|check|formats <slug>");
  if (cmd === "new") {
    if (!/^[a-z0-9-]+$/.test(slug)) die("slug hanya huruf kecil, angka, dan tanda minus");
    const title = rest[0] && !rest[0].startsWith("--") ? rest[0] : slug;
    const look = opt("--look", "aws");
    create(slug, title, { format: opt("--format", "horizontal"), idea: String(opt("--idea", "")).trim(), look });
    console.log(`videos/${slug}: ${title} (${look === "aws" ? "AWS" : `${look}, alur AWS`})`);
  } else if (cmd === "build") build(slug);
  else if (cmd === "check") {
    const { errors, dir } = lint(slug);
    if (errors.length) process.exit(1);
    const r = spawnSync("npx", ["hyperframes", "check", dir], { stdio: "inherit", shell: process.platform === "win32" });
    if (r.status !== 0) process.exit(1);
    console.log("\n✔ gerbang lolos");
  } else if (cmd === "formats") {
    const only = opt("--only");
    console.log(formats(slug, only ? only.split(",") : undefined).map((s) => `✔ ${s}`).join("\n"));
  } else die(`perintah tidak dikenal: ${cmd}`);
}
