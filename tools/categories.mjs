// TERTORTOR groups projects by style: category -> sub. Nothing is stored per video that was not there already, so old
// projects need no migration: the category is read from meta.json → type, the sub from preset / channel / product.
//   explainer      (no type)                        sub = preset   (presets/<id>, draft presets shown as "belum didesain")
//   storytelling   (type berakitkehulu | bumidipijak)     sub = channel  (musafo/library/channels.json; a channel's type = project type)
//   advertisement  (type advertisement)              sub = product  (advertisement/products.json)
//
// A new sub made in TERTORTOR ("+ Tambah") is a draft with the user's brief: name, workflow, visual style, references.
// It lives in subDir(): presets/<id>/ (explainer), musafo/channels/<id>/ (storytelling), advertisement/<id>/
// (advertisement), as brief.md + reference/. Claude designs it from that brief and removes "draft"; until then it
// cannot make a project.
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { ROOT, readJSON, writeJSON, listPresets, presetOf } from "./lib.mjs";
import { STORY_TYPES } from "./musafo.mjs";
import { listChannels, CHANNELS } from "./stories.mjs";

const PRODUCTS = join(ROOT, "advertisement", "products.json");
export const listProducts = () => (existsSync(PRODUCTS) ? readJSON(PRODUCTS) : []);

export const CATEGORIES = [
  { id: "explainer", label: "Video Explainer", subKind: "preset", subLabel: "Preset", desc: "Motion graphic yang mengajarkan langkah: naskah lisan, beat, scene HyperFrames." },
  { id: "storytelling", label: "Storytelling", subKind: "channel", subLabel: "Channel", desc: "Kisah lisan per shot: storyline, satu gambar + satu klip per shot, caption dua bahasa. Berakit ke Hulu dan BumiDiPijak." },
  { id: "advertisement", label: "Advertisement", subKind: "product", subLabel: "Product", desc: "Video iklan produk." },
];

const SUB_ROOT = { explainer: "presets", storytelling: join("musafo", "channels"), advertisement: "advertisement" };
export const subDir = (category, id) => join(ROOT, SUB_ROOT[category], id);
const rel = (p) => relative(ROOT, p).replace(/\\/g, "/");
const briefOf = (category, id) => (existsSync(join(subDir(category, id), "brief.md")) ? readFileSync(join(subDir(category, id), "brief.md"), "utf8") : "");

// the tree TERTORTOR draws: every category with its subs (draft = placeholder that cannot make a project yet)
export function structure() {
  const presets = listPresets({ drafts: true }).filter((p) => !p.type).map(({ id, label, description, colors, fonts, tones, draft, formats, oneTake }) => ({ id, label, description, colors, fonts, tones: tones ?? [], formats: formats ?? ["vertical"], oneTake: !!oneTake, draft: !!draft })).sort((a, b) => a.draft - b.draft);
  const channels = listChannels().map((c) => ({ id: c.id, label: c.label, description: c.description, type: c.type ?? "musafo", draft: !!c.draft }));
  const products = listProducts().map(({ id, label, description, draft, form }) => ({ id, label, description, form: form ?? "photos", draft: !!draft }));
  const subs = { explainer: presets, storytelling: channels, advertisement: products };
  // logo: the watermark of every video in that sub (tools/brandmark.mjs), as a cache-busting version number
  const logo = (cat, id) => { const f = join(subDir(cat, id), "logo.png"); return existsSync(f) ? Math.round(statSync(f).mtimeMs) : null; };
  // cover: a still of the style from one of its own videos (tools/sub-covers.mjs), shown before the user picks it
  const cover = (cat, id) => { const f = join(subDir(cat, id), "cover.jpg"); return existsSync(f) ? Math.round(statSync(f).mtimeMs) : null; };
  return CATEGORIES.map((c) => ({ ...c, subs: subs[c.id].map((s) => ({ ...s, dir: rel(subDir(c.id, s.id)), brief: briefOf(c.id, s.id), logo: logo(c.id, s.id), cover: cover(c.id, s.id) })) }));
}

// where one project sits in that tree
export function placeOf(dir) {
  const meta = existsSync(join(dir, "meta.json")) ? JSON.parse(readFileSync(join(dir, "meta.json"), "utf8")) : {};
  if (STORY_TYPES[meta.type]) return { category: "storytelling", sub: meta.channel ?? meta.type };
  if (meta.type === "advertisement") return { category: "advertisement", sub: meta.product ?? null };
  return { category: "explainer", sub: presetOf(dir) };
}

// a library item (footage clip or stock audio): its own place (--for) + the place of every project that used it
export function clipPlaces(clip) {
  const all = [...(clip.category ? [{ category: clip.category, sub: clip.sub }] : [])];
  for (const u of clip.usedIn ?? []) { const s = u.slug ?? u; if (existsSync(join(ROOT, "videos", s))) all.push(placeOf(join(ROOT, "videos", s))); }
  return all.filter((p, i) => all.findIndex((q) => q.category === p.category && q.sub === p.sub) === i);
}

// "+ Tambah" in TERTORTOR: a new preset / channel / product as a draft, with the user's brief for Claude.
// Channel ids have no dashes (same as stories.mjs addChannel); preset and product ids are kebab-case.
export function addSub(category, { label, description = "", workflow = "", visual = "", refLink = "" }) {
  const cat = CATEGORIES.find((c) => c.id === category);
  if (!cat) throw new Error("kategori tidak dikenal");
  label = String(label ?? "").trim().slice(0, 60);
  const id = label.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, category === "storytelling" ? "" : "-").replace(/^-|-$/g, "").slice(0, 40);
  if (!label || !id) throw new Error("Nama wajib diisi.");
  workflow = String(workflow).trim(); visual = String(visual).trim();
  if (!workflow && !visual) throw new Error("Isi workflow atau visual style untuk brief agent.");
  const dir = subDir(category, id);
  if (structure().find((c) => c.id === category).subs.some((s) => s.id === id) || existsSync(dir)) throw new Error(`"${label}" sudah ada.`);
  description = String(description).trim().slice(0, 200) || "Belum didesain. Brief dari user ada di brief.md.";
  mkdirSync(join(dir, "reference"), { recursive: true });
  const design = { explainer: "preset (preset.json, style.md, scenes/)", storytelling: "channel (aturan, gaya gambar, prompt Library Cerita; tipe proyek sendiri bila alurnya beda dari Musafo)", advertisement: "product (alur, gaya, alat)" }[category];
  const links = String(refLink).trim().split(/\s+/).filter(Boolean);
  writeFileSync(join(dir, "brief.md"), `# Brief ${cat.subLabel.toLowerCase()} baru: ${label}

> Dibuat dari TERTORTOR ${new Date().toISOString().slice(0, 10)} di kategori ${cat.label}. Status: **belum didesain** (draft).
> Claude: baca brief ini dan acuan di \`${rel(dir)}/reference/\` (video: \`npm run ref\` + \`/reverse-video-v2\`), tanya user
> yang belum jelas, lalu rancang ${design} dan hapus \`draft\`. Jangan mengarang gaya yang tidak ada di brief atau acuan.

## Deskripsi singkat

${description}

## Workflow (dari user, jangan diubah)

${workflow || "(kosong)"}

## Visual style (dari user, jangan diubah)

${visual || "(kosong)"}

## Acuan

${links.length ? links.map((l) => `- ${l}`).join("\n") : "- (belum ada link)"}
- File: \`reference/\`
`);
  // the registry last: if it cannot be written, the half-made folder goes too, so the name stays free
  try {
    if (category === "explainer") writeJSON(join(dir, "preset.json"), { id, label, draft: true, description });
    if (category === "storytelling") writeJSON(CHANNELS, [...listChannels(), { id, label, draft: true, description }]);
    if (category === "advertisement") writeJSON(PRODUCTS, [...listProducts(), { id, label, draft: true, description }]);
  } catch (e) {
    rmSync(dir, { recursive: true, force: true });
    throw new Error(`Gagal menyimpan: ${e.message}`);
  }
  return { category, id, label, dir: rel(dir) };
}
