// variant.mjs: "Ubah format" (user 2026-11-13). The user ticks the ratios they need under the video in Studio; only those
// are made. Each ratio becomes its own project, videos/<slug>-<kind>/ (4x5, 1x1, 16x9, 9x16), a copy of the original's
// script, voice, music, assets and scenes with meta.json "format" set to the new frame. Nothing is cropped or blurred:
// Studio sends the event `format-new` and Claude remakes the pictures for the new ratio (calm areas where logos, headline
// and footer sit), the clips, and the layout of every scene, then renders (CLAUDE.md § Ubah format).
//   node tools/variant.mjs <slug> <4x5|1x1|16x9|9x16>
import { cpSync, existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { ROOT, FRAMES, VARIANT_KINDS, frameOf } from "./lib.mjs";

const VIDEOS = join(ROOT, "videos");
export const KIND_LABEL = { "4x5": "4:5", "1x1": "1:1", "16x9": "16:9", "9x16": "9:16" };
// results and per-video publishing state belong to the original only
const SKIP = new Set(["out", "build", ".preview", "share.json", "buffer.json", "caption.md"]);
const readJSON = (f, d = {}) => { try { return JSON.parse(readFileSync(f, "utf8")); } catch { return d; } };

export const variantSlug = (slug, kind) => `${slug}-${kind}`;
// variants already made from a video: [{ kind, slug }]
export function variantsOf(slug) {
  return Object.keys(VARIANT_KINDS).map((kind) => ({ kind, label: KIND_LABEL[kind], slug: variantSlug(slug, kind) }))
    .filter((v) => existsSync(join(VIDEOS, v.slug, "meta.json")) && readJSON(join(VIDEOS, v.slug, "meta.json")).variantOf === slug);
}

export function createVariant(slug, kind) {
  const src = join(VIDEOS, slug);
  if (!existsSync(join(src, "meta.json"))) throw new Error(`video ${slug} tidak ada`);
  const meta = readJSON(join(src, "meta.json"));
  if (meta.variantOf) throw new Error("Ini sudah versi format lain: ubah format dari video aslinya.");
  const fmt = VARIANT_KINDS[kind];
  if (!fmt) throw new Error(`format tidak dikenal: ${kind}`);
  const from = frameOf(src), to = FRAMES[fmt];
  if (from.format === to.format) throw new Error(`Video ini sudah ${KIND_LABEL[kind]}.`);
  const out = variantSlug(slug, kind), dst = join(VIDEOS, out);
  if (existsSync(dst)) throw new Error(`Versi ${KIND_LABEL[kind]} sudah ada: ${out}`);

  cpSync(src, dst, { recursive: true, filter: (p) => { const r = relative(src, p); return !r || !SKIP.has(r.split(sep)[0]); } });

  writeFileSync(join(dst, "meta.json"), JSON.stringify({ ...meta, id: out, name: `${meta.name ?? slug} (${KIND_LABEL[kind]})`, format: fmt, variantOf: slug, variantKind: kind }, null, 2));
  const req = readJSON(join(dst, "request.json"), null);
  if (req) writeFileSync(join(dst, "request.json"), JSON.stringify({ ...req, title: `${req.title ?? meta.name ?? slug} (${KIND_LABEL[kind]})`, variantOf: slug, created: new Date().toISOString(), status: `menunggu Claude: ubah format ke ${KIND_LABEL[kind]}` }, null, 2));

  // frame size in the HTML: index.html (page, root, every host) and the root of every scene; the layout inside the
  // scenes is Claude's job (event format-new), these numbers only make the canvas the right size
  const swap = (s) => s
    .replace(/data-resolution="\w+"/g, `data-resolution="${to.resolution}"`)
    .replaceAll(`width=${from.w}, height=${from.h}`, `width=${to.w}, height=${to.h}`)
    .replaceAll(`width: ${from.w}px; height: ${from.h}px`, `width: ${to.w}px; height: ${to.h}px`)
    .replaceAll(`data-width="${from.w}" data-height="${from.h}"`, `data-width="${to.w}" data-height="${to.h}"`);
  const idx = join(dst, "index.html");
  if (existsSync(idx)) writeFileSync(idx, swap(readFileSync(idx, "utf8")));
  const comp = join(dst, "compositions");
  if (existsSync(comp)) for (const f of readdirSync(comp).filter((x) => x.endsWith(".html"))) writeFileSync(join(comp, f), swap(readFileSync(join(comp, f), "utf8")));

  writeFileSync(join(dst, "FORMAT.md"), `# Versi ${KIND_LABEL[kind]} dari \`${slug}\`

Dibuat dari tombol "Ubah format" di Studio (${new Date().toISOString().slice(0, 10)}). Bingkai: ${to.w}×${to.h}.
Disalin dari video asli: naskah, suara, musik, aset, dan scene. Ukuran kanvas sudah ${to.w}×${to.h}, tapi isi scene masih
tata letak ${from.w}×${from.h}.

Yang harus dibuat ulang (CLAUDE.md § Ubah format):
- Gambar/key visual dibuat ulang di rasio ${KIND_LABEL[kind]}, bukan dipotong atau diberi latar blur, dengan area tenang
  (langit/lantai/latar polos) di tempat logo, judul, dan footer.
- Klip dari gambar baru (Flow), lalu potongan orang/penutup per frame bila scene memakainya.
- Tata letak tiap scene untuk ${to.w}×${to.h}, still tiap beat, render, contact sheet.
`);
  return { slug: out, dir: dst, from, to };
}

if (process.argv[1]?.endsWith("variant.mjs")) {
  const [slug, kind] = process.argv.slice(2);
  if (!slug || !kind) { console.error("pakai: node tools/variant.mjs <slug> <4x5|1x1|16x9|9x16>"); process.exit(1); }
  try { const r = createVariant(slug, kind); console.log(`${r.slug}: ${r.from.w}×${r.from.h} → ${r.to.w}×${r.to.h} (videos/${r.slug})`); }
  catch (e) { console.error(e.message); process.exit(1); }
}
