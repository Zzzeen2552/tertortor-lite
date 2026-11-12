// Real photos, clips and audio of a specific place, object or event from Wikimedia Commons (free API, no key) instead
// of an AI version. Only public domain, CC0 and CC BY are allowed (BY-SA, NC, ND are refused); every file used gets a
// credit line in sources.txt and credits.md (paste into the post caption / description).
//   npm run commons -- search "<query>" [--type image|video|audio] [--limit 15]
//   npm run commons -- use <slug> <beat> "File:<title>" [--start s] [--dur s]
//     image/audio -> videos/<slug>/assets/commons/<beat>.<ext>; video -> normalised to assets/footage/<beat>.mp4
import { existsSync, mkdirSync, writeFileSync, readFileSync, appendFileSync } from "node:fs";
import { join, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, die } from "./lib.mjs";
import { prepFootage } from "./prep-footage.mjs";

const API = "https://commons.wikimedia.org/w/api.php";
const UA = "MOTION-TERTORTOR/1.0 (local video tool; Wikimedia Commons API)"; // Wikimedia asks every client for a UA
const META = "LicenseShortName|License|LicenseUrl|Artist|Credit|AttributionRequired|ImageDescription|ObjectName";

// public domain / CC0 / CC BY (any version). Share-alike, non-commercial and no-derivatives are not allowed.
export const allowed = (license = "") => {
  const l = license.toLowerCase().trim();
  if (/\b(sa|nc|nd)\b|-sa-|-nc-|-nd-|-sa$|-nc$|-nd$/.test(l)) return false;
  return /^(pd|cc0|cc-zero|public domain)/.test(l) || /^cc-by(-\d|$)/.test(l);
};
const clean = (html = "") => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

async function api(params) {
  const r = await fetch(`${API}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`, { headers: { "user-agent": UA } });
  if (!r.ok) die(`Commons API ${r.status}`);
  return r.json();
}
const info = (p) => {
  const i = p.imageinfo?.[0] ?? {};
  const m = i.extmetadata ?? {};
  return {
    title: p.title, mime: i.mime, width: i.width, height: i.height, size: i.size, duration: i.duration,
    url: i.url, thumb: i.thumburl, page: i.descriptionurl,
    license: m.License?.value ?? "", licenseName: m.LicenseShortName?.value ?? "?", licenseUrl: m.LicenseUrl?.value ?? "",
    artist: clean(m.Artist?.value) || clean(m.Credit?.value) || "unknown author",
  };
};

export async function search(query, { type = "image", limit = 15 } = {}) {
  const ft = { image: "filetype:bitmap", video: "filetype:video", audio: "filetype:audio" }[type] ?? "";
  const j = await api({ action: "query", generator: "search", gsrnamespace: "6", gsrsearch: `${query} ${ft}`.trim(), gsrlimit: String(Math.min(50, limit * 3)), prop: "imageinfo", iiprop: "url|mime|size|extmetadata", iiextmetadatafilter: META, iiurlwidth: "1080" });
  const all = (j.query?.pages ?? []).sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).map(info);
  return { ok: all.filter((f) => allowed(f.license)).slice(0, limit), rejected: all.filter((f) => !allowed(f.license)).length };
}

export async function use(slug, beat, title, { start = 0, dur, width = 2160 } = {}) {
  const dir = join(ROOT, "videos", slug);
  if (!existsSync(dir)) die(`videos/${slug} not found`);
  const j = await api({ action: "query", titles: title.startsWith("File:") ? title : `File:${title}`, prop: "imageinfo", iiprop: "url|mime|size|extmetadata", iiextmetadatafilter: META, iiurlwidth: String(width) });
  const p = j.query?.pages?.[0];
  if (!p || p.missing) die(`not on Commons: ${title}`);
  const f = info(p);
  if (!allowed(f.license)) die(`${f.title}: license ${f.licenseName} is not allowed (only public domain, CC0, CC BY)`);
  const kind = f.mime?.split("/")[0];
  // big stills come down as a 2160 px rendition (--width for a map or chart the camera zooms into); video/audio as the original file
  const src = kind === "image" && f.size > 25e6 && f.thumb ? f.thumb : f.url;
  const r = await fetch(src, { headers: { "user-agent": UA } });
  if (!r.ok) die(`download failed ${r.status}: ${src}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const ext = extname(new URL(src).pathname).toLowerCase() || ".bin";
  let rel;
  if (kind === "video") {
    mkdirSync(join(dir, "build"), { recursive: true });
    const raw = join(dir, "build", `commons-${beat}${ext}`);
    writeFileSync(raw, buf);
    mkdirSync(join(dir, "assets", "footage"), { recursive: true });
    rel = `assets/footage/${beat}.mp4`;
    prepFootage(raw, join(dir, rel), { start, dur });
  } else {
    mkdirSync(join(dir, "assets", "commons"), { recursive: true });
    rel = `assets/commons/${beat}${ext}`;
    writeFileSync(join(dir, rel), buf);
  }
  const changed = kind === "video" ? "cropped to 9:16, trimmed, sound removed" : "cropped/scaled for 9:16";
  const credit = `"${f.title.replace(/^File:/, "").replace(/\.[^.]+$/, "")}" by ${f.artist}, ${f.licenseName}${f.licenseUrl ? ` (${f.licenseUrl})` : ""}, via Wikimedia Commons${/^cc-by/.test(f.license.toLowerCase()) ? `; ${changed}` : ""}`;
  // one provenance line per file (re-using a beat replaces its line)
  const sp = join(dir, "sources.txt");
  const keep = (existsSync(sp) ? readFileSync(sp, "utf8") : "").split(/\r?\n/).filter((l) => l && !l.startsWith(rel + "\t"));
  writeFileSync(sp, [...keep, `${rel}\tWikimedia Commons: ${credit}. ${f.page}`].join("\n") + "\n");
  const cp = join(dir, "credits.md");
  if (!existsSync(cp)) writeFileSync(cp, "# Kredit (tempel ke caption/deskripsi posting)\n\n");
  if (!readFileSync(cp, "utf8").includes(f.page)) appendFileSync(cp, `- ${credit}. ${f.page}\n`);
  return { rel, credit, kind, file: f };
}

async function cli() {
  const argv = process.argv.slice(2);
  const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv.splice(i, 2)[1] : d; };
  const type = opt("type", "image"), limit = +opt("limit", 15), start = +opt("start", 0), durS = opt("dur"), width = +opt("width", 2160);
  const [cmd, a, b, c] = argv;
  if (cmd === "search" && a) {
    const { ok, rejected } = await search(a, { type, limit });
    if (!ok.length) console.log("  (tidak ada file PD/CC0/CC BY; coba kata kunci lain atau --type)");
    ok.forEach((f, i) => console.log(`${String(i + 1).padStart(2)}. ${f.title}\n    ${f.licenseName} · ${f.width}×${f.height}${f.duration ? ` · ${f.duration.toFixed(1)}s` : ""} · ${f.artist.slice(0, 60)}\n    ${f.page}`));
    if (rejected) console.log(`  (${rejected} hasil lain disembunyikan: lisensi BY-SA/NC/ND/lain)`);
    return;
  }
  if (cmd === "use" && a && b && c) {
    const r = await use(a, b, c, { start, dur: durS ? +durS : undefined, width });
    return console.log(`✔ ${r.rel}\n  kredit: ${r.credit}`);
  }
  die('Usage: npm run commons -- search "<query>" [--type image|video|audio] [--limit n]  |  use <slug> <beat> "File:<title>" [--start s] [--dur s] [--width px]');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await cli();
