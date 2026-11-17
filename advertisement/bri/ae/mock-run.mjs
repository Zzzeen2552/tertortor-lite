// mock-run.mjs <file.jsx>: runs a generated BRI .jsx against a recording mock of the After Effects DOM (no AE here).
// Catches JS errors (typos, undefined data, bad loops) and checks every matchName the script uses against a known list,
// every keyframe value for NaN, and that every imported file exists. It cannot prove AE accepts each call.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const file = process.argv[2];
const dir = path.dirname(path.resolve(file));
const src = fs.readFileSync(file, "utf8").replace(/^#target.*$/m, "");
const KNOWN = new Set(`ADBE Transform Group,ADBE Position,ADBE Position_0,ADBE Position_1,ADBE Anchor Point,ADBE Scale,ADBE Opacity,ADBE Rotate Z,
ADBE Effect Parade,ADBE Gaussian Blur 2,ADBE Gaussian Blur 2-0001,ADBE Gaussian Blur 2-0003,ADBE Fill,ADBE Fill-0002,CC Light Sweep,
ADBE Text Properties,ADBE Text Document,ADBE Text Animators,ADBE Text Animator,ADBE Text Animator Properties,ADBE Text Position 3D,
ADBE Text Opacity,ADBE Text Blur,ADBE Text Selectors,ADBE Text Expressible Selector,ADBE Text Range Type2,ADBE Text Expressible Amount,
ADBE Mask Parade,ADBE Mask Atom,ADBE Mask Shape,ADBE Root Vectors Group,ADBE Vector Group,ADBE Vectors Group,ADBE Vector Shape - Rect,
ADBE Vector Graphic - Stroke,ADBE Vector Graphic - Fill,ADBE Vector Filter - Trim,ADBE Vector Rect Size,ADBE Vector Rect Position,
ADBE Vector Rect Roundness,ADBE Vector Stroke Color,ADBE Vector Stroke Width,ADBE Vector Fill Color,ADBE Vector Trim End,
ADBE Vector Filter - Repeater,ADBE Vector Transform Group,ADBE Vector Anchor,ADBE Vector Position,ADBE Vector Scale,
ADBE Vector Repeater Copies,ADBE Vector Repeater Transform,ADBE Vector Repeater Position,ADBE Vector Repeater Rotation,
ADBE Audio Group,ADBE Audio Levels`.split(",").map((s) => s.trim()));
const stats = { layers: 0, comps: 0, keys: 0, expr: 0, masks: 0, unknown: new Set(), nan: [], missing: [] };

const isNum = (v) => typeof v === "number";
const bad = (v) => (Array.isArray(v) ? v.some(bad) : isNum(v) && !Number.isFinite(v));
function prop(name, init) {
  const p = {
    matchName: name, name, value: init, keysT: [], numKeys: 0, expression: "", dimensionsSeparated: false,
    propertyValueType: name === "ADBE Mask Shape" ? "SHAPE" : "OTHER", children: [], maskMode: 0,
    get numProperties() { return p.children.length; },
    property(k) {
      if (typeof k === "number") return p.children[k - 1] || prop("#" + k);
      if (!KNOWN.has(k) && !/^#/.test(k)) stats.unknown.add(k);
      let c = p.children.find((x) => x.matchName === k);
      if (!c) { c = prop(k, defaults(k)); p.children.push(c); }
      return c;
    },
    addProperty(k) { if (!KNOWN.has(k)) stats.unknown.add(k); const c = prop(k, defaults(k)); p.children.push(c); return c; },
    setValue(v) { if (bad(v)) stats.nan.push(`${name}=${JSON.stringify(v)}`); p.value = v; },
    setValueAtTime(t, v) { if (bad(v) || bad(t)) stats.nan.push(`${name}@${t}=${JSON.stringify(v)}`); p.keysT.push(t); p.numKeys++; stats.keys++; },
    setValuesAtTimes(ts, vs) { ts.forEach((t, i) => p.setValueAtTime(t, vs[i])); },
    nearestKeyIndex(t) { return p.keysT.indexOf(t) + 1; },
    setInterpolationTypeAtKey() {}, keyInInterpolationType() { return 1; }, keyOutInterpolationType() { return 1; },
    keyInTemporalEase() { return [{}]; }, keyOutTemporalEase() { return [{}]; },
    setTemporalEaseAtKey(k, a, b) { for (const e of [...a, ...b]) if (bad([e.speed, e.influence])) stats.nan.push(`${name} ease`); },
  };
  return new Proxy(p, { set(o, k, v) { if (k === "expression" && v) stats.expr++; o[k] = v; return true; } });
}
function defaults(k) {
  if (k === "ADBE Scale") return [100, 100, 100];
  if (k === "ADBE Anchor Point" || k === "ADBE Position") return [0, 0];
  if (k === "ADBE Position_0" || k === "ADBE Position_1") return 0;
  if (k === "ADBE Text Document") return { text: "", resetCharStyle() {}, resetParagraphStyle() {} };
  return 0;
}
function layer(name, src) {
  stats.layers++;
  const root = prop("layer");
  const L = { name, source: src, inPoint: 0, outPoint: 13, startTime: 0, parent: null, blendingMode: 0,
    property: (k) => root.property(k), moveToEnd() {}, moveToBeginning() {} };
  if (src) { L.property("ADBE Transform Group").property("ADBE Anchor Point").value = [src.width / 2, src.height / 2]; }
  return new Proxy(L, { set(o, k, v) { if (k === "parent" && v && v.name === undefined) throw new Error("bad parent"); if ((k === "inPoint" || k === "outPoint") && bad(v)) stats.nan.push(`${name}.${k}`); o[k] = v; return true; } });
}
function compItem(name, w, h) {
  if (bad([w, h])) stats.nan.push("comp size " + name);
  stats.comps++;
  const c = { name, width: w, height: h, layers: {
    add: (it) => layer(it.name, it), addText: (s) => layer("text:" + s), addNull: () => layer("null"), addShape: () => layer("shape"),
    addSolid: (col, n, w2, h2) => { if (bad([w2, h2]) || bad(col)) stats.nan.push("solid " + n); return layer(n, { width: w2, height: h2 }); },
  }, openInViewer() {} };
  return c;
}
const ctx = {
  $: { fileName: file }, alert: (m) => console.log("ALERT:", m.replace(/\r/g, "\n")),
  File: function (p) { this.fsName = p.replace(/[\\/][^\\/]*$/, "") || p; this.path = p; this.exists = fs.existsSync(p); if (!this.exists && !/\.jsx$/.test(p)) stats.missing.push(p); this.parent = { fsName: dir }; },
  ImportOptions: function (f) { this.file = f; },
  Shape: function () {}, KeyframeEase: function (speed, influence) { this.speed = speed; this.influence = influence; },
  KeyframeInterpolationType: { LINEAR: 1, BEZIER: 2, HOLD: 3 }, PropertyValueType: { SHAPE: "SHAPE" },
  ParagraphJustification: { LEFT_JUSTIFY: 1, CENTER_JUSTIFY: 2 }, MaskMode: { ADD: 1, SUBTRACT: 2, INTERSECT: 3 }, BlendingMode: { MULTIPLY: 5 },
  app: {
    project: { items: {
      addFolder: (n) => ({ name: n }), addComp: (n, w, h) => compItem(n, w, h),
    }, importFile: (io) => ({ name: io.file.path, width: 1000, height: 800, mainSource: {} }) },
    beginUndoGroup() {}, endUndoGroup() {}, newProject() {}, fonts: undefined,
  },
  Math, parseFloat, isNaN,
};
// File(...).parent for $.fileName must be the jsx folder; files are F(rel) = dir + "/" + rel
ctx.File = function File(p) { if (!(this instanceof File)) return new File(p); this.path = p; this.fsName = dir; this.exists = fs.existsSync(p); if (!this.exists && p !== file) stats.missing.push(p); this.parent = { fsName: dir }; };
ctx.app.project.importFile = (io) => { const p = io.file.path; return { name: path.basename(p), width: 1000, height: 800, mainSource: {} }; };
vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: file });
console.log(JSON.stringify({ comps: stats.comps, layers: stats.layers, keys: stats.keys, expressions: stats.expr, unknownMatchNames: [...stats.unknown], nan: stats.nan.slice(0, 10), nanCount: stats.nan.length, missing: stats.missing }, null, 1));
