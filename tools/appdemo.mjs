// appdemo.mjs: APP DEMO ads (Advertisement, product "appdemo", user 2026-11-12). No narration, $0: the user's own UI
// screenshots become a demo film in the look of advertisement/appdemo/reference (typed serif headline with an italic
// accent word, a phone, pieces of UI lifting out, stacked cards, a benefit list, the app icon at the end), in BRI blues.
// Every piece of UI on screen is a crop of a real screenshot: nothing is redrawn or generated (CLAUDE.md "Jangan pernah
// memalsukan UI"). The whole film is one composition (compositions/demo.html) written from demo.json.
//
//   node tools/appdemo.mjs build <slug>   demo.json -> compositions/demo.html + index.html + music + fx (typing, pops)
//   node tools/appdemo.mjs check <slug>   build -> rules -> hyperframes check
//   node tools/appdemo.mjs info  <slug>   screenshot sizes (crop rects are in these pixels)
//   then: npm run finish -- <slug> --no-thumbnail
//
// demo.json: { app: "Nama App", icon: "icon-1.png", music: { off, vol }, scenes: [
//   { kind: "phone", head: "Satu Studio Untuk *Semua Video.*", screen: "ui-1.png", dur?, pops: [{ crop: [x,y,w,h], at? }],
//     pose?: "right"|"left"|"front", tilt?: { ry, rx, rz, x, y, s }, pill: { text, at?, y? } },
//   { kind: "orbit", head, screens: ["ui-1.png", "ui-2.png", ...] (2-4), angle?: 45, spin?: 1 },
//   { kind: "stack", head, cards: [{ src, crop }], drop: { src, crop, at? } },
//   { kind: "focus", head, src, crop?, tap: [x,y] (image px), at?, then: "ui-4.png" (state after the tap, same crop) },
//   { kind: "list", head, items: ["..."], foot: "Lebih Banyak *Waktu.*" },
//   { kind: "end", head, name? (default app), icon? } ] }
// Image names are files in assets/products/ (ui-N.png screenshots, icon-1.png). Times ("at") are seconds from the
// scene start. "*word*" = italic accent word with a highlighter swipe. "/" in a headline forces a line break.
// Headlines, list items, pill and foot are set in title case (memory: title-case-text).
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT, readJSON, writeJSON, die, run, videoDir, brandCss, loadBrand } from "./lib.mjs";
import { applyWatermark } from "./brandmark.mjs";
import { renderScore } from "./anim-music.mjs";

const FPS = 30, SR = 44100, W = 1080, H = 1920;
const snap = (t) => Math.round(t * FPS) / FPS;
const r1 = (n) => Math.round(n * 10) / 10;
const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const titleCase = (s = "") => String(s).replace(/(^|[\s\-/(])([*"'“‘]*)(\p{Ll})/gu, (m, a, q, c) => a + q + c.toLocaleUpperCase("id"));
export const isAppDemo = (dir) => { const m = existsSync(join(dir, "meta.json")) ? readJSON(join(dir, "meta.json")) : {}; return m.type === "advertisement" && m.product === "appdemo"; };
export const loadDemo = (dir) => (existsSync(join(dir, "demo.json")) ? readJSON(join(dir, "demo.json")) : null);

// ---------- layout constants (1080x1920, measured from the reference at 1080x2340 and scaled) ----------
const HEAD_BIG = 124, HEAD_LH = 1.08, HEAD_TOP = 200, HEAD_SMALL = 0.6;
const TYPE_STEP = 0.05;                    // seconds per typed character
const PHONE_W = 640, BEZEL = 16, PHONE_X = (W - PHONE_W) / 2;
const CARD_W = 900, CONTENT_BOTTOM = 1700;
const BPM = 96, BEAT = 60 / BPM;
// phone poses (degrees, px, scale): screen turned toward the frame centre, phone pushed to one side and bleeding off it
const POSES = {
  right: { ry: -34, rx: 16, rz: -6, x: 130, y: 30, s: 1.22 },
  left: { ry: 34, rx: 16, rz: 6, x: -130, y: 30, s: 1.22 },
  front: { ry: -8, rx: 10, rz: -2, x: 0, y: 0, s: 1.08 },
};

const imgSize = (file) => {
  const out = run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", file]).stdout.trim();
  const [w, h] = out.split(",").map(Number);
  if (!w || !h) die(`tidak bisa membaca ukuran ${file}`);
  return { w, h };
};

// headline -> lines of tokens; each char its own span so it can be typed. Returns html + the char count.
function headHtml(id, text) {
  const firstWord = [...titleCase(text).replace(/[*]/g, "").split(/[\s/]/)[0]].length;
  const lines = titleCase(text).split(/\s*\/\s*|\n/);
  let n = 0;
  const html = lines.map((line) => {
    const parts = line.split(/(\*[^*]+\*)/).filter(Boolean);
    return `<div class="ln">${parts.map((p) => {
      const acc = /^\*.*\*$/.test(p);
      const chars = [...(acc ? p.slice(1, -1) : p)].map((c) => `<span class="c" data-k="${n++}">${c === " " ? "&nbsp;" : esc(c)}<i class="cr"></i></span>`).join("");
      return acc ? `<em>${chars}<b class="hl"></b></em>` : chars;
    }).join("")}</div>`;
  }).join("");
  return { html: `<div class="head" id="${id}" data-pre="${firstWord}">${html}</div>`, chars: n, pre: firstWord, lines: lines.length };
}

// a crop of a real screenshot as a floating card at width cw: { html, h }
function cropCard(id, cls, dir, src, crop, cw, extra = "") {
  const file = join(dir, "assets", "products", src);
  if (!existsSync(file)) die(`${src} tidak ada di assets/products/`);
  const { w: iw, h: ih } = imgSize(file);
  const [x, y, w, h] = crop ?? [0, 0, iw, ih];
  if (x < 0 || y < 0 || x + w > iw + 1 || y + h > ih + 1) die(`${id}: crop [${crop}] di luar ${src} (${iw}x${ih})`);
  const k = cw / w, ch = r1(h * k);
  return { h: ch, html: `<div class="card ${cls}" id="${id}" style="width:${r1(cw)}px;height:${ch}px;${extra}"><img src="assets/products/${src}" style="width:${r1(iw * k)}px;left:${r1(-x * k)}px;top:${r1(-y * k)}px" alt=""></div>` };
}

export function build(slug) {
  const dir = videoDir(slug);
  if (!isAppDemo(dir)) die(`videos/${slug} bukan proyek App Demo (meta.json type advertisement, product appdemo).`);
  const demo = loadDemo(dir);
  if (!demo?.scenes?.length) die("demo.json belum punya scene.");
  const brand = loadBrand(dir);
  const app = demo.app ?? "";
  let t = 0;
  const dom = [], js = [], fx = { keys: [], pops: [], cuts: [] };
  let phoneCount = 0;
  const scenes = [];
  for (const [i, s0] of demo.scenes.entries()) {
    const s = { ...s0, id: s0.id ?? `s${i + 1}` };
    const id = s.id, start = snap(t);
    const hd = headHtml(`${id}-head`, s.head ?? "");
    const t0 = 0.08, typeEnd = t0 + (hd.chars - hd.pre) * TYPE_STEP;
    const moves = !["end", "orbit"].includes(s.kind);
    const smallScale = s.kind === "list" ? 0.78 : HEAD_SMALL;
    const headH = hd.lines * HEAD_BIG * HEAD_LH;
    const headY0 = s.kind === "end" ? (s.icon ?? demo.icon ? 930 : 820) - headH / 2 : 860 - headH / 2;
    const contentTop = Math.round(HEAD_TOP + headH * smallScale + 56);
    const c0 = moves ? typeEnd + 0.75 : typeEnd + 0.1;     // content starts as the headline moves up
    const parts = [hd.html], tl = [];
    // typing: every character on its own frame, the caret rides on the last one
    tl.push(`type("${id}-head", ${start + t0}, ${TYPE_STEP});`);
    for (let k = 0; k < hd.chars - hd.pre; k++) fx.keys.push(start + t0 + k * TYPE_STEP);
    tl.push(`hl("${id}-head", ${start + typeEnd + 0.05});`);
    const hs = s.kind === "orbit" ? 0.82 : 1;
    tl.push(`gsap.set("#${id}-head", { y: ${r1(headY0 - HEAD_TOP)}, scale: ${hs} }); T.set("#${id}-head", { y: ${r1(headY0 - HEAD_TOP)}, scale: ${hs} }, 0);`);
    if (moves) tl.push(`T.to("#${id}-head", { y: 0, scale: ${smallScale}, duration: 0.6, ease: "power3.inOut" }, ${start + typeEnd + 0.25});`);
    let end = c0 + 1.5;

    if (s.kind === "phone") {
      const file = join(dir, "assets", "products", s.screen ?? "");
      if (!s.screen || !existsSync(file)) die(`${id}: screen "${s.screen}" tidak ada di assets/products/`);
      const { w: iw, h: ih } = imgSize(file);
      const sw = PHONE_W - 2 * BEZEL, k = sw / iw, sh = ih * k;
      const top = contentTop + 24;
      // the phone is a slab in 3D (acuan reference/phone-motion-ref.mp4, user 2026-11-12): big, turned, bleeding off the
      // frame, the camera never stops; popped UI lifts off the screen in depth instead of flying out flat
      const pose = POSES[s.pose ?? (phoneCount++ % 2 ? "left" : "right")] ?? POSES.right;
      const P = { ...pose, ...(s.tilt ?? {}) };
      const pops = [];
      let popBottom = 0;
      (s.pops ?? []).forEach((p, j) => {
        const [x, y, w, h] = p.crop;
        const at = start + (p.at ?? c0 + 1.4 + j * 1.6);
        const card = cropCard(`${id}-pop${j}`, "pop pz", dir, s.screen, p.crop, w * k, `left:${r1(BEZEL + x * k)}px;top:${r1(BEZEL + y * k)}px`);
        pops.push(card.html);
        const dx = r1((sw / 2 - (x + w / 2) * k) * 0.35);
        if (j === 0) tl.push(`T.to("#${id}-phone .scr", { filter: "blur(4px)", duration: 0.5, ease: "power2.out" }, ${at}); T.to("#${id}-veil", { opacity: 0.32, duration: 0.5 }, ${at});`);
        else tl.push(`T.to("#${id}-pop${j - 1}", { z: 40, opacity: 0, duration: 0.35, ease: "power2.in" }, ${at - 0.1});`);
        tl.push(`T.set("#${id}-pop${j}", { opacity: 1 }, ${at}); T.fromTo("#${id}-pop${j}", { z: 0, x: 0, scale: 1, rotationZ: 0, boxShadow: "0 0 0 rgba(14,33,72,0)" }, { z: 220, x: ${dx}, scale: 1.12, rotationZ: ${P.rz > 0 ? 1.5 : -1.5}, boxShadow: "0 40px 90px rgba(14,33,72,.28)", duration: 0.9, ease: "expo.out", immediateRender: false }, ${at});`);
        fx.pops.push(at + 0.05);
        popBottom = Math.max(popBottom, top + (BEZEL + (y + h) * k) * P.s);
        end = Math.max(end, at - start + 1.5);
      });
      parts.push(`<div class="stage3d"><div class="phone" id="${id}-phone" style="left:${PHONE_X}px;top:${top}px;width:${PHONE_W}px;height:${r1(sh + 2 * BEZEL)}px"><div class="edge"></div><div class="scr"><img src="assets/products/${s.screen}" style="width:${sw}px" alt=""></div><div class="veil" id="${id}-veil"></div>${pops.join("")}</div></div>`);
      tl.push(`T.fromTo("#${id}-phone", { x: ${P.x + Math.sign(P.ry || -1) * -320}, y: 2300, z: -500, rotationY: ${P.ry * 2.2}, rotationX: ${P.rx + 26}, rotationZ: ${P.rz * 2.5}, scale: ${P.s} }, { x: ${P.x}, y: ${P.y}, z: 0, rotationY: ${P.ry}, rotationX: ${P.rx}, rotationZ: ${P.rz}, scale: ${P.s}, duration: 1.2, ease: "expo.out" }, ${start + c0});`);
      end = Math.max(end, c0 + 1.8);
      const pillAt = s.pill?.text ? (s.pill.at ?? end - 0.3) : null;
      if (pillAt != null) end = Math.max(end, pillAt + 1.6);
      // the drift runs through the cut: the camera is still moving when the scene changes
      tl.push(`T.to("#${id}-phone", { x: ${r1(P.x * 0.6)}, y: ${P.y - 50}, rotationY: ${r1(P.ry * 0.55)}, rotationX: ${r1(P.rx * 0.6)}, rotationZ: ${r1(P.rz * 0.4)}, duration: ${r1(end + 0.8 - c0 - 1.2)}, ease: "sine.inOut" }, ${start + c0 + 1.2});`);
      if (s.pill?.text) {
        const at = start + pillAt;
        const py = s.pill.y ?? Math.min(Math.max(top + 560, popBottom + 80), 1560);
        parts.push(`<div class="pill" id="${id}-pill" style="top:${py}px"><span class="dot"></span>${esc(titleCase(s.pill.text))}</div>`);
        tl.push(`T.fromTo("#${id}-pill", { opacity: 0, x: -420, rotation: -7 }, { opacity: 1, x: 0, rotation: -2, duration: 0.7, ease: "expo.out" }, ${at});`);
        fx.pops.push(at + 0.25);
        end = Math.max(end, at - start + 1.6);
      }
    } else if (s.kind === "orbit") {
      // phones in a ring around the centre headline (acuan reference/phone-motion-ref2.mp4): the ring whips in from a
      // close, turned camera, then keeps turning slowly; only the inner halves of the phones are in frame
      const screens = s.screens ?? [];
      if (screens.length < 2) die(`${id}: orbit butuh minimal 2 screens`);
      const n = screens.length, PW = 560, sw = PW - 2 * BEZEL;
      const phones = screens.map((src, j) => {
        const file = join(dir, "assets", "products", src);
        if (!existsSync(file)) die(`${id}: ${src} tidak ada`);
        const { w: iw, h: ih } = imgSize(file);
        const ph = Math.min(ih * (sw / iw), sw * 2.2) + 2 * BEZEL, R = ph / 2 + 530;
        const a = (s.angle ?? 45) + (360 / n) * j;
        return `<div class="phone ring-ph" style="left:${-PW / 2}px;top:${r1(-ph / 2)}px;width:${PW}px;height:${r1(ph)}px;transform:rotate(${a}deg) translateY(${r1(-R)}px)"><div class="edge"></div><div class="scr"><img src="assets/products/${src}" style="width:${sw}px" alt=""></div></div>`;
      });
      parts.unshift(`<div class="stage3d"><div class="ring" id="${id}-ring" style="top:${Math.round(headY0 + headH * 0.41)}px">${phones.join("")}</div></div>`);
      const spin = s.spin ?? 1;
      tl.push(`T.fromTo("#${id}-ring", { rotation: ${-50 * spin}, rotationX: 34, scale: 1.75 }, { rotation: 0, rotationX: 16, scale: 0.92, duration: 1.5, ease: "expo.out" }, ${start});`);
      end = typeEnd + 2.4;
      tl.push(`T.to("#${id}-ring", { rotation: ${7 * spin}, rotationX: 10, scale: 0.95, duration: ${r1(end + 0.6 - 1.5)}, ease: "sine.inOut" }, ${start + 1.5});`);
      fx.pops.push(start + 0.1);
    } else if (s.kind === "stack") {
      const cards = s.cards ?? [];
      if (!cards.length) die(`${id}: stack tanpa cards`);
      const built = cards.map((c, j) => cropCard(`${id}-c${j}`, "st", dir, c.src, c.crop, CARD_W));
      const gap = 26, room = CONTENT_BOTTOM - contentTop - (s.drop ? 260 : 0);
      const tot = built.reduce((a, b) => a + b.h, 0) + gap * (built.length - 1);
      const f = Math.min(1, room / tot);
      let y = contentTop + 10;
      built.forEach((b, j) => {
        const c = cards[j], cw = CARD_W * f;
        const card = cropCard(`${id}-c${j}`, "st", dir, c.src, c.crop, cw, `left:${r1((W - cw) / 2)}px;top:${r1(y)}px`);
        parts.push(card.html);
        const at = start + c0 + j * 0.16;
        tl.push(`T.fromTo("#${id}-c${j}", { opacity: 0, x: 300, rotation: 2 }, { opacity: 1, x: 0, rotation: 0, duration: 0.8, ease: "expo.out" }, ${at});`);
        fx.pops.push(at + 0.12);
        y += card.h + gap;
      });
      end = c0 + 0.16 * cards.length + 1.4;
      if (s.drop) {
        const cw = Math.min(CARD_W, 860);
        const at = start + (s.drop.at ?? end - 0.2);
        const card = cropCard(`${id}-drop`, "pop", dir, s.drop.src, s.drop.crop, cw, `left:${r1((W - cw) / 2)}px;top:${r1(Math.min(y + 30, CONTENT_BOTTOM - 120))}px`);
        parts.push(card.html);
        tl.push(`T.fromTo("#${id}-drop", { opacity: 0, y: 220, rotation: 6 }, { opacity: 1, y: 0, rotation: -1.5, duration: 0.8, ease: "back.out(1.4)" }, ${at});`);
        fx.pops.push(at + 0.2);
        end = Math.max(end, at - start + 1.5);
      }
    } else if (s.kind === "focus") {
      const file = join(dir, "assets", "products", s.src ?? "");
      if (!s.src || !existsSync(file)) die(`${id}: src "${s.src}" tidak ada`);
      const { w: iw, h: ih } = imgSize(file);
      const crop = s.crop ?? [0, 0, iw, ih];
      const room = CONTENT_BOTTOM - contentTop - 20;
      const cw = Math.min(s.width ?? CARD_W, room * crop[2] / crop[3]);
      const left = (W - cw) / 2, top = contentTop + 20;
      const a = cropCard(`${id}-f`, "pop", dir, s.src, crop, cw, `left:${r1(left)}px;top:${top}px`);
      parts.push(a.html);
      tl.push(`T.fromTo("#${id}-f", { opacity: 0, y: 120, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 0.85, ease: "expo.out" }, ${start + c0});`);
      fx.pops.push(start + c0 + 0.1);
      end = c0 + 1.8;
      if (s.tap) {
        const k = cw / crop[2];
        const tx = left + (s.tap[0] - crop[0]) * k, ty = top + (s.tap[1] - crop[1]) * k;
        const at = start + (s.at ?? c0 + 1.2);
        parts.push(`<div class="tap" id="${id}-tap" style="left:${r1(tx - 60)}px;top:${r1(ty - 60)}px"></div>`);
        tl.push(`T.fromTo("#${id}-tap", { opacity: 0, scale: 0.4 }, { opacity: 0.9, scale: 0.8, duration: 0.18, ease: "power2.out" }, ${at}); T.to("#${id}-tap", { opacity: 0, scale: 1.7, duration: 0.5, ease: "power2.out" }, ${at + 0.18});`);
        tl.push(`T.to("#${id}-f", { scale: 0.975, duration: 0.12, ease: "power2.out" }, ${at + 0.05}); T.to("#${id}-f", { scale: 1, duration: 0.4, ease: "back.out(2)" }, ${at + 0.17});`);
        fx.pops.push(at + 0.05);
        if (s.then) {
          const b = cropCard(`${id}-g`, "pop flat", dir, s.then, crop, cw, `left:${r1(left)}px;top:${top}px`);
          parts.push(b.html);
          tl.push(`T.fromTo("#${id}-g", { opacity: 0 }, { opacity: 1, duration: 0.25, ease: "power1.out" }, ${at + 0.2});`);
        }
        end = Math.max(end, at - start + 1.6);
      }
    } else if (s.kind === "list") {
      const items = s.items ?? [];
      let y = contentTop + 30;
      items.forEach((it, j) => {
        parts.push(`<div class="row" id="${id}-r${j}" style="top:${y}px"><span class="ck" id="${id}-k${j}"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></span>${esc(titleCase(it))}</div>`);
        const at = start + c0 + j * 0.34;
        tl.push(`T.fromTo("#${id}-r${j}", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.55, ease: "expo.out" }, ${at}); T.fromTo("#${id}-k${j}", { scale: 0 }, { scale: 1, duration: 0.45, ease: "back.out(2.6)" }, ${at + 0.18});`);
        fx.pops.push(at + 0.2);
        y += 118;
      });
      end = c0 + 0.34 * items.length + 1.0;
      if (s.foot) {
        const fh = headHtml(`${id}-foot`, s.foot);
        parts.push(fh.html.replace('class="head"', `class="head foot" style="top:${Math.min(y + 70, 1560)}px"`));
        const ft = start + end - 0.2;
        tl.push(`type("${id}-foot", ${ft}, ${TYPE_STEP}); hl("${id}-foot", ${ft + (fh.chars - fh.pre) * TYPE_STEP + 0.05});`);
        for (let k = 0; k < fh.chars - fh.pre; k++) fx.keys.push(ft + k * TYPE_STEP);
        end += fh.chars * TYPE_STEP + 2.6;
      }
    } else if (s.kind === "end") {
      const icon = s.icon ?? demo.icon;
      if (icon) {
        if (!existsSync(join(dir, "assets", "products", icon))) die(`${id}: icon ${icon} tidak ada`);
        parts.push(`<div class="icon" id="${id}-icon"><img src="assets/products/${icon}" alt=""></div>`);
        tl.push(`T.fromTo("#${id}-icon", { opacity: 0, scale: 0.6, y: 40 }, { opacity: 1, scale: 1, y: 0, duration: 0.8, ease: "back.out(1.7)" }, ${start + 0.05});`);
        fx.pops.push(start + 0.15);
      }
      const name = s.name ?? app;
      if (name) {
        parts.push(`<div class="name" id="${id}-name" style="top:${Math.round(headY0 + headH + 40)}px">${esc(name)}</div>`);
        tl.push(`T.fromTo("#${id}-name", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, ${start + typeEnd + 0.4});`);
      }
      end = typeEnd + 2.4;
    } else die(`${id}: kind "${s.kind}" tidak dikenal (phone|orbit|stack|focus|list|end)`);

    // scene length: given, or the content plus a breath, rounded up to whole beats so every cut lands on the grid
    const dur = snap(s.dur ?? Math.ceil(end / BEAT) * BEAT);
    dom.push(`<section class="scene" id="${id}">\n${parts.join("\n")}\n</section>`);
    js.push(`// ${id} · ${s.kind} · ${start.toFixed(2)}-${(start + dur).toFixed(2)}\nT.set("#${id}", { opacity: 1 }, ${start}); T.set("#${id}", { opacity: 0 }, ${snap(start + dur)});\n${tl.join("\n")}`);
    if (i > 0) fx.cuts.push(start);
    scenes.push({ id, kind: s.kind, head: s.head, start, duration: dur });
    t = start + dur;
  }
  const total = snap(t);
  if (total > 179) die(`durasi ${total} s > 179 s`);

  // ---------- composition ----------
  mkdirSync(join(dir, "compositions"), { recursive: true });
  const comp = `<template>
  <!-- App Demo (generated by tools/appdemo.mjs from demo.json, do not edit by hand: change demo.json and build again).
       Every UI piece is a crop of the user's own screenshot (assets/products/ui-*.png). -->
  <div id="root" data-composition-id="demo" data-width="1080" data-height="1920">
  <style>
    #root { position: absolute; inset: 0; overflow: hidden; background: linear-gradient(180deg, #FFFFFF 0%, var(--ground) 45%, var(--mist) 100%); font-family: var(--font-body); color: var(--ink); }
    .blob { position: absolute; border-radius: 50%; filter: blur(90px); }
    #b1 { left: -260px; top: -200px; width: 760px; height: 620px; background: var(--haze); opacity: .55; }
    #b2 { right: -300px; top: 760px; width: 720px; height: 720px; background: var(--sky); opacity: .8; }
    #b3 { left: -200px; bottom: -260px; width: 820px; height: 620px; background: var(--haze); opacity: .45; }
    .scene { position: absolute; inset: 0; opacity: 0; }
    .head { position: absolute; left: 40px; right: 40px; top: ${HEAD_TOP}px; text-align: center; font: 500 ${HEAD_BIG}px/${HEAD_LH} var(--font-display); letter-spacing: -0.025em; color: var(--ink); transform-origin: 50% 0; }
    .head .ln { white-space: nowrap; }
    .head .c { position: relative; opacity: 0; }
    .head .cr { position: absolute; right: -0.06em; top: 0.12em; width: 0.06em; height: 0.9em; background: var(--accent); opacity: 0; }
    .head em { position: relative; display: inline-block; font-style: italic; font-weight: 600; color: var(--accent); padding: 0 0.04em; }
    .head .hl { position: absolute; left: -0.02em; right: -0.02em; bottom: 0.1em; height: 0.24em; background: var(--sky); z-index: -1; transform-origin: 0 50%; transform: scaleX(0); border-radius: 0.05em; }
    .head.foot { font-size: 64px; top: 0; transform: none; }
    .stage3d { position: absolute; inset: 0; perspective: 2300px; perspective-origin: 50% 35%; transform-style: preserve-3d; }
    .phone { position: absolute; background: var(--bezel); border-radius: 92px; padding: ${BEZEL}px; transform-style: preserve-3d; transform-origin: 50% 28%; box-shadow: 0 60px 120px rgba(14,33,72,.28), inset 0 0 0 3px #2A3A5C; }
    .phone .edge { position: absolute; inset: 0; border-radius: 92px; background: linear-gradient(135deg, var(--deep), var(--bezel)); transform: translateZ(-28px); }
    .card.pz { transform-origin: 50% 50%; border-radius: 22px; }
    .ring { position: absolute; left: 540px; top: 960px; width: 0; height: 0; transform-style: preserve-3d; }
    .ring .phone { transform-origin: 50% 50%; }
    .head { z-index: 5; }
    .phone .scr { position: relative; width: 100%; height: 100%; border-radius: 76px; overflow: hidden; background: #fff; }
    .phone .scr img { position: absolute; left: 0; top: 0; display: block; }
    .phone .veil { position: absolute; inset: ${BEZEL}px; border-radius: 76px; background: var(--ground); opacity: 0; }
    .card { position: absolute; overflow: hidden; background: var(--card); border-radius: 30px; transform-origin: 0 0; box-shadow: 0 2px 6px rgba(14,33,72,.05), 0 24px 60px rgba(14,33,72,.13); }
    .card.st, .card.pop { transform-origin: 50% 50%; }
    .card.lift { transform-origin: 0 0; }
    .card.flat { box-shadow: none; }
    .card img { position: absolute; display: block; max-width: none; }
    .pop { opacity: 0; }
    .pill { position: absolute; left: 90px; display: inline-flex; align-items: center; gap: 22px; padding: 26px 44px 26px 30px; border-radius: 999px; background: var(--deep); color: #fff; font: 600 40px/1 var(--font-body); letter-spacing: -0.01em; white-space: nowrap; box-shadow: 0 24px 60px rgba(11,61,145,.35); opacity: 0; }
    .pill .dot { width: 22px; height: 22px; border-radius: 50%; background: #fff; box-shadow: 0 0 0 8px color-mix(in srgb, #fff 25%, transparent); }
    .tap { position: absolute; width: 120px; height: 120px; border-radius: 50%; border: 6px solid var(--accent); background: color-mix(in srgb, var(--accent) 18%, transparent); opacity: 0; }
    .row { position: absolute; left: 110px; right: 110px; height: 96px; display: flex; align-items: center; gap: 26px; padding: 0 34px; border-radius: 26px; background: var(--card); font: 500 38px/1 var(--font-body); color: var(--ink); letter-spacing: -0.01em; white-space: nowrap; box-shadow: 0 2px 6px rgba(14,33,72,.05), 0 18px 40px rgba(14,33,72,.09); opacity: 0; }
    .ck { flex: 0 0 auto; width: 50px; height: 50px; border-radius: 15px; background: var(--accent); color: #fff; display: grid; place-items: center; }
    .ck svg { width: 34px; height: 34px; }
    .icon { position: absolute; left: 430px; top: 470px; width: 220px; height: 220px; border-radius: 54px; background: var(--card); overflow: hidden; display: grid; place-items: center; box-shadow: 0 30px 70px rgba(14,33,72,.2); opacity: 0; }
    .icon img { width: 100%; height: 100%; object-fit: cover; }
    .name { position: absolute; left: 0; right: 0; text-align: center; font: 600 42px/1 var(--font-body); color: var(--muted); letter-spacing: -0.01em; opacity: 0; }
  </style>
  <div class="blob" id="b1"></div><div class="blob" id="b2"></div><div class="blob" id="b3"></div>
${dom.join("\n")}
  <script>
    (() => {
    const T = gsap.timeline({ paused: true });
    // typed headline: one character per step, the caret sits on the newest one and blinks twice when typing stops
    const type = (id, at, step) => {
      const cs = [...document.querySelectorAll("#" + id + " .c")];
      const pre = +(document.getElementById(id).dataset.pre || 0), t0 = at - 0.08;
      const when = (k) => (k < pre ? t0 : at + (k - pre) * step);
      cs.forEach((c, k) => {
        T.set(c, { opacity: 1 }, when(k));
        const cr = c.querySelector(".cr");
        T.set(cr, { opacity: 1 }, when(k));
        if (k < cs.length - 1) T.set(cr, { opacity: 0 }, when(k + 1));
      });
      const last = cs.at(-1)?.querySelector(".cr"), e = at + (cs.length - pre) * step;
      if (last) [0.25, 0.5, 0.75].forEach((d, j) => T.set(last, { opacity: j % 2 ? 1 : 0 }, e + d));
    };
    const hl = (id, at) => document.querySelectorAll("#" + id + " .hl").forEach((h) => T.to(h, { scaleX: 1, duration: 0.45, ease: "power2.out" }, at));
    // background blobs drift the whole film
    T.fromTo("#b1", { x: 0, y: 0 }, { x: 120, y: 90, duration: ${total}, ease: "sine.inOut" }, 0);
    T.fromTo("#b2", { x: 0, y: 0 }, { x: -140, y: -160, duration: ${total}, ease: "sine.inOut" }, 0);
    T.fromTo("#b3", { x: 0, y: 0 }, { x: 160, y: -60, duration: ${total}, ease: "sine.inOut" }, 0);
${js.join("\n")}
    T.set({}, {}, ${total});
    window.__timelines = window.__timelines || {};
    window.__timelines["demo"] = T;
    })();
  </script>
  </div>
</template>
`;
  writeFileSync(join(dir, "compositions", "demo.html"), comp);

  // ---------- fonts (presets/appdemo/fonts -> assets/fonts) ----------
  for (const ff of brand.fontFaces ?? []) {
    const m = /^assets\/fonts\/([^/]+)$/.exec(ff.src ?? "");
    if (!m || existsSync(join(dir, ff.src))) continue;
    mkdirSync(join(dir, "assets", "fonts"), { recursive: true });
    copyFileSync(join(ROOT, "presets", brand.preset, "fonts", m[1]), join(dir, ff.src));
  }

  // ---------- audio: music (anim-music, preset.json music), fx.wav (typing + pops), whoosh tags at cuts ----------
  const tags = [], lines = [];
  mkdirSync(join(dir, "assets", "sfx"), { recursive: true });
  if (!demo.music?.off) {
    const music = { ...readJSON(join(ROOT, "presets", "appdemo", "preset.json")).music, ...(demo.music ?? {}) };
    renderScore([{ start: 0, dur: total, music, seed: demo.music?.seed ?? 21 }], total, join(dir, "assets", "music.wav"));
    tags.push(`<audio id="music" src="assets/music.wav" data-start="0" data-duration="${total}" data-volume="${demo.music?.vol ?? 0.7}" data-track-index="10"></audio>`);
    lines.push("assets/music.wav\tdikomposisi dari matematika oleh tools/anim-music.mjs (seeded), bebas lisensi, $0");
  }
  writeFx(join(dir, "assets", "sfx", "fx.wav"), total, fx);
  tags.push(`<audio id="fx" src="assets/sfx/fx.wav" data-start="0" data-duration="${total}" data-volume="0.9" data-track-index="11"></audio>`);
  lines.push("assets/sfx/fx.wav\tklik ketik + pop kartu, disintesis oleh tools/appdemo.mjs, bebas lisensi");
  if (fx.cuts.length) {
    copyFileSync(join(ROOT, "library", "sfx", "whoosh.wav"), join(dir, "assets", "sfx", "whoosh.wav"));
    fx.cuts.forEach((c, i) => tags.push(`<audio id="sfx-${i}" src="assets/sfx/whoosh.wav" data-start="${Math.max(0, c - 0.16).toFixed(3)}" data-duration="0.42" data-volume="0.12" data-track-index="${12 + (i % 2)}"></audio>`));
    lines.push("assets/sfx/whoosh.wav\tkit SFX library/sfx (dibuat dari matematika), bebas lisensi");
  }

  // ---------- index.html ----------
  const idxPath = join(dir, "index.html");
  let html = readFileSync(idxPath, "utf8").replace(/\/\*@brand\*\/[\s\S]*?\/\*@end\*\//, () => brandCss(brand));
  const host = `<div id="demo" class="clip" data-composition-id="demo" data-composition-src="compositions/demo.html" data-start="0" data-duration="${total}" data-track-index="0" data-track-kind="graphics" data-width="1080" data-height="1920"></div>`;
  html = html.replace(/<!--@beats-->[\s\S]*?<!--@beats-end-->/, () => `<!--@beats-->\n      ${host}\n      <!--@beats-end-->`);
  html = html.replace(/(<div id="root"[^>]*\bdata-duration=")[^"]*"/, (_, a) => `${a}${total}"`);
  html = html.replace(/<!--@sfx-->[\s\S]*?<!--@sfx-end-->/, () => `<!--@sfx-->\n      ${tags.join("\n      ")}\n      <!--@sfx-end-->`);
  html = applyWatermark(dir, html, total);
  writeFileSync(idxPath, html);

  // ---------- sources.txt: every screenshot used, plus the generated audio ----------
  const used = new Set();
  for (const s of demo.scenes) for (const f of [...(s.screens ?? []), s.screen, s.src, s.then, s.icon, s.drop?.src, ...(s.cards ?? []).map((c) => c.src)]) if (f) used.add(f);
  if (demo.icon) used.add(demo.icon);
  const srcFile = join(dir, "sources.txt");
  const have = existsSync(srcFile) ? readFileSync(srcFile, "utf8").split(/\r?\n/).filter(Boolean) : [];
  const keep = have.filter((l) => !/^assets\/(music\.wav|sfx\/)/.test(l));
  const fresh = [...used].filter((f) => !keep.some((l) => l.startsWith(`assets/products/${f}\t`))).map((f) => `assets/products/${f}\tscreenshot/ikon asli aplikasi, diunggah user (pemilik aplikasi) di Studio; dipotong, tidak digambar ulang`);
  writeFileSync(srcFile, [...keep, ...fresh, ...lines].join("\n") + "\n");
  writeJSON(join(dir, "build", "timeline.json"), { duration: total, beats: scenes.map(({ id, kind, head, start, duration }) => ({ id, start, duration, register: kind, hero: head ?? kind, framing: kind, job: head ?? id, character: false, marks: {} })) });
  console.log(`✔ ${scenes.length} scene, total ${total.toFixed(2)} s`);
  for (const s of scenes) console.log(`  ${s.start.toFixed(2).padStart(6)}  ${s.duration.toFixed(2).padStart(5)}s  ${s.id.padEnd(4)} ${s.kind.padEnd(6)} ${s.head ?? ""}`);
  return { dir, demo, scenes, total };
}

// typing clicks (soft, a little different each) and a low pop when a card lands; one file, mixed under the music
function writeFx(out, total, { keys, pops }) {
  const N = Math.ceil(total * SR), L = new Float32Array(N);
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  const add = (t0, len, fn, g) => { const s0 = Math.round(t0 * SR); for (let i = 0; i < len * SR; i++) { const k = s0 + i; if (k >= 0 && k < N) L[k] += fn(i / SR) * g; } };
  for (const t of keys) {
    const f = 2600 + 700 * rnd(), g = 0.16 + 0.05 * rnd();
    let lp = 0;
    add(t, 0.03, (x) => { lp += 0.35 * (rnd() - lp); return (lp * 0.8 + 0.5 * Math.sin(2 * Math.PI * f * x)) * Math.exp(-x * 260); }, g);
  }
  for (const t of pops) add(t, 0.18, (x) => Math.sin(2 * Math.PI * (180 * x + 260 * (1 - Math.exp(-x * 40)) / 40)) * Math.exp(-x * 26), 0.34);
  const buf = Buffer.alloc(44 + N * 4);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(N * 4, 40);
  for (let k = 0; k < N; k++) { const v = Math.round(Math.max(-1, Math.min(1, Math.tanh(L[k]))) * 32767); buf.writeInt16LE(v, 44 + k * 4); buf.writeInt16LE(v, 46 + k * 4); }
  writeFileSync(out, buf);
}

export function lint(slug) {
  const { scenes, total, demo, dir } = build(slug);
  const errors = [], warns = [];
  if (scenes[0]?.kind === "end") errors.push("scene pertama tidak boleh logo/penutup (hook dulu)");
  if (scenes.at(-1)?.kind !== "end") warns.push("tanpa scene penutup (kind end)");
  if (!scenes.some((s) => ["phone", "orbit", "focus", "stack"].includes(s.kind))) errors.push("tidak ada screenshot UI yang tampil");
  scenes.forEach((s, i) => {
    if (!s.head) errors.push(`${s.id}: tanpa headline`);
    else if (s.head.replace(/[*/]/g, "").length > 38) warns.push(`${s.id}: headline ${s.head.length} karakter, terlalu panjang untuk diketik (≤ 38)`);
    if (s.head && !/\*[^*]+\*/.test(s.head)) warns.push(`${s.id}: headline tanpa *kata aksen*`);
    if (s.duration > 7) warns.push(`${s.id}: ${s.duration.toFixed(2)} s, lebih dari 7 s di satu adegan`);
    const p = scenes[i - 1];
    if (p && p.kind === s.kind && p.kind !== "stack") warns.push(`${s.id}: kind ${s.kind} sama dengan ${p.id}`);
  });
  for (const s of demo.scenes) for (const l of [s.head, s.foot, s.pill?.text, ...(s.items ?? [])].filter(Boolean)) if (/\d/.test(l)) warns.push(`angka di "${l}": pastikan sesuai klaim pemilik aplikasi`);
  if (total < 8) warns.push(`total ${total} s, sangat pendek`);
  for (const w of warns) console.log(`⚠ ${w}`);
  for (const e of errors) console.log(`✖ ${e}`);
  return { errors, warns, dir };
}

if (process.argv[1]?.endsWith("appdemo.mjs")) {
  const [cmd, slug] = process.argv.slice(2);
  if (!slug) die("Usage: node tools/appdemo.mjs build|check|info <slug>");
  if (cmd === "build") build(slug);
  else if (cmd === "info") {
    const pd = join(videoDir(slug), "assets", "products");
    for (const f of existsSync(pd) ? readdirSync(pd).filter((f) => /.(png|jpe?g|webp)$/i.test(f)) : []) { const { w, h } = imgSize(join(pd, f)); console.log(`${f.padEnd(16)} ${w}x${h}`); }
  } else if (cmd === "check") {
    const { errors, dir } = lint(slug);
    if (errors.length) process.exit(1);
    const r = spawnSync("npx", ["hyperframes", "check", dir], { stdio: "inherit", shell: process.platform === "win32" });
    if (r.status !== 0) process.exit(1);
    console.log("\n✔ all gates passed");
  } else die("Usage: node tools/appdemo.mjs build|check|info <slug>");
}
