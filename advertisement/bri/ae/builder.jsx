// ---- BRI motion KV → After Effects (builder; the data object D is written above this line by ae-export.mjs) ----
// ExtendScript (ES3): no let/const, no arrow functions, no Array.forEach/map, no JSON.
(function () {
  var W = D.W, H = D.H, FPS = D.fps, DUR = D.dur, T = D.T, P = D.P, m = D.m;
  var ROOT = File($.fileName).parent;
  var WARN = [];
  function warn(s) { WARN.push(s); }
  function F(rel) { return new File(ROOT.fsName + "/" + rel); }
  function ACC() { return [m.accent[0], m.accent[1], m.accent[2]]; }
  var YELLOW = [1, 212 / 255, 59 / 255], WHITE = [1, 1, 1];

  if (!app.project) app.newProject();
  var proj = app.project;
  app.beginUndoGroup("BRI " + D.name);
  var FOLDER = proj.items.addFolder(D.name);
  var FA = proj.items.addFolder("Aset");
  FA.parentFolder = FOLDER;
  var FC = proj.items.addFolder("Precomp");
  FC.parentFolder = FOLDER;

  // ---------- import ----------
  var cache = {};
  function imp(rel, seq) {
    var key = rel + (seq ? "#seq" : "");
    if (cache[key]) return cache[key];
    var f = F(rel);
    if (!f.exists) { warn("File tidak ada: " + rel); return null; }
    var io = new ImportOptions(f);
    if (seq) io.sequence = true;
    var it = proj.importFile(io);
    it.parentFolder = FA;
    if (seq) { try { it.mainSource.conformFrameRate = FPS; } catch (e) {} }
    cache[key] = it;
    return it;
  }
  function comp(name, w, h, inFolder) {
    var c = proj.items.addComp(name, w || W, h || H, 1, DUR, FPS);
    c.parentFolder = inFolder || FC;
    c.bgColor = [1, 1, 1];
    return c;
  }

  // ---------- keyframes with GSAP-like eases ----------
  // [out speed factor, out influence, in speed factor, in influence]
  var EASE = {
    "power2.out": [2, 40, 0, 60], "power3.out": [3, 33, 0, 70], "expo.out": [6.5, 20, 0, 88], "back.out": [6.5, 20, 0, 88],
    "power2.in": [0, 60, 2, 40], "expo.in": [0, 88, 6.5, 20],
    "power2.inOut": [0, 50, 0, 50], "power3.inOut": [0, 66, 0, 66], "expo.inOut": [0, 85, 0, 85]
  };
  function arr(v) { return (v instanceof Array) ? v : [v]; }
  function easeSet(p, k, inE, outE) {
    var tries = [inE.length, 3, 2, 1], i, a, b, j;
    for (i = 0; i < tries.length; i++) {
      a = []; b = [];
      for (j = 0; j < tries[i]; j++) { a.push(inE[Math.min(j, inE.length - 1)]); b.push(outE[Math.min(j, outE.length - 1)]); }
      try { p.setTemporalEaseAtKey(k, a, b); return; } catch (e) {}
    }
  }
  // L: [[t, value, ease-of-the-segment-that-starts-here], ...] ; ease "none" = linear, "hold" = jump
  function keys(p, L) {
    if (!p) return;
    L = L.slice(0).sort(function (a, b) { return a[0] - b[0]; });
    var i, n = L.length, idx = [];
    for (i = 0; i < n; i++) p.setValueAtTime(L[i][0], L[i][1]);
    for (i = 0; i < n; i++) idx.push(p.nearestKeyIndex(L[i][0]));
    var isShape = (p.propertyValueType === PropertyValueType.SHAPE);
    for (i = 0; i < n - 1; i++) {
      var e = L[i][2] || "none", k1 = idx[i], k2 = idx[i + 1];
      if (e === "hold") {
        p.setInterpolationTypeAtKey(k1, p.keyInInterpolationType(k1), KeyframeInterpolationType.HOLD);
        continue;
      }
      if (e === "none" || !EASE[e]) {
        p.setInterpolationTypeAtKey(k1, p.keyInInterpolationType(k1), KeyframeInterpolationType.LINEAR);
        p.setInterpolationTypeAtKey(k2, KeyframeInterpolationType.LINEAR, p.keyOutInterpolationType(k2));
        continue;
      }
      var E = EASE[e], d = Math.max(0.001, L[i + 1][0] - L[i][0]);
      p.setInterpolationTypeAtKey(k1, p.keyInInterpolationType(k1), KeyframeInterpolationType.BEZIER);
      p.setInterpolationTypeAtKey(k2, KeyframeInterpolationType.BEZIER, p.keyOutInterpolationType(k2));
      var outE = [], inE = [];
      if (isShape) {
        // a path has no speed: fast-start eases get a short out handle, slow-start eases a long one
        outE.push(new KeyframeEase(0, E[0] > 0 ? 0.1 : E[1]));
        inE.push(new KeyframeEase(0, E[2] > 0 ? 0.1 : E[3]));
      } else {
        var a = arr(L[i][1]), b = arr(L[i + 1][1]), j;
        for (j = 0; j < a.length; j++) {
          var avg = Math.abs(b[j] - a[j]) / d;
          outE.push(new KeyframeEase(avg * E[0], E[1]));
          inE.push(new KeyframeEase(avg * E[2], E[3]));
        }
      }
      easeSet(p, k1, p.keyInTemporalEase(k1), outE);
      easeSet(p, k2, inE, p.keyOutTemporalEase(k2));
    }
  }
  function S(s) { return [s, s, 100]; }
  // GSAP punch: 1 → k (0.07 s power2.out) → 1 (expo.out)
  function punch(t, k, d) { d = d || 0.4; return [[t, S(100), "power2.out"], [t + 0.07, S(k * 100), "expo.out"], [t + 0.07 + d, S(100)]]; }
  function cat() { var out = [], i, j; for (i = 0; i < arguments.length; i++) for (j = 0; j < arguments[i].length; j++) out.push(arguments[i][j]); return out; }

  // ---------- transform helpers ----------
  function tf(L) { return L.property("ADBE Transform Group"); }
  function sep(L) { var p = tf(L).property("ADBE Position"); try { p.dimensionsSeparated = true; } catch (e) {} return { x: tf(L).property("ADBE Position_0"), y: tf(L).property("ADBE Position_1") }; }
  function setPos(L, x, y) { var p = tf(L).property("ADBE Position"); if (p.dimensionsSeparated) { tf(L).property("ADBE Position_0").setValue(x); tf(L).property("ADBE Position_1").setValue(y); } else p.setValue([x, y]); }
  function getPos(L) { var p = tf(L).property("ADBE Position"); if (p.dimensionsSeparated) return [tf(L).property("ADBE Position_0").value, tf(L).property("ADBE Position_1").value]; var v = p.value; return [v[0], v[1]]; }
  function setAnchor(L, ax, ay) { tf(L).property("ADBE Anchor Point").setValue([ax, ay]); }
  // move the anchor to a point (in layer space) without moving the layer
  function pivot(L, lx, ly) {
    var a = tf(L).property("ADBE Anchor Point").value, p = getPos(L), s = tf(L).property("ADBE Scale").value;
    setAnchor(L, lx, ly);
    setPos(L, p[0] + (lx - a[0]) * s[0] / 100, p[1] + (ly - a[1]) * s[1] / 100);
  }
  function scaleP(L) { return tf(L).property("ADBE Scale"); }
  function opac(L) { return tf(L).property("ADBE Opacity"); }
  function rot(L) { return tf(L).property("ADBE Rotate Z"); }
  function span(L, a, b) { if (a > 0) L.inPoint = a; if (b !== undefined && b < DUR) L.outPoint = b; }
  function nul(c, name, x, y) { var N = c.layers.addNull(DUR); N.name = name; setAnchor(N, 0, 0); setPos(N, x, y); return N; }
  function under(L, N) { L.parent = N; }
  function blur(L, rep) {
    try {
      var e = L.property("ADBE Effect Parade").addProperty("ADBE Gaussian Blur 2");
      if (rep) { try { e.property("ADBE Gaussian Blur 2-0003").setValue(1); } catch (x) {} }
      return L.property("ADBE Effect Parade").property(L.property("ADBE Effect Parade").numProperties).property("ADBE Gaussian Blur 2-0001");
    } catch (e2) { warn("Blur gagal di " + L.name); return null; }
  }

  // ---------- layers ----------
  function image(c, rel, r, name) {
    var it = imp(rel); if (!it) return null;
    var L = c.layers.add(it); L.name = name || rel.replace(/^.*\//, "");
    var sx = r.w / it.width * 100, sy = r.h / it.height * 100;
    scaleP(L).setValue([sx, sy, 100]);
    setAnchor(L, it.width / 2, it.height / 2);
    setPos(L, r.x + r.w / 2, r.y + r.h / 2);
    return L;
  }
  function cover(c, rel, name, w, h) {
    var it = imp(rel); if (!it) return null;
    w = w || W; h = h || H;
    var L = c.layers.add(it); L.name = name;
    var s = Math.max(w / it.width, h / it.height) * 100;
    scaleP(L).setValue([s, s, 100]);
    setAnchor(L, it.width / 2, it.height / 2);
    setPos(L, w / 2, h / 2);
    return L;
  }
  // a PNG captured from the composition at its own size, placed at its captured spot
  function cap(c, file, clip, name) { return image(c, "assets/ae/" + file + ".png", { x: clip.x, y: clip.y, w: clip.width, h: clip.height }, name); }

  var FONT_TRIES = {
    400: ["Inter-Regular", "Inter18pt-Regular", "Inter"], 500: ["Inter-Medium", "Inter18pt-Medium"],
    600: ["Inter-SemiBold", "Inter18pt-SemiBold", "Inter-Semibold"], 700: ["Inter-Bold", "Inter18pt-Bold"]
  };
  var fontMemo = {};
  function fontFor(w) {
    if (fontMemo[w]) return fontMemo[w];
    var list = FONT_TRIES[w] || FONT_TRIES[700], i, pick = list[0];
    try {
      if (app.fonts && app.fonts.getFontsByPostScriptName) {
        for (i = 0; i < list.length; i++) { var f = app.fonts.getFontsByPostScriptName(list[i]); if (f && f.length) { pick = list[i]; break; } }
        if (i === list.length) warn("Font " + list[0] + " belum terpasang: pasang Inter (lihat BACA-SAYA.txt)");
      }
    } catch (e) {}
    fontMemo[w] = pick;
    return pick;
  }
  // text layer from a measured text: anchor (0,0) = baseline start of the first line (left) or its centre (center)
  function text(c, t, name, opts) {
    opts = opts || {};
    var lines = [], i;
    for (i = 0; i < t.lines.length; i++) lines.push(t.lines[i].s);
    var s = opts.s !== undefined ? opts.s : lines.join("\r");
    var L = c.layers.addText(s); L.name = name;
    var prop = L.property("ADBE Text Properties").property("ADBE Text Document");
    var d = prop.value;
    try { d.resetCharStyle(); d.resetParagraphStyle(); } catch (e) {}
    d.text = s;
    d.font = fontFor(t.fw);
    d.fontSize = t.fs;
    d.applyFill = true; d.fillColor = opts.color || t.color; d.applyStroke = false;
    d.tracking = Math.round(t.ls / t.fs * 1000);
    d.justification = t.align === "center" ? ParagraphJustification.CENTER_JUSTIFY : ParagraphJustification.LEFT_JUSTIFY;
    if (lines.length > 1) {
      try { d.autoLeading = false; } catch (e1) {}
      try { d.leading = t.lines[1].base - t.lines[0].base; } catch (e2) {}
    }
    prop.setValue(d);
    var l0 = t.lines[0];
    setAnchor(L, 0, 0);
    setPos(L, t.align === "center" ? l0.cx : l0.x, l0.base);
    return L;
  }
  // per character / per word entrance, GSAP stagger: every unit starts st later, eases over d (expression selector)
  function stagger(L, o) {
    try {
      var anims = L.property("ADBE Text Properties").property("ADBE Text Animators");
      anims.addProperty("ADBE Text Animator");
      var a = anims.property(anims.numProperties); a.name = o.name || "Masuk";
      var ap = a.property("ADBE Text Animator Properties");
      if (o.pos) ap.addProperty("ADBE Text Position 3D");
      if (o.op) ap.addProperty("ADBE Text Opacity");
      if (o.blur) ap.addProperty("ADBE Text Blur");
      a = anims.property(anims.numProperties); ap = a.property("ADBE Text Animator Properties");
      if (o.pos) ap.property("ADBE Text Position 3D").setValue([o.pos[0], o.pos[1], 0]);
      if (o.op) ap.property("ADBE Text Opacity").setValue(0);
      if (o.blur) ap.property("ADBE Text Blur").setValue([o.blur, o.blur]);
      a.property("ADBE Text Selectors").addProperty("ADBE Text Expressible Selector");
      a = anims.property(anims.numProperties);
      var sel = a.property("ADBE Text Selectors").property(1);
      try { sel.property("ADBE Text Range Type2").setValue(o.words ? 3 : 2); } catch (e1) { warn("Based On gagal di " + L.name); }
      var curve = o.ease === "power3" ? "1-Math.pow(1-p,3)" : "(p>=1)?1:1-Math.pow(2,-10*p)";
      sel.property("ADBE Text Expressible Amount").expression =
        "// masuk satu per satu: mulai, durasi, jeda antar " + (o.words ? "kata" : "huruf") + "\r" +
        "var t0=" + o.t0 + ", d=" + o.d + ", st=" + o.st + ";\r" +
        "var p=(time-t0-(textIndex-1)*st)/d; p=Math.min(Math.max(p,0),1);\r" +
        "var e=" + curve + ";\r" +
        "mul(selectorValue, 1-e)";
    } catch (e) { warn("Animasi teks gagal di " + L.name + ": " + e.toString()); }
  }
  // rect / polygon / circle as mask shapes (layer space)
  function shp(pts) { var s = new Shape(); s.vertices = pts; s.closed = true; return s; }
  function rectS(x, y, w, h) { return shp([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]); }
  function circS(cx, cy, r) {
    var k = 0.5523 * r, s = new Shape();
    s.vertices = [[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]];
    s.inTangents = [[-k, 0], [0, -k], [k, 0], [0, k]];
    s.outTangents = [[k, 0], [0, k], [-k, 0], [0, -k]];
    s.closed = true; return s;
  }
  function mask(L, s, mode, name) {
    var g = L.property("ADBE Mask Parade"); g.addProperty("ADBE Mask Atom");
    var mk = g.property(g.numProperties); mk.name = name || "Mask";
    mk.maskMode = mode || MaskMode.ADD;
    mk.property("ADBE Mask Shape").setValue(s);
    return mk.property("ADBE Mask Shape");
  }
  // shape layer in comp space (position 0, anchor 0)
  function shapeLayer(c, name) { var L = c.layers.addShape(); L.name = name; setAnchor(L, 0, 0); setPos(L, 0, 0); return L; }
  function rectGroup(L, r, rx, stroke, sw, fill) {
    var root = L.property("ADBE Root Vectors Group");
    root.addProperty("ADBE Vector Group");
    var g = root.property(root.numProperties), C = g.property("ADBE Vectors Group");
    C.addProperty("ADBE Vector Shape - Rect");
    if (stroke) C.addProperty("ADBE Vector Graphic - Stroke");
    if (fill) C.addProperty("ADBE Vector Graphic - Fill");
    C.addProperty("ADBE Vector Filter - Trim");
    g = root.property(root.numProperties); C = g.property("ADBE Vectors Group");
    var R = C.property("ADBE Vector Shape - Rect");
    R.property("ADBE Vector Rect Size").setValue([r.w, r.h]);
    R.property("ADBE Vector Rect Position").setValue([r.x + r.w / 2, r.y + r.h / 2]);
    R.property("ADBE Vector Rect Roundness").setValue(rx);
    if (stroke) {
      var st = C.property("ADBE Vector Graphic - Stroke");
      st.property("ADBE Vector Stroke Color").setValue(stroke);
      st.property("ADBE Vector Stroke Width").setValue(sw);
    }
    if (fill) C.property("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(fill);
    return C.property("ADBE Vector Filter - Trim").property("ADBE Vector Trim End");
  }
  // radial burst: n rounded strokes from radius r0, length len, grown outward then faded (GSAP "fire")
  function burst(c, name, cx, cy, n, r0, len, color, t) {
    var L = c.layers.addShape(); L.name = name; setAnchor(L, 0, 0); setPos(L, cx, cy);
    try {
      var root = L.property("ADBE Root Vectors Group");
      root.addProperty("ADBE Vector Group");
      var oc = root.property(1).property("ADBE Vectors Group");
      oc.addProperty("ADBE Vector Group");
      oc.addProperty("ADBE Vector Filter - Repeater");
      var inner = L.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group").property(1);
      inner.property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Rect");
      inner = L.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group").property(1);
      inner.property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Fill");
      inner = L.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group").property(1);
      var ic = inner.property("ADBE Vectors Group");
      var R = ic.property("ADBE Vector Shape - Rect");
      R.property("ADBE Vector Rect Size").setValue([8, len]);
      R.property("ADBE Vector Rect Position").setValue([0, r0 + len / 2]);
      R.property("ADBE Vector Rect Roundness").setValue(4);
      ic.property("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(color);
      var gt = inner.property("ADBE Vector Transform Group");
      gt.property("ADBE Vector Anchor").setValue([0, r0]);
      gt.property("ADBE Vector Position").setValue([0, r0]);
      keys(gt.property("ADBE Vector Scale"), [[t, [100, 0], "expo.out"], [t + 0.22, [100, 100]]]);
      var rep = L.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group").property("ADBE Vector Filter - Repeater");
      rep.property("ADBE Vector Repeater Copies").setValue(n);
      var rt = rep.property("ADBE Vector Repeater Transform");
      rt.property("ADBE Vector Repeater Position").setValue([0, 0]);
      rt.property("ADBE Vector Repeater Rotation").setValue(360 / n);
    } catch (e) { warn("Burst " + name + ": " + e.toString()); }
    keys(opac(L), [[t + 0.18, 100, "none"], [t + 0.43, 0]]);
    span(L, t - 0.01, t + 0.5);
    return L;
  }
  function fillColor(L, keysList) {
    try {
      L.property("ADBE Effect Parade").addProperty("ADBE Fill");
      var e = L.property("ADBE Effect Parade").property(L.property("ADBE Effect Parade").numProperties);
      keys(e.property("ADBE Fill-0002"), keysList);
    } catch (x) { warn("Fill gagal di " + L.name); }
  }
  // the number counts up to whatever is typed in the layer (edit the text, the animation follows)
  function countUp(L, t0, d) {
    try {
      L.property("ADBE Text Properties").property("ADBE Text Document").expression =
        "// hitung naik ke angka yang diketik di layer ini\rvar t0=" + t0 + ", d=" + d + ";\r" +
        "var s=(typeof value===\"string\")?value:(value.text!==undefined?value.text:value.toString()); var n=parseFloat(s); var p=Math.min(Math.max((time-t0)/d,0),1); var e=(p>=1)?1:1-Math.pow(2,-10*p);\r" +
        "isNaN(n)?value:\"\"+Math.round(n*e)";
    } catch (e) { warn("Hitung naik gagal di " + L.name); }
  }

  // ======================================================================
  // 1. Foto + teks kinetik (inside the photo: scales with it)
  // ======================================================================
  var cPhoto = comp("01 Foto + Teks Kinetik");
  var still = cover(cPhoto, D.files.still, "Foto (frame terakhir klip)");
  var vid = D.files.video ? cover(cPhoto, D.files.video, "Klip Flow") : null;
  if (vid) span(vid, 0, D.files.videoStart + D.files.videoDur);
  var KB = [[0, T.b], [T.b, T.c], [T.c, T.d], [T.d, T.g + 0.42]];
  var DIR = { b: [-1, 1], c: [1, -1], d: [-1, 1, -1] }, OFF = { b: [0, 0.1], c: [0, 0.1], d: [0, 0.08, 0.18] }, START = { a: 0, b: T.b, c: T.c, d: T.d };
  var i, j;
  for (i = 0; i < m.kt.length; i++) {
    var beat = m.kt[i], ids = beat.id, NB = null;
    if (ids === "c") NB = nul(cPhoto, "Teks C (pusat hentakan)", beat.box.x + beat.box.w / 2, beat.box.y + beat.box.h / 2);
    for (j = 0; j < beat.lines.length; j++) {
      var tt = beat.lines[j], TL = text(cPhoto, tt, "Teks " + ids.toUpperCase() + (j + 1) + ": " + tt.lines[0].s);
      span(TL, KB[i][0], KB[i][1]);
      if (NB) { NB.inPoint = KB[i][0]; NB.outPoint = KB[i][1]; under(TL, NB); setPos(TL, tt.lines[0].x - (beat.box.x + beat.box.w / 2), tt.lines[0].base - (beat.box.y + beat.box.h / 2)); }
      if (ids === "a") {
        // "Healing" is on screen at frame 0, punches on the first hit (origin 0 70% of the word box)
        pivot(TL, 0, -0.25 * tt.fs);
        keys(scaleP(TL), punch(0.08, 1.07));
      } else {
        stagger(TL, { t0: START[ids] + OFF[ids][j], d: 0.36, st: 0.022, pos: [40 * DIR[ids][j], 0.63 * tt.fs], op: true, blur: 12 });
      }
    }
    if (NB) keys(scaleP(NB), punch(T.strike + 0.02, 1.07));
  }
  if (D.files.cutFirst) {
    var seq = imp(D.files.cutFirst, true);
    if (seq) {
      var CL = cPhoto.layers.add(seq); CL.name = "Potongan orang (di depan teks)";
      scaleP(CL).setValue([m.cut.w / seq.width * 100, m.cut.h / seq.height * 100, 100]);
      setAnchor(CL, seq.width / 2, seq.height / 2); setPos(CL, m.cut.x + m.cut.w / 2, m.cut.y + m.cut.h / 2);
      span(CL, 0, P.cutEnd);
    }
  }

  // ======================================================================
  // 2. Latar: the photo comp + end frame 2 backdrop + washes (the whole thing punches on the hits)
  // ======================================================================
  var cBg = comp("02 Latar");
  var ground = cBg.layers.addSolid(m.ground, "Langit", W, H, 1);
  var LP = cBg.layers.add(cPhoto); LP.name = "Foto + Teks Kinetik";
  pivot(LP, 0.46 * W, 0.4 * H);
  keys(scaleP(LP), [
    [0, S(100), "none"], [T.g, S(110)],
    [T.slam - 0.2, S(110), "power2.inOut"], [T.slam + 0.2, S(100)],
    [T.fly, S(100), "none"], [T.toB, S(104), "expo.inOut"], [T.toB + 0.7, S(145), "none"], [DUR, S(152)]
  ]);
  var bl = blur(LP, true);
  if (bl) keys(bl, [[T.toB, 0, "expo.inOut"], [T.toB + 0.7, 28]]);
  if (D.files.bg2) {
    var B2 = cover(cBg, D.files.bg2, "Latar end frame 2");
    if (B2) {
      pivot(B2, B2.source.width / 2, B2.source.height * 0.55);
      var s0 = scaleP(B2).value[0];
      keys(scaleP(B2), [[T.toB + 0.15, S(s0 * 1.18), "expo.out"], [T.toB + 0.85, S(s0 * 1.04), "none"], [DUR, S(s0)]]);
      keys(opac(B2), [[T.toB + 0.15, 0, "expo.out"], [T.toB + 0.85, 100]]);
      var b2b = blur(B2, true); if (b2b) keys(b2b, [[T.toB + 0.15, 18, "expo.out"], [T.toB + 0.85, 0]]);
      span(B2, T.toB + 0.1);
    }
  }
  var WA = cap(cBg, "wash", m.caps.wash, "Wash biru muda"); if (WA) keys(opac(WA), [[T.toB + 0.25, 0, "expo.out"], [T.toB + 0.75, 35]]);
  var VE = cap(cBg, "veil", m.caps.veil, "Veil putih atas"); if (VE) keys(opac(VE), [[T.slam, 0, "none"], [T.slam + 0.2, 100]]);
  var SH = cap(cBg, "foot-shade", m.caps.shade, "Gradasi biru bawah"); if (SH) keys(opac(SH), [[T.slam, 0, "none"], [T.slam + 0.2, 100]]);

  // ======================================================================
  // 3. End frame 1: the white rounded square (draws itself, top edge behind the family) + promo + 25%
  // ======================================================================
  var cA = comp("03 End Frame 1 (Bingkai + Promo)");
  var fr = m.frame;
  var FR = shapeLayer(cA, "Bingkai putih (rounded square)");
  var trim = rectGroup(FR, { x: fr.x, y: fr.y, w: fr.w, h: fr.h }, fr.rx, WHITE, fr.sw, null);
  keys(trim, [[T.end1, 0, "expo.out"], [T.end1 + 0.8, 100]]);
  span(FR, T.end1 - 0.01);
  // occluders: where the family stands in front of the frame
  for (i = 0; i < P.occ.length; i++) {
    var pts = P.occ[i].split(" "), V = [], q;
    for (q = 0; q < pts.length; q++) { var xy = pts[q].split(","); V.push([+xy[0], +xy[1]]); }
    mask(FR, shp(V), MaskMode.SUBTRACT, "Celah statis " + (i + 1));
  }
  var runs = P.dyn.runs || [], maxR = 0;
  for (i = 0; i < runs.length; i++) maxR = Math.max(maxR, runs[i].length);
  if (maxR > 0) {
    var y0 = P.dynY[0], y1 = P.dynY[1];
    for (q = 0; q < maxR; q++) {
      var mp = mask(FR, rectS(-20, -20, 1, 1), MaskMode.SUBTRACT, "Lengan/kepala " + (q + 1)), times = [], vals = [];
      for (i = 0; i < runs.length; i++) {
        var rr = runs[i][q];
        times.push(P.dyn.t0 + i / P.dyn.fps);
        vals.push(rr ? rectS(rr[0], y0, rr[1] - rr[0], y1 - y0) : rectS(-20, -20, 1, 1));
      }
      mp.setValuesAtTimes(times, vals);
      for (i = 1; i <= mp.numKeys; i++) mp.setInterpolationTypeAtKey(i, KeyframeInterpolationType.HOLD, KeyframeInterpolationType.HOLD);
    }
  }
  var PT = text(cA, m.promo, "Kalimat promo");
  stagger(PT, { t0: T.end1 + 0.2, d: 0.42, st: 0.04, words: true, pos: [-40, 0], op: true, blur: 8 });
  var ba = m.bigA, NA = nul(cA, "25% (pusat hentakan)", ba.box.x, ba.box.y + 0.6 * ba.box.h);
  NA.inPoint = T.fly + 0.5;
  var AN = text(cA, ba.n, "Angka promo 25"), AS = text(cA, ba.sup, "Persen");
  under(AN, NA); under(AS, NA);
  setPos(AN, ba.n.lines[0].x - ba.box.x, ba.n.lines[0].base - (ba.box.y + 0.6 * ba.box.h));
  setPos(AS, ba.sup.lines[0].x - ba.box.x, ba.sup.lines[0].base - (ba.box.y + 0.6 * ba.box.h));
  span(AN, T.fly + 0.5); span(AS, T.fly + 0.5);
  keys(scaleP(NA), cat(punch(T.fly + 0.5, 1.1), punch(T.shine + 0.25, 1.06)));
  try {
    AN.property("ADBE Effect Parade").addProperty("CC Light Sweep");
    var sw = AN.property("ADBE Effect Parade").property(1);
    keys(sw.property(1), [[T.shine, [-ba.box.w * 0.6, -ba.n.fs * 0.4], "power2.inOut"], [T.shine + 0.6, [ba.box.w * 1.4, -ba.n.fs * 0.4]]]);
  } catch (e) { warn("Kilau (CC Light Sweep) dilewati"); }

  // ======================================================================
  // 4. Panel angka (blue takeover, odometer to 25, slam, then it shrinks into the frame slot)
  // ======================================================================
  var cG = comp("04 Panel Angka");
  var GP = cap(cG, "panel-biru", m.caps.gpanel, "Panel biru");
  if (GP) {
    var gw = GP.source.width, gh = GP.source.height;
    var wipe = mask(GP, shp([[0, gh], [gw, gh], [gw, gh], [0, gh]]), MaskMode.ADD, "Naik dari bawah");
    keys(wipe, [[T.g, shp([[0, gh], [gw, gh], [gw, gh], [0, gh]]), "expo.out"], [T.g + 0.42, shp([[0, -0.12 * gh], [gw, 0], [gw, gh], [0, gh]])]]);
    var R0 = 1.3 * Math.sqrt((gw * gw + gh * gh) / 2);
    var circ = mask(GP, circS(P.circle[0], P.circle[1], R0), MaskMode.INTERSECT, "Menyusut ke bingkai");
    keys(circ, [[T.fly, circS(P.circle[0], P.circle[1], R0), "power3.inOut"], [T.fly + 0.5, circS(P.circle[2], P.circle[3], 0.5)]]);
  }
  var GK = text(cG, m.giantK, "Kalimat promo (panel)");
  stagger(GK, { t0: T.k, d: 0.4, st: 0.04, words: true, pos: [0, 40], op: true, blur: 10 });
  keys(opac(GK), [[T.fly, 100, "none"], [T.fly + 0.15, 0]]);
  var bg = m.bigG, gcx = bg.box.x + bg.box.w / 2, gcy = bg.box.y + bg.box.h / 2;
  var NG = nul(cG, "Hentakan angka", gcx, gcy), NF = nul(cG, "Terbang ke bingkai", gcx, gcy);
  under(NF, NG); setPos(NF, 0, 0);
  var GN = text(cG, bg.n, "Angka besar 25", { color: WHITE }), GS = text(cG, bg.sup, "Persen besar", { color: WHITE });
  under(GN, NF); under(GS, NF);
  setPos(GN, bg.n.lines[0].x - gcx, bg.n.lines[0].base - gcy);
  var sx = bg.supBox.x + 0.2 * bg.supBox.w, sy = bg.supBox.y + 0.8 * bg.supBox.h;
  setAnchor(GS, sx - bg.sup.lines[0].x, sy - bg.sup.lines[0].base);
  setPos(GS, sx - gcx, sy - gcy);
  sep(NF);
  keys(tf(NF).property("ADBE Position_0"), [[T.fly, 0, "power3.inOut"], [T.fly + 0.5, P.fly[0]]]);
  keys(tf(NF).property("ADBE Position_1"), [[T.fly, 0, "power3.inOut"], [T.fly + 0.5, P.fly[1]]]);
  keys(scaleP(NF), [[T.odo, S(60), "expo.out"], [T.odo + 0.4, S(100), "none"], [T.fly, S(100), "power3.inOut"], [T.fly + 0.5, S(P.fly[2] * 100)]]);
  keys(scaleP(NG), punch(T.slam, 1.1, 0.3));
  keys(opac(GN), [[T.odo, 0, "expo.out"], [T.odo + 0.4, 100]]);
  keys(opac(GS), [[T.odo, 0, "expo.out"], [T.odo + 0.4, 100]]);
  countUp(GN, T.odo, 0.65);
  var gbl = blur(GN); if (gbl) keys(gbl, [[T.odo, 10, "expo.in"], [T.odo + 0.6, 0]]);
  keys(scaleP(GS), [[T.slam - 0.05, S(0), "back.out"], [T.slam + 0.3, S(100)]]);
  keys(rot(GS), [[T.slam - 0.05, -30, "back.out"], [T.slam + 0.3, 0]]);
  var A4 = ACC().concat([1]);
  fillColor(GN, [[T.fly + 0.32, [1, 1, 1, 1], "none"], [T.fly + 0.5, A4]]);
  fillColor(GS, [[T.fly + 0.32, [1, 1, 1, 1], "none"], [T.fly + 0.5, A4]]);
  burst(cG, "Garis ledakan kuning", m.gb.x, m.gb.y, P.gb[0], P.gb[1], P.gb[2], YELLOW, T.slam);

  // ======================================================================
  // 5. End frame 2: partner card + promo box
  // ======================================================================
  var cd = m.card, MG = 80;
  var cCard = comp("05a Kartu Partner", Math.ceil(cd.w0 + 2 * MG), Math.ceil(cd.h0 + 2 * MG));
  var CB = image(cCard, "assets/ae/kartu.png", { x: 0, y: 0, w: m.caps.card.width, h: m.caps.card.height }, "Kartu putih");
  for (i = 0; i < cd.gh.length; i++) {
    var g1 = cd.gh[i], LG = cCard.layers.addSolid(ACC(), "Garis grid " + (i + 1), Math.max(1, Math.round(g1.w)), Math.max(1, Math.round(g1.h)), 1);
    opac(LG).setValue(90); setAnchor(LG, 0, g1.h / 2); setPos(LG, MG + g1.x, MG + g1.y + g1.h / 2);
    keys(scaleP(LG), [[T.grid + 0.08 * i, [0, 100, 100], "expo.out"], [T.grid + 0.08 * i + 0.45, S(100)]]);
  }
  for (i = 0; i < cd.gv.length; i++) {
    var g2 = cd.gv[i], LV = cCard.layers.addSolid(ACC(), "Garis grid tegak " + (i + 1), Math.max(1, Math.round(g2.w)), Math.max(1, Math.round(g2.h)), 1);
    opac(LV).setValue(90); setAnchor(LV, g2.w / 2, 0); setPos(LV, MG + g2.x + g2.w / 2, MG + g2.y);
    keys(scaleP(LV), [[T.grid + 0.1 + 0.04 * i, [100, 0, 100], "expo.out"], [T.grid + 0.1 + 0.04 * i + 0.4, S(100)]]);
  }
  for (i = 0; i < cd.cells.length; i++) {
    var ce = cd.cells[i], LC = image(cCard, ce.src, { x: MG + ce.x, y: MG + ce.y, w: ce.w, h: ce.h }, "Logo partner " + (i + 1) + " (" + ce.id.replace("pl-", "") + ")");
    if (!LC) continue;
    try { LC.blendingMode = BlendingMode.MULTIPLY; } catch (e) {}
    var t1 = T.grid + 0.3 + 0.07 * i, s1 = scaleP(LC).value;
    keys(opac(LC), [[t1, 0, "power3.out"], [t1 + 0.4, 100]]);
    keys(scaleP(LC), [[t1, [s1[0] * 0.85, s1[1] * 0.85, 100], "power3.out"], [t1 + 0.4, s1]]);
    var py = getPos(LC);
    sep(LC); keys(tf(LC).property("ADBE Position_1"), [[t1, py[1] + 16, "power3.out"], [t1 + 0.4, py[1]]]);
  }
  var WP = image(cCard, "assets/ae/kartu-biru.png", { x: MG, y: MG, w: m.caps.wipe.width, h: m.caps.wipe.height }, "Tirai biru");
  if (WP) {
    var ww = WP.source.width, wh = WP.source.height, wm = mask(WP, rectS(0, 0, ww, wh), MaskMode.ADD, "Tirai naik");
    keys(wm, [[T.card + 0.35, rectS(0, 0, ww, wh), "expo.inOut"], [T.card + 0.85, rectS(0, 0, ww, 0.5)]]);
    span(WP, 0, T.card + 0.9);
  }

  var cB = comp("05 End Frame 2 (Kartu + Kotak Promo)");
  var LK = cB.layers.add(cCard); LK.name = "Kartu Partner";
  setAnchor(LK, MG, MG); setPos(LK, cd.x, cd.y); scaleP(LK).setValue(S(cd.scale * 100));
  pivot(LK, MG + cd.w0 / 2, MG + cd.h0 / 2);
  var kp = getPos(LK); sep(LK);
  keys(tf(LK).property("ADBE Position_1"), [[T.card, kp[1] + 700 * cd.scale, "expo.out"], [T.card + 0.6, kp[1]]]);
  keys(scaleP(LK), [[T.card, S(cd.scale * 90), "expo.out"], [T.card + 0.6, S(cd.scale * 100)]]);
  var bx = m.box, cBox = comp("05b Kotak Promo");
  var BR = shapeLayer(cBox, "Kotak (garis biru)");
  var btrim = rectGroup(BR, { x: bx.x + bx.inset, y: bx.y + bx.inset, w: bx.w - 2 * bx.inset, h: bx.h - 2 * bx.inset }, bx.rx, ACC(), bx.sw, null);
  keys(btrim, [[T.box, 0, "expo.out"], [T.box + 0.5, 100]]);
  var BT = text(cBox, bx.t, "Promo Up To");
  var bm = mask(BT, rectS(-6, bx.tBox.y - bx.t.lines[0].base - 6, 1, bx.tBox.h + 12), MaskMode.ADD, "Buka ke kanan");
  keys(bm, [[T.box + 0.1, rectS(-6, bx.tBox.y - bx.t.lines[0].base - 6, 1, bx.tBox.h + 12), "expo.out"], [T.box + 0.5, rectS(-6, bx.tBox.y - bx.t.lines[0].base - 6, bx.tBox.w + 12, bx.tBox.h + 12)]]);
  var BN = text(cBox, bx.n, "Angka kotak 25"), BS = text(cBox, bx.sup, "Persen kotak");
  countUp(BN, T.box + 0.15, 0.6);
  var bnp = [getPos(BN), getPos(BS)], LB = [BN, BS];
  for (i = 0; i < 2; i++) {
    sep(LB[i]);
    keys(tf(LB[i]).property("ADBE Position_0"), [[T.box + 0.15, bnp[i][0] + 80, "expo.out"], [T.box + 0.57, bnp[i][0]]]);
    keys(opac(LB[i]), [[T.box + 0.15, 0, "expo.out"], [T.box + 0.57, 100]]);
    var lbb = blur(LB[i]); if (lbb) keys(lbb, [[T.box + 0.15, 16, "expo.out"], [T.box + 0.57, 0]]);
  }
  var LX = cB.layers.add(cBox); LX.name = "Kotak Promo";
  pivot(LX, bx.x + bx.w / 2, bx.y + bx.h / 2);
  keys(scaleP(LX), cat([[T.box, S(40), "expo.out"], [T.box + 0.45, S(100)]], punch(T.box + 0.75, 1.1), punch(T.hit, 1.08)));
  keys(rot(LX), [[T.box, -8, "expo.out"], [T.box + 0.45, 0]]);
  keys(opac(LX), [[T.box, 0, "expo.out"], [T.box + 0.45, 100]]);
  var lxb = blur(LX); if (lxb) keys(lxb, [[T.box, 14, "expo.out"], [T.box + 0.45, 0]]);
  burst(cB, "Garis ledakan kotak", m.bb.x, m.bb.y, P.bb[0], P.bb[1], P.bb[2], ACC(), T.box + 0.75);

  // ======================================================================
  // 6. Penutup: white, the three logos, the LPS / OJK / BI line
  // ======================================================================
  var cE = comp("06 Penutup (Logo + Disclaimer)");
  cE.layers.addSolid(WHITE, "Putih", W, H, 1);
  var EL = [image(cE, "assets/logos/danantara.png", m.end.dan, "Logo Danantara"), image(cE, "assets/logos/131.png", m.end.n131, "Logo 131"), image(cE, "assets/logos/bri.png", m.end.bri, "Logo BRI")];
  for (i = 0; i < EL.length; i++) {
    if (!EL[i]) continue;
    var te = T.close + 0.15 + 0.08 * i, ep = getPos(EL[i]);
    keys(opac(EL[i]), [[te, 0, "expo.out"], [te + 0.5, 100]]);
    sep(EL[i]); keys(tf(EL[i]).property("ADBE Position_1"), [[te, ep[1] + 24, "expo.out"], [te + 0.5, ep[1]]]);
  }
  var LGL = text(cE, m.end.legal, "Disclaimer LPS OJK BI");
  keys(opac(LGL), [[T.close + 0.4, 0, "power2.out"], [T.close + 0.8, 100]]);

  // ======================================================================
  // MAIN
  // ======================================================================
  var main = comp(D.name, W, H, FOLDER);
  var MB = main.layers.add(cBg); MB.name = "Latar";
  pivot(MB, W / 2, 0.4 * H);
  keys(scaleP(MB), cat(punch(0.08, 1.03), punch(T.b + 0.12, 1.03), punch(T.strike + 0.02, 1.04), punch(T.d + 0.3, 1.03)));
  var MA = main.layers.add(cA); MA.name = "End Frame 1";
  pivot(MA, P.aOrigin[0], P.aOrigin[1]);
  keys(scaleP(MA), [[T.toB, S(100), "expo.in"], [T.toB + 0.42, S(240)]]);
  keys(opac(MA), [[T.toB, 100, "expo.in"], [T.toB + 0.42, 0]]);
  var mab = blur(MA); if (mab) keys(mab, [[T.toB, 0, "expo.in"], [T.toB + 0.42, 16]]);
  span(MA, T.end1 - 0.05, T.toB + 0.45);
  var MBB = main.layers.add(cB); MBB.name = "End Frame 2"; span(MBB, T.card);

  // headline: two lines rise word by word inside their own line, the sub opens to the right; shrinks for end frame 2
  var hd = m.head, NH = nul(main, "Headline (atur posisi/skala di sini)", hd.box.x, hd.box.y);
  NH.inPoint = T.end1;
  var HL = [[hd.l1, hd.r1, "Headline baris 1", T.end1], [hd.l2, hd.r2, "Headline baris 2", T.end1 + 0.1]];
  for (i = 0; i < 2; i++) {
    var ht = HL[i][0], hr = HL[i][1], HLy = text(main, ht, HL[i][2]);
    under(HLy, NH); setPos(HLy, ht.lines[0].x - hd.box.x, ht.lines[0].base - hd.box.y);
    mask(HLy, rectS(hr.x - ht.lines[0].x - 10, hr.y - ht.lines[0].base, hr.w + 40, hr.h), MaskMode.ADD, "Batas baris");
    stagger(HLy, { t0: HL[i][3], d: 0.5, st: 0.05, words: true, pos: [0, 1.166 * ht.fs] });
    span(HLy, T.end1);
  }
  var HS = text(main, hd.sub, "Sub headline");
  under(HS, NH); setPos(HS, hd.sub.lines[0].x - hd.box.x, hd.sub.lines[0].base - hd.box.y);
  var sb = hd.subBox, sl = hd.sub.lines[0], sm0 = rectS(sb.x - sl.x - 6, sb.y - sl.base - 6, 1, sb.h + 12);
  var smk = mask(HS, sm0, MaskMode.ADD, "Buka ke kanan");
  keys(smk, [[T.end1 + 0.25, sm0, "expo.out"], [T.end1 + 0.7, rectS(sb.x - sl.x - 6, sb.y - sl.base - 6, sb.w + 20, sb.h + 12)]]);
  span(HS, T.end1);
  sep(NH);
  keys(tf(NH).property("ADBE Position_0"), [[T.toB + 0.1, hd.box.x, "expo.inOut"], [T.toB + 0.7, hd.box.x + P.head[0]]]);
  keys(tf(NH).property("ADBE Position_1"), [[T.toB + 0.1, hd.box.y, "expo.inOut"], [T.toB + 0.7, hd.box.y + P.head[1]]]);
  keys(scaleP(NH), [[T.toB + 0.1, S(100), "expo.inOut"], [T.toB + 0.7, S(P.head[2] * 100)]]);

  var MG4 = main.layers.add(cG); MG4.name = "Panel Angka"; span(MG4, T.g - 0.01, T.fly + 0.5);

  // client artwork: footer and BRImo QR, fade in and stay
  var FT = image(main, "assets/logos/footer-kiri.png", m.foot, "Footer klien");
  if (FT) { var fp = getPos(FT); keys(opac(FT), [[T.end1 + 0.3, 0, "power3.out"], [T.end1 + 0.8, 100]]); sep(FT); keys(tf(FT).property("ADBE Position_1"), [[T.end1 + 0.3, fp[1] + 24, "power3.out"], [T.end1 + 0.8, fp[1]]]); }
  var QC = cap(main, "kartu-qr", m.caps.qrcard, "Kartu QR (latar putih)"), QR = image(main, "assets/logos/brimo-qr.png", m.qr, "QR BRImo");
  var QL = [QC, QR];
  for (i = 0; i < 2; i++) {
    if (!QL[i]) continue;
    var qp = getPos(QL[i]);
    keys(opac(QL[i]), [[T.end1 + 0.4, 0, "power3.out"], [T.end1 + 0.9, 100]]);
    sep(QL[i]); keys(tf(QL[i]).property("ADBE Position_0"), [[T.end1 + 0.4, qp[0] + 60, "power3.out"], [T.end1 + 0.9, qp[0]]]);
  }

  var ME = main.layers.add(cE); ME.name = "Penutup";
  keys(opac(ME), [[T.close, 0, "power2.out"], [T.close + 0.3, 100]]);
  span(ME, T.close);

  // audio: music + SFX at the composition's times
  for (i = 0; i < D.audio.length; i++) {
    var au = D.audio[i], ai = imp(au.file);
    if (!ai) continue;
    var AL = main.layers.add(ai); AL.name = (au.id === "music" ? "Musik" : "SFX " + au.file.replace(/^.*\//, "")) + " @" + au.t;
    AL.startTime = au.t; AL.outPoint = Math.min(DUR, au.t + au.dur);
    try { var db = 20 * Math.log(Math.max(0.0001, au.vol)) / Math.LN10; AL.property("ADBE Audio Group").property("ADBE Audio Levels").setValue([db, db]); } catch (e) {}
    try { AL.moveToEnd(); } catch (e2) {}
  }

  main.openInViewer();
  app.endUndoGroup();
  var msg = "Selesai: komposisi \"" + D.name + "\" (" + W + "x" + H + ", " + DUR + " s).";
  if (WARN.length) msg += "\r\rCatatan:\r- " + WARN.join("\r- ");
  alert(msg);
})();
