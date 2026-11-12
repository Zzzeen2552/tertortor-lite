// Style covers (user 2026-11-12): every preset / channel / product / look / style gets <subDir>/cover.jpg, a still from
// one of its own finished videos, so "Buat video" shows what the style looks like before the user picks it.
// Source, best first: the three newest renders of real projects in that sub, else of uji projects, else a key
// visual / shot image of a project. Never third-party reference media (that stays study-only and out of git).
// Five frames between 20 % and 80 % of the render are tried and the most detailed one wins, cropped to 9:16 (16:9 renders
// sit whole over a blurred fill).
//
//   node tools/sub-covers.mjs            make the covers that are missing
//   node tools/sub-covers.mjs --force    remake all of them (after a better video exists)
//   node tools/sub-covers.mjs <sub> …    remake only these subs
import { existsSync, readdirSync, statSync, readFileSync, rmSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT, probeDuration } from "./lib.mjs";
import { structure, placeOf, subDir } from "./categories.mjs";

const VIDEOS = join(ROOT, "videos");
export const coverFile = (category, id) => join(subDir(category, id), "cover.jpg");
const IMG = /\.(png|jpe?g|webp)$/i;
const size = "scale=540:960:force_original_aspect_ratio=increase,crop=540:960";

// an animation whose shots switch style (the ten-style showcase) does not show one style
function mixed(d) {
  const f = join(d, "animation.json");
  if (!existsSync(f)) return false;
  try { return new Set((JSON.parse(readFileSync(f, "utf8")).shots ?? []).map((x) => x.style).filter(Boolean)).size > 1; } catch { return false; }
}
// the projects of every sub: { "<category>/<sub>": [dir, …] }
function projects() {
  const out = {};
  for (const s of existsSync(VIDEOS) ? readdirSync(VIDEOS) : []) {
    const d = join(VIDEOS, s);
    if (s.startsWith(".") || !statSync(d).isDirectory() || !existsSync(join(d, "meta.json"))) continue;
    if (mixed(d)) continue;
    try { const { category, sub } = placeOf(d); (out[`${category}/${sub}`] ??= []).push({ slug: s, dir: d }); } catch {}
  }
  return out;
}
const renderOf = ({ slug, dir }) => [join(dir, "out", "raw.mp4"), join(dir, "out", `${slug}.mp4`)].find((f) => existsSync(f) && statSync(f).size > 1e5);
function imageOf({ dir }) {
  for (const sub of ["assets/keyvisuals", "assets/shots", "assets/images", "assets/frames"]) {
    const d = join(dir, sub);
    if (!existsSync(d)) continue;
    const f = readdirSync(d).filter((x) => IMG.test(x)).sort()[0];
    if (f) return join(d, f);
  }
  return null;
}
const mtime = (f) => statSync(f).mtimeMs;

export function makeCover(category, id, list = projects()[`${category}/${id}`] ?? []) {
  const real = list.filter((p) => !p.slug.startsWith("uji-")), uji = list.filter((p) => p.slug.startsWith("uji-"));
  // the three newest renders (real projects first; uji only when the sub has no real render yet)
  const renders = (ps) => ps.map((p) => ({ p, f: renderOf(p) })).filter((x) => x.f).sort((a, b) => mtime(b.f) - mtime(a.f)).slice(0, 3);
  const rs = renders(real).length ? renders(real) : renders(uji);
  const out = coverFile(category, id);
  let args;
  if (rs.length) {
    // five candidate frames between 20 % and 80 % of each; the one with the most detail wins (JPEG size is a fair
    // proxy: a fade, a dark transition or an empty text card compresses small)
    let best = null, n = 0;
    const tmps = [];
    for (const r of rs) {
      const dur = probeDuration(r.f) || 2;
      const [w, h] = (spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", r.f], { encoding: "utf8" }).stdout || "").trim().split(",").map(Number);
      // 16:9 (Cinematic, Docucine horizontal): the whole frame over a blurred fill instead of a centre crop
      const vf = w > h ? "split[a][b];[a]scale=540:960:force_original_aspect_ratio=increase,crop=540:960,boxblur=24:2,eq=brightness=-0.12[bg];[b]scale=540:-2[fg];[bg][fg]overlay=0:(H-h)/2" : size;
      for (const k of [0.2, 0.35, 0.5, 0.65, 0.8]) {
        const tmp = `${out}.${n++}.jpg`;
        tmps.push(tmp);
        spawnSync("ffmpeg", ["-y", "-v", "error", "-ss", Math.max(0.5, dur * k).toFixed(2), "-i", r.f, "-frames:v", "1", "-vf", vf, "-q:v", "4", tmp]);
        if (existsSync(tmp) && (!best || statSync(tmp).size > best.size)) best = { tmp, size: statSync(tmp).size, slug: r.p.slug };
      }
    }
    if (best) copyFileSync(best.tmp, out);
    for (const t of tmps) rmSync(t, { force: true });
    if (!best) throw new Error("tidak ada frame terbaca");
    return { from: `${best.slug} (render)`, file: out };
  } else {
    const img = [...real, ...uji].map(imageOf).find(Boolean);
    if (!img) return null;
    args = ["-y", "-v", "error", "-i", img, "-frames:v", "1", "-vf", size, "-q:v", "4", out];
  }
  const res = spawnSync("ffmpeg", args, { encoding: "utf8" });
  if (res.status !== 0 || !existsSync(out)) throw new Error(`ffmpeg: ${(res.stderr || "").trim().slice(-200)}`);
  return { from: r ? `${r.p.slug} (render)` : "key visual", file: out };
}

if (process.argv[1]?.endsWith("sub-covers.mjs")) {
  const force = process.argv.includes("--force"), only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const all = projects();
  for (const c of structure()) for (const s of c.subs) {
    if (only.length && !only.includes(s.id)) continue;
    if (!force && !only.length && existsSync(coverFile(c.id, s.id))) continue;
    try {
      const r = makeCover(c.id, s.id, all[`${c.id}/${s.id}`] ?? []);
      console.log(`${r ? "✔" : "·"} ${c.id}/${s.id}${r ? `  ← ${r.from}` : "  (belum ada render/gambar)"}`);
    } catch (e) { console.log(`✖ ${c.id}/${s.id}  ${e.message}`); }
  }
}
