// TERTORTOR groups projects by style: category -> sub. Nothing is stored per video that was not there already, so old
// projects need no migration: the category is read from meta.json → type, the sub from preset / channel / product.
//   explainer      (no type)                        sub = preset   (presets/<id>, draft presets shown as "belum didesain")
//   storytelling   (type berakitkehulu | bumidipijak)     sub = channel  (musafo/library/channels.json; a channel's type = project type)
//   advertisement  (type advertisement)              sub = product  (advertisement/products.json)
//   cinematic      (type cinematic / cinestory)      sub = look     (cinematic/looks.json; AWS: recap film with data motion graphics;
//                                                                  other looks: narrated 9:16 story, type cinestory, channel = look)
//
// A new sub made in TERTORTOR ("+ Tambah") is a draft with the user's brief: name, workflow, visual style, references.
// It lives in subDir(): presets/<id>/ (explainer), musafo/channels/<id>/ (storytelling), advertisement/<id>/
// (advertisement), as brief.md + reference/. Claude designs it from that brief and removes "draft"; until then it
// cannot make a project.
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, statSync, readdirSync, copyFileSync } from "node:fs";
import { join, relative } from "node:path";
import { ROOT, readJSON, writeJSON, listPresets, presetOf } from "./lib.mjs";
import { STORY_TYPES } from "./musafo.mjs";
import { listChannels, CHANNELS } from "./stories.mjs";

const PRODUCTS = join(ROOT, "advertisement", "products.json");
export const listProducts = () => (existsSync(PRODUCTS) ? readJSON(PRODUCTS) : []);
const LOOKS = join(ROOT, "cinematic", "looks.json");
export const listLooks = () => (existsSync(LOOKS) ? readJSON(LOOKS) : []);

export const CATEGORIES = [
  { id: "explainer", label: "Video Explainer", subKind: "preset", subLabel: "Preset", desc: "Motion graphic yang mengajarkan langkah: naskah lisan, beat, scene HyperFrames." },
  { id: "storytelling", label: "Storytelling", subKind: "channel", subLabel: "Channel", desc: "Kisah lisan per shot: storyline, satu gambar + satu klip per shot, caption dua bahasa. Berakit ke Hulu dan BumiDiPijak." },
  { id: "advertisement", label: "Advertisement", subKind: "product", subLabel: "Product", desc: "Video iklan produk." },
  { id: "cinematic", label: "Cinematic", subKind: "look", subLabel: "Gaya", desc: "AWS: film rekap sinematik dengan visualisasi data. Gaya lain: video cerita bernarasi 9:16, alurnya seperti Berakit ke Hulu." },
];

const SUB_ROOT = { explainer: "presets", storytelling: join("musafo", "channels"), advertisement: "advertisement", cinematic: "cinematic" };
export const subDir = (category, id) => join(ROOT, SUB_ROOT[category], id);
const rel = (p) => relative(ROOT, p).replace(/\\/g, "/");
const briefOf = (category, id) => (existsSync(join(subDir(category, id), "brief.md")) ? readFileSync(join(subDir(category, id), "brief.md"), "utf8") : "");

// the tree TERTORTOR draws: every category with its subs (draft = placeholder that cannot make a project yet)
// A new Cinematic look (user 2026-11-22): every look except AWS is a narrated 9:16 story made like Berakit ke Hulu
// (project type cinestory, the look is its channel). Starting point: the Storytelling preset (captions), a style.md with
// the workflow, and a looks.json entry with engine "story". The project agent designs the look from cinematic/<id>/brief.md.
export function makeStoryLook(id, label, description = "") {
  const base = join(ROOT, "presets", "musafo"), own = join(ROOT, "presets", id), dir = subDir("cinematic", id);
  mkdirSync(own, { recursive: true });
  mkdirSync(dir, { recursive: true });
  writeJSON(join(own, "preset.json"), { ...readJSON(join(base, "preset.json")), id, type: "cinestory", label, description: `${description || label} (gaya Cinematic cerita; sesuaikan dari cinematic/${id}/brief.md)`, base: "musafo" });
  if (existsSync(join(base, "style.md"))) copyFileSync(join(base, "style.md"), join(own, "style.md"));
  const style = join(dir, "style.md");
  if (!existsSync(style)) writeFileSync(style, `# ${label} (Cinematic, alur cerita)

> Alur kerja: skill \`/cinestory\` (seperti Berakit ke Hulu): storyline → naskah bernarasi → tokoh → Production (suara + key
> visual) → klip → persetujuan musik → editing, vertikal 9:16. Bagian di bawah = GAYA gaya ini; isi dari \`brief.md\` dan
> \`reference/\`, lalu hapus \`draft\` di cinematic/looks.json.

## Gaya gambar (key visual dan klip)
- styleAnchor (kalimat gaya yang ditempel di akhir setiap prompt gambar): _belum diisi_
- Palet, cahaya, lensa, tekstur: _belum diisi_

## Tokoh
- Siapa saja, usia, pakaian khas: _belum diisi_

## Narasi dan caption
- Suara (speaker Gemini TTS) dan gaya bicara: _belum diisi_
- Caption: preset \`presets/${id}\` (turunan presets/musafo)

## Musik
- Suasana: _belum diisi_ (mood dasar \`cinestory\` di tools/story-music.mjs, atau lagu dari user di tab Musik)

## Hindari
- _belum diisi_
`);
  const looks = listLooks().filter((l) => l.id !== id);
  const prev = listLooks().find((l) => l.id === id) ?? {};
  writeJSON(LOOKS, [...looks, { ...prev, id, label, draft: prev.draft ?? true, base: "musafo", engine: "story", narration: true, format: { width: 1080, height: 1920, aspect: "9:16", fps: 30, formats: ["vertical"] }, description: description || prev.description || label }]);
}

export function structure() {
  const presets = listPresets({ drafts: true }).filter((p) => !p.type).map(({ id, label, description, colors, fonts, tones, draft, formats, oneTake }) => ({ id, label, description, colors, fonts, tones: tones ?? [], formats: formats ?? ["vertical"], oneTake: !!oneTake, draft: !!draft })).sort((a, b) => a.draft - b.draft);
  const channels = listChannels().map((c) => ({ id: c.id, label: c.label, description: c.description, type: c.type ?? "musafo", draft: !!c.draft }));
  const products = listProducts().map(({ id, label, description, draft, form }) => ({ id, label, description, form: form ?? "photos", draft: !!draft }));
  // Cinematic: AWS = alur AWS; gaya lain = alur cerita cinestory (user 2026-11-22); "styled: false" = gaya visual belum didesain
  // sampai Antigravity menyesuaikannya dari brief
  // gaya cerita (engine "story", user 2026-11-22): alur seperti Berakit ke Hulu, proyek jenis cinestory
  const looks = listLooks().map(({ id, label, description, draft, engine }) => ({ id, label, engine: engine === "story" ? "story" : "aws", description: draft ? (engine === "story" ? "Alur cerita seperti Berakit ke Hulu (narasi, 9:16). Gaya visual belum didesain dari brief." : "Alur kerja AWS. Gaya visual masih AWS sampai disesuaikan dari brief.") : description, draft: false, styled: !draft }));
  const subs = { explainer: presets, storytelling: channels, advertisement: products, cinematic: looks };
  // logo: the watermark of every video in that sub (tools/brandmark.mjs), as a cache-busting version number
  const logo = (cat, id) => { const f = join(subDir(cat, id), "logo.png"); return existsSync(f) ? Math.round(statSync(f).mtimeMs) : null; };
  // cover: a still of the style from one of its own videos (tools/sub-covers.mjs), shown before the user picks it
  const cover = (cat, id) => { const f = join(subDir(cat, id), "cover.jpg"); return existsSync(f) ? Math.round(statSync(f).mtimeMs) : null; };
  return CATEGORIES.map((c) => ({ ...c, subs: subs[c.id].map((s) => ({ ...s, dir: rel(subDir(c.id, s.id)), brief: briefOf(c.id, s.id), logo: logo(c.id, s.id), cover: cover(c.id, s.id) })) }));
}

// where one project sits in that tree
export function placeOf(dir) {
  const meta = existsSync(join(dir, "meta.json")) ? JSON.parse(readFileSync(join(dir, "meta.json"), "utf8")) : {};
  if (meta.type === "cinestory") return { category: "cinematic", sub: meta.channel ?? null };
  if (STORY_TYPES[meta.type]) return { category: "storytelling", sub: meta.channel ?? meta.type };
  if (meta.type === "advertisement") return { category: "advertisement", sub: meta.product ?? null };
  if (meta.type === "cinematic") return { category: "cinematic", sub: meta.look ?? null };
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
  // gaya Cinematic mendapat presets/<id>/ sendiri: jangan menimpa preset lain yang namanya sama
  if (category === "cinematic" && existsSync(join(ROOT, "presets", id))) throw new Error(`Nama "${label}" sudah dipakai preset lain. Pakai nama lain.`);
  description = String(description).trim().slice(0, 200) || "Belum didesain. Brief dari user ada di brief.md.";
  mkdirSync(join(dir, "reference"), { recursive: true });
  const design = { explainer: "preset (preset.json, style.md, scenes/)", storytelling: "channel (aturan, gaya gambar, prompt Library Cerita; tipe proyek sendiri bila alurnya beda dari Musafo)", advertisement: "product (alur, gaya, alat)", cinematic: "gaya cerita: alurnya sudah alur /cinestory (seperti Berakit ke Hulu: storyline, naskah bernarasi, tokoh, key visual, klip, persetujuan musik, editing 9:16); desain gaya gambar, styleAnchor, tokoh, suara, dan musik di cinematic/<id>/style.md, presets/<id>/ (caption), dan blok brand.json → <id>" }[category];
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
    if (category === "cinematic") makeStoryLook(id, label, description);
  } catch (e) {
    rmSync(dir, { recursive: true, force: true });
    if (category === "cinematic") rmSync(join(ROOT, "presets", id), { recursive: true, force: true });
    throw new Error(`Gagal menyimpan: ${e.message}`);
  }
  return { category, id, label, dir: rel(dir) };
}
