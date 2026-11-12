// Channel watermark (user 2026-11-07): one logo per channel / preset / product, uploaded in TERTORTOR on that sub's page
// and stored as <subDir>/logo.png. Every video of that sub carries it top-left, from the first frame to the last.
//   - the logo is copied into the video (assets/brand/logo.png) so the project renders on its own
//   - meta.json → watermark: false turns it off for one video
//   - size and place: brand.json → watermark { left, top, width, opacity } (top sits just under the 168 px status band)
// cues.mjs and ad.mjs write it into index.html between <!--@watermark--> markers; finish.mjs refreshes it before render,
// so a logo uploaded or switched off after the last build still lands in the next render.
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, statSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { loadBrand, readJSON } from "./lib.mjs";
import { placeOf, subDir } from "./categories.mjs";

export const logoFile = (category, sub) => join(subDir(category, sub), "logo.png");

// the logo of the sub this video belongs to, or null (none uploaded, or switched off for this video)
export function channelLogo(dir) {
  const meta = existsSync(join(dir, "meta.json")) ? readJSON(join(dir, "meta.json")) : {};
  if (meta.watermark === false) return null;
  const { category, sub } = placeOf(dir);
  const f = sub ? logoFile(category, sub) : null;
  return f && existsSync(f) ? f : null;
}

// any image the user uploads -> a PNG with its alpha kept (ffmpeg reads png/jpg/webp/gif); a JPG has no alpha, so a
// near-white background is keyed out the way ad.mjs does for product logos
export function saveLogo(category, sub, srcFile) {
  const dest = logoFile(category, sub);
  mkdirSync(join(dest, ".."), { recursive: true });
  const jpg = /\.jpe?g$/i.test(srcFile);
  const vf = `scale='min(800,iw)':-2${jpg ? ",format=rgba,colorkey=0xFFFFFF:0.12:0.08" : ",format=rgba"}`;
  const r = spawnSync("ffmpeg", ["-y", "-v", "error", "-i", srcFile, "-vf", vf, "-frames:v", "1", dest], { encoding: "utf8" });
  if (r.status !== 0 || !existsSync(dest)) throw new Error(`Logo tidak bisa dibaca (${(r.stderr || "").trim().slice(0, 120) || "format?"}). Pakai PNG, JPG, atau WebP.`);
  return dest;
}
export function removeLogo(category, sub) {
  rmSync(logoFile(category, sub), { force: true });
}

// the overlay block for index.html ("" = no watermark)
export function watermarkBlock(dir, total) {
  const src = channelLogo(dir);
  if (!src) return "";
  const own = join(dir, "assets", "brand", "logo.png");
  mkdirSync(join(own, ".."), { recursive: true });
  if (!existsSync(own) || statSync(own).mtimeMs < statSync(src).mtimeMs || statSync(own).size !== statSync(src).size) copyFileSync(src, own);
  const sp = join(dir, "sources.txt");
  if (!(existsSync(sp) && readFileSync(sp, "utf8").includes("assets/brand/logo.png"))) appendFileSync(sp, `assets/brand/logo.png\tlogo channel (unggahan user di TERTORTOR), watermark kiri atas\n`);
  // a tall logo (Musafo calligraphy, user 2026-11-12) is fitted inside width × maxHeight so it never reaches the headline
  const w = { left: 56, top: 184, width: 150, maxHeight: 150, opacity: 0.9, ...(loadBrand(dir).watermark ?? {}) };
  return `<div id="watermark" class="clip" data-start="0" data-duration="${total}" data-track-index="8" data-width="${loadBrand(dir).frame.w}" data-height="${loadBrand(dir).frame.h}" style="z-index:60;pointer-events:none">
        <img id="watermark-img" src="assets/brand/logo.png" alt="" style="position:absolute;left:${w.left}px;top:${w.top}px;width:${w.width}px;height:${w.maxHeight}px;object-fit:contain;object-position:left top;opacity:${w.opacity};filter:drop-shadow(0 2px 8px rgba(0,0,0,.55))">
      </div>`;
}

// put (or replace, or remove) the block in an index.html string
export function applyWatermark(dir, html, total) {
  const block = watermarkBlock(dir, total);
  const wrapped = block ? `<!--@watermark-->\n      ${block}\n      <!--@watermark-end-->` : "<!--@watermark--><!--@watermark-end-->";
  if (/<!--@watermark-->[\s\S]*?<!--@watermark-end-->/.test(html)) return html.replace(/<!--@watermark-->[\s\S]*?<!--@watermark-end-->/, () => wrapped);
  if (!block) return html;
  // first time: right before the captions host (or the sfx block / the voice, whichever the index has)
  for (const re of [/(\s*)<div id="captions"/, /(\s*)<!--@sfx-->/, /(\s*)<audio id="voice"/]) if (re.test(html)) return html.replace(re, (m, ws) => `${ws}${wrapped}${m}`);
  return html.replace(/(\s*)<\/div>\s*<script>/, (m, ws) => `${ws}  ${wrapped}${m}`);
}

// finish.mjs: refresh the block in the video's index.html using the root's own duration
export function refreshWatermark(dir) {
  const p = join(dir, "index.html");
  if (!existsSync(p)) return false;
  const html = readFileSync(p, "utf8");
  const total = html.match(/id="root"[^>]*data-duration="([\d.]+)"/)?.[1];
  if (!total) return false;
  const out = applyWatermark(dir, html, total);
  if (out !== html) writeFileSync(p, out);
  return !!channelLogo(dir);
}
