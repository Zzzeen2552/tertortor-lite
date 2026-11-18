// aws-ae.mjs: After Effects package of an AWS film (user 2026-11-17: "selain MP4 juga bisa diedit di After Effects").
// HTML cannot be opened in AE, so the film is split into what an editor needs and rebuilt by a script:
//   out/ae/plate.mov       graded footage + shade (ProRes 422 HQ), no graphics
//   out/ae/graphics.mov    every graphic on alpha (ProRes 4444): bars, dots, board, chips, rails... minus the text glyphs
//   out/ae/<slug>.jsx      File > Scripts > Run Script File: makes the comp, stacks plate + graphics, and adds every Thai/
//                          English line and number as an EDITABLE text layer at its place and time (numbers count up by
//                          expression), scene markers, music + SFX stems, the original clips in a bin
//   out/ae/audio/music.wav, audio/sfx.wav, footage/, logos/, <slug>.en.srt, README.md
// Text positions are measured in the browser at the moment each line is fully on screen.
//
//   node tools/aws-ae.mjs <slug> [--skip-render]
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, rmSync, statSync, cpSync } from "node:fs";
import { join, basename } from "node:path";
import { pathToFileURL } from "node:url";
import { homedir } from "node:os";
import puppeteer from "puppeteer-core";
import { ROOT, readJSON, die, videoDir, run } from "./lib.mjs";
import { build, AE_TEXT, isAws } from "./aws.mjs";

const PS = {
  Kanit: { 500: "Kanit-Medium", 600: "Kanit-SemiBold", 700: "Kanit-Bold", 800: "Kanit-ExtraBold" },
  Inter: { 300: "Inter-Light", 400: "Inter-Regular", 700: "Inter-Bold" },
  "Amazon Ember": { 300: "AmazonEmber-Light", 400: "AmazonEmber-Regular", 700: "AmazonEmber-Bold", 800: "AmazonEmber-Heavy" },
  "IBM Plex Sans Thai": { 300: "IBMPlexSansThai-Light", 400: "IBMPlexSansThai-Regular", 500: "IBMPlexSansThai-Medium", 600: "IBMPlexSansThai-SemiBold", 700: "IBMPlexSansThai-Bold" },
  "JetBrains Mono": { 400: "JetBrainsMono-Regular", 500: "JetBrainsMono-Medium", 600: "JetBrainsMono-SemiBold" },
};
// "AWS Sans" = Inter for Latin + IBM Plex Sans Thai for Thai; AE has no per-glyph fallback, so a line with Thai uses Plex Thai
const psFor = (fam, w, text) => (fam === "AWS Sans" ? (/[\u0E00-\u0E7F]/.test(text) ? psName("IBM Plex Sans Thai", w) : psName("Inter", w)) : psName(fam, w));
const psName = (fam, w) => { const f = PS[fam]; if (!f) return fam.replace(/\s+/g, ""); const ks = Object.keys(f).map(Number); const k = ks.reduce((a, b) => (Math.abs(b - w) < Math.abs(a - w) ? b : a)); return f[k]; };

function chrome() {
  const base = join(homedir(), ".cache", "hyperframes", "chrome", "chrome-headless-shell");
  if (!existsSync(base)) die("Chrome HyperFrames tidak ditemukan (~/.cache/hyperframes/chrome); jalankan sekali npx hyperframes render");
  for (const v of readdirSync(base).sort().reverse()) {
    const exe = join(base, v, "chrome-headless-shell-win64", "chrome-headless-shell.exe");
    if (existsSync(exe)) return exe;
  }
  die("chrome-headless-shell.exe tidak ditemukan");
}

// one standalone page: index.html with the film composition inlined (no runtime, no audio), seeked by hand
async function measure(dir, ae) {
  const idx = readFileSync(join(dir, "index.html"), "utf8");
  const tpl = readFileSync(join(dir, "compositions", "film.html"), "utf8").match(/<template>([\s\S]*)<\/template>/)[1];
  const page = idx.replace(/<!--@beats-->[\s\S]*?<!--@beats-end-->/, () => tpl).replace(/<!--@sfx-->[\s\S]*?<!--@sfx-end-->/, "").replace(/<video /g, '<video preload="none" ').replace(/<audio [^>]*><\/audio>/g, "");
  const file = join(dir, ".ae-measure.html");
  writeFileSync(file, page);
  const browser = await puppeteer.launch({ executablePath: chrome(), headless: true, args: ["--allow-file-access-from-files", "--autoplay-policy=no-user-gesture-required"] });
  try {
    const p = await browser.newPage();
    await p.setViewport({ width: ae.width, height: ae.height, deviceScaleFactor: 1 });
    // footage never plays here (only positions and text matter), so it is not loaded; wait for GSAP and the timeline
    await p.goto(pathToFileURL(file).href, { waitUntil: "domcontentloaded", timeout: 90000 });
    const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    for (let i = 0; ; i++) {
      if (await p.evaluate(() => !!(window.__timelines && window.__timelines.film))) break;
      if (i > 120) throw new Error(`timeline film tidak terdaftar: ${errs.join(" | ").slice(0, 400)}`);
      await new Promise((r) => setTimeout(r, 500));
    }
    await p.evaluate(() => document.fonts.ready);
    const sel = AE_TEXT.join(", ");
    return await p.evaluate(async (sel, total) => {
      const T = window.__timelines.film;
      const els = [...document.querySelectorAll(sel)].filter((e) => e.textContent.trim() && !e.closest(".slate"));
      const seen = els.map(() => ({ first: null, last: null, best: null, maxO: 0 }));
      const op = (e) => { let o = 1; for (let n = e; n && n.nodeType === 1; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === "none" || cs.visibility === "hidden") return 0; o *= +cs.opacity; } return o; };
      const lines = (e) => {
        // split by rendered line: walk the characters, a new top = a new line
        const out = []; let cur = "", top = null;
        const walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
        const r = document.createRange();
        for (let n = walker.nextNode(); n; n = walker.nextNode()) for (let i = 0; i < n.length; i++) {
          r.setStart(n, i); r.setEnd(n, i + 1);
          const rc = r.getClientRects()[0];
          if (rc && top != null && rc.top > top + rc.height * 0.6) { out.push(cur); cur = ""; }
          if (rc) top = top == null || rc.top > top + rc.height * 0.6 ? rc.top : top;
          cur += n.data[i];
        }
        out.push(cur);
        return out.map((x) => x.trim()).filter(Boolean);
      };
      for (let t = 0; t <= total + 1e-6; t += 0.1) {
        T.seek(t, false);
        els.forEach((e, i) => {
          const o = op(e), s = seen[i];
          if (o < 0.04) return;
          if (s.first == null) s.first = t;
          s.last = t;
          // fully in = as opaque as it ever gets (a line styled at 0.8 opacity is "in" at 0.8)
          s.maxO = Math.max(s.maxO, o);
          if (o >= s.maxO - 0.02) {
            const r = document.createRange(); r.selectNodeContents(e);
            const b = r.getBoundingClientRect();
            if (b.width < 1) return;
            const cs = getComputedStyle(e);
            s.best = { t, x: b.left, y: b.top, w: b.width, h: b.height, text: e.textContent.trim(), lines: lines(e), family: cs.fontFamily.split(",")[0].replace(/["']/g, "").trim(), weight: +cs.fontWeight, size: parseFloat(cs.fontSize), color: cs.color, align: cs.textAlign, tracking: parseFloat(cs.letterSpacing) || 0, lh: parseFloat(cs.lineHeight) || 0, tag: e.tagName, id: e.id || e.parentElement?.id || "", cls: e.className || e.parentElement?.className || "" };
          }
        });
      }
      return seen.map((s, i) => ({ ...s.best, first: s.first, last: s.last })).filter((s) => s.text && s.first != null);
    }, sel, ae.duration);
  } finally {
    await browser.close();
    rmSync(file, { force: true });
  }
}

const render = (dir, out, profile) => run("npx", ["hyperframes", "render", dir, "-o", out, "--format", "mov", "--prores-profile", profile, "--fps", "30", "--quiet"], { stdio: "inherit" });
// ExtendScript reads the .jsx as plain bytes: every non-ASCII character goes in as \uXXXX
const jsLit = (v) => JSON.stringify(v).replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
const rgb = (c) => (c.match(/[\d.]+/g) ?? [255, 255, 255]).slice(0, 3).map((x) => Math.round((+x / 255) * 1000) / 1000);

export async function exportAE(slug, { skipRender = false } = {}) {
  const dir = videoDir(slug);
  if (!isAws(dir)) die(`videos/${slug} bukan proyek AWS`);
  const outDir = join(dir, "out", "ae");
  mkdirSync(join(outDir, "audio"), { recursive: true });

  build(slug);
  const ae = readJSON(join(dir, "build", "ae.json"));
  console.log("Mengukur teks…");
  const texts = await measure(dir, ae);

  if (!skipRender) {
    try {
      build(slug, { pass: "plate" });
      console.log("Render plate (footage ter-grade)…");
      render(dir, join(outDir, "plate.mov"), "hq");
      build(slug, { pass: "gfx" });
      console.log("Render grafis (alpha)…");
      render(dir, join(outDir, "graphics.mov"), "4444");
    } finally {
      build(slug); // the project always ends on the full film
    }
  }

  // audio stems: music as is, every SFX hit mixed into one track at its time and level
  if (ae.music && existsSync(join(dir, ae.music))) copyFileSync(join(dir, ae.music), join(outDir, "audio", "music" + (ae.music.match(/\.\w+$/)?.[0] ?? ".wav")));
  if (ae.vo && existsSync(join(dir, ae.vo))) copyFileSync(join(dir, ae.vo), join(outDir, "audio", "vo.wav"));
  if (ae.sfx.length) {
    const ins = [], fl = [];
    ae.sfx.forEach((e, i) => { ins.push("-i", join(dir, e.file)); const ms = Math.round(e.at * 1000); fl.push(`[${i}:a]adelay=${ms}|${ms},volume=${e.vol}[s${i}]`); });
    fl.push(`${ae.sfx.map((_, i) => `[s${i}]`).join("")}amix=inputs=${ae.sfx.length}:normalize=0,apad=whole_dur=${ae.duration},atrim=0:${ae.duration}[o]`);
    run("ffmpeg", ["-y", "-v", "error", ...ins, "-filter_complex", fl.join(";"), "-map", "[o]", "-ar", "48000", "-ac", "2", join(outDir, "audio", "sfx.wav")]);
  }
  // originals and logos for re-cutting, the subtitles
  for (const d of ["footage", "logos"]) {
    const a = join(dir, "assets", d);
    if (!existsSync(a)) continue;
    const files = readdirSync(a).filter((f) => !f.startsWith("."));
    if (!files.length) continue;
    mkdirSync(join(outDir, d), { recursive: true });
    // subfolders (footage/team20, footage/wall) are copied whole
    for (const f of files) statSync(join(a, f)).isDirectory() ? cpSync(join(a, f), join(outDir, d, f), { recursive: true }) : copyFileSync(join(a, f), join(outDir, d, f));
  }
  const srt = join(dir, "out", `${slug}.en.srt`);
  if (existsSync(srt)) copyFileSync(srt, join(outDir, `${slug}.en.srt`));

  // text layers for the script
  const layers = texts.map((t, i) => {
    const count = t.tag === "B" ? ae.counts[t.id] : null;
    return {
      name: `${String(i + 1).padStart(2, "0")} ${t.lines.join(" ").slice(0, 40)}`,
      text: t.lines.join("\r"), ps: psFor(t.family, t.weight, t.text), family: t.family === "AWS Sans" ? (/[\u0E00-\u0E7F]/.test(t.text) ? "IBM Plex Sans Thai" : "Inter") : t.family, size: Math.round(t.size * 10) / 10,
      color: rgb(t.color), align: t.align === "center" ? "center" : t.align === "right" || t.align === "end" ? "right" : "left",
      tracking: Math.round((t.tracking / t.size) * 1000), leading: t.lines.length > 1 ? Math.round(t.lh || t.size * 1.15) : 0,
      x: Math.round(t.x), y: Math.round(t.y), w: Math.round(t.w), h: Math.round(t.h),
      in: Math.round(t.first * 30) / 30, out: Math.min(ae.duration, Math.round((t.last + 0.1) * 30) / 30),
      count: count ? { at: count.at, d: count.d, to: count.to } : null,
    };
  });
  const D = { slug, width: ae.width, height: ae.height, fps: ae.fps, duration: ae.duration, scenes: ae.scenes, texts: layers,
    files: { plate: "plate.mov", gfx: "graphics.mov", music: readdirSync(join(outDir, "audio")).find((f) => f.startsWith("music")) ?? null, sfx: existsSync(join(outDir, "audio", "sfx.wav")) ? "sfx.wav" : null, vo: existsSync(join(outDir, "audio", "vo.wav")) ? "vo.wav" : null } };
  writeFileSync(join(outDir, `${slug}.jsx`), JSX(D));
  writeFileSync(join(outDir, "README.md"), README(D));
  console.log(`✔ ${outDir}\n  ${layers.length} text layer, ${ae.scenes.length} marker adegan${skipRender ? " (render dilewati)" : ""}`);
  return { outDir, layers };
}

const JSX = (D) => `// ${D.slug}: After Effects rebuild of the TERTORTOR AWS film (tools/aws-ae.mjs). File > Scripts > Run Script File.
// Keep this script in the same folder as plate.mov, graphics.mov, audio/, footage/.
(function () {
  var D = ${jsLit(D)};
  var root = File($.fileName).parent;
  if (!app.project) app.newProject();
  var proj = app.project;
  app.beginUndoGroup("AWS " + D.slug);
  var bin = proj.items.addFolder(D.slug);
  function imp(rel, folder) {
    var f = new File(root.fsName + "/" + rel);
    if (!f.exists) return null;
    var it = proj.importFile(new ImportOptions(f));
    it.parentFolder = folder || bin;
    return it;
  }
  var comp = proj.items.addComp(D.slug, D.width, D.height, 1, D.duration, D.fps);
  comp.parentFolder = bin;
  comp.bgColor = [0.027, 0.043, 0.078];

  // audio stems
  if (D.files.vo) { var v = imp("audio/" + D.files.vo); if (v) { var vl = comp.layers.add(v); vl.name = "VO"; } }
  if (D.files.music) { var m = imp("audio/" + D.files.music); if (m) { var ml = comp.layers.add(m); ml.name = "Music"; } }
  if (D.files.sfx) { var s = imp("audio/" + D.files.sfx); if (s) { var sl = comp.layers.add(s); sl.name = "SFX"; } }
  // pictures: graded footage plate, graphics on alpha above it
  var plate = imp(D.files.plate); if (plate) { var pl = comp.layers.add(plate); pl.name = "Footage plate (graded)"; }
  var gfx = imp(D.files.gfx); if (gfx) { var gl = comp.layers.add(gfx); gl.name = "Graphics (alpha, no text)"; }

  // editable text: Thai lines, English lines, numbers (count-up by expression)
  var missing = {};
  for (var i = 0; i < D.texts.length; i++) {
    var T = D.texts[i];
    var L = comp.layers.addText(T.text);
    L.name = T.name;
    var st = L.property("ADBE Text Properties").property("ADBE Text Document");
    var doc = st.value;
    doc.resetCharStyle();
    doc.resetParagraphStyle();
    try { doc.font = T.ps; } catch (e) { missing[T.family] = 1; }
    if (doc.font !== T.ps) missing[T.family] = 1;
    doc.fontSize = T.size;
    doc.applyFill = true; doc.fillColor = T.color; doc.applyStroke = false;
    doc.tracking = T.tracking;
    doc.justification = T.align === "center" ? ParagraphJustification.CENTER_JUSTIFY : T.align === "right" ? ParagraphJustification.RIGHT_JUSTIFY : ParagraphJustification.LEFT_JUSTIFY;
    if (T.leading) { doc.autoLeading = false; doc.leading = T.leading; }
    st.setValue(doc);
    if (T.count) st.expression = "var t0=" + T.count.at + ",d=" + T.count.d + ",to=" + T.count.to + ";var p=Math.min(1,Math.max(0,(time-t0)/d));p=1-Math.pow(1-p,3);Math.round(to*p).toString().replace(/\\\\B(?=(\\\\d{3})+(?!\\\\d))/g,\\",\\")";
    L.inPoint = T["in"]; L.outPoint = T.out;
    // glyph box measured in the browser -> anchor on the same corner of AE's text box
    var r = L.sourceRectAtTime(Math.max(T["in"], T.out - 0.05), false);
    var ax = T.align === "center" ? r.left + r.width / 2 : T.align === "right" ? r.left + r.width : r.left;
    var px = T.align === "center" ? T.x + T.w / 2 : T.align === "right" ? T.x + T.w : T.x;
    var tr = L.property("ADBE Transform Group");
    tr.property("ADBE Anchor Point").setValue([ax, r.top]);
    var pos = tr.property("ADBE Position");
    pos.setValueAtTime(T["in"], [px, T.y + 24]);
    pos.setValueAtTime(Math.min(T.out, T["in"] + 0.4), [px, T.y]);
    var op = tr.property("ADBE Opacity");
    op.setValueAtTime(T["in"], 0);
    op.setValueAtTime(Math.min(T.out, T["in"] + 0.3), 100);
    if (T.out < D.duration - 0.05) { op.setValueAtTime(Math.max(T["in"] + 0.31, T.out - 0.2), 100); op.setValueAtTime(T.out, 0); }
    for (var k = 1; k <= pos.numKeys; k++) pos.setInterpolationTypeAtKey(k, KeyframeInterpolationType.BEZIER);
  }

  // scene markers
  for (var j = 0; j < D.scenes.length; j++) comp.markerProperty.setValueAtTime(D.scenes[j].start, new MarkerValue(D.scenes[j].id + " · " + D.scenes[j].label));

  // the original clips and logos, for re-cutting
  var ob = proj.items.addFolder(D.slug + " originals");
  var dirs = ["footage", "logos"];
  for (var d = 0; d < dirs.length; d++) {
    var fd = new Folder(root.fsName + "/" + dirs[d]);
    if (!fd.exists) continue;
    var fs = fd.getFiles();
    for (var q = 0; q < fs.length; q++) if (fs[q] instanceof File) { try { var it = proj.importFile(new ImportOptions(fs[q])); it.parentFolder = ob; } catch (e) {} }
  }
  comp.openInViewer();
  app.endUndoGroup();
  var miss = []; for (var f in missing) miss.push(f);
  alert(D.slug + ": " + D.texts.length + " text layer siap diedit." + (miss.length ? "\\nFont belum terpasang: " + miss.join(", ") + " (lihat README.md)" : ""));
})();
`;

const README = (D) => `# ${D.slug}: paket After Effects

Dibuat oleh \`node tools/aws-ae.mjs ${D.slug}\` dari film TERTORTOR (HyperFrames). ${D.width}×${D.height}, ${D.fps} fps, ${D.duration} s.

## Cara buka
1. Pasang font (gratis, lisensi OFL) dari Google Fonts: **Inter** (Light, Bold), **IBM Plex Sans Thai** (Light, Bold),
   **JetBrains Mono** (Medium). Inter adalah pengganti Amazon Ember; bila punya Ember dari brand kit AWS, ganti font teks Latin ke Ember.
2. After Effects → File → Scripts → Run Script File → \`${D.slug}.jsx\` (biarkan di folder ini).
3. Komposisi \`${D.slug}\` terbuka: marker per adegan, lalu dari bawah ke atas:
   - **Music**, **SFX**: stem audio (\`audio/\`). Musik sementara bisa diganti lagu berlisensi.
   - **Footage plate (graded)**: footage asli yang sudah di-grade + gradasi gelap di belakang teks (\`plate.mov\`, ProRes 422 HQ).
   - **Graphics (alpha, no text)**: semua grafis (batang funnel, titik, papan Top 20, chip, garis timeline, kotak logo) di atas
     alpha (\`graphics.mov\`, ProRes 4444), tanpa huruf.
   - **${D.texts.length} text layer**: setiap baris Thai, terjemahan Inggris, dan angka, di posisi dan waktu yang sama dengan
     video. Angka naik lewat expression di Source Text (ubah \`to=\` untuk mengganti angkanya).
4. Klip asli dan logo ada di bin \`${D.slug} originals\` untuk dipotong ulang. Subtitle: \`${D.slug}.en.srt\`.

## Catatan
- Grafis yang ukurannya ikut angka (lebar batang funnel, jumlah titik) dibakar di \`graphics.mov\`: kalau angka berubah,
  isi angkanya di \`aws.json\` lalu ekspor paket lagi, bukan diedit manual di AE.
- Posisi teks diukur di browser; selisih 1-3 px dari render MP4 wajar karena mesin teks AE berbeda.
`;

if (process.argv[1]?.endsWith("aws-ae.mjs")) {
  const slug = process.argv[2];
  if (!slug) die("pakai: node tools/aws-ae.mjs <slug> [--skip-render]");
  const keep = setInterval(() => {}, 1000); // the long page.evaluate must not let the event loop drain
  try { await exportAE(slug, { skipRender: process.argv.includes("--skip-render") }); } finally { clearInterval(keep); }
}
