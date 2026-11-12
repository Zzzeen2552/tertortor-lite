// gemini-api.mjs: one call to the Gemini API (key in .env GEMINI_API_KEY), used by tools/stories.mjs (Musafo story
// library). Model + fallbacks: brand.json → gemini.
// When Gemini cannot answer (no key, every model over quota/busy), the same request goes to a cheap Claude model
// through the Claude Code CLI (`claude -p --model haiku`, the user's own login; user 2026-11-04):
// brand.json → gemini.claudeFallback.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { extname, join, dirname, resolve } from "node:path";
import { tmpdir, homedir } from "node:os";
import { spawn } from "node:child_process";
import { ROOT, die, loadBrand } from "./lib.mjs";

export const MODEL = loadBrand().gemini?.model ?? "gemini-2.5-flash";
const MODELS = [MODEL, ...(loadBrand().gemini?.fallback ?? [])];
const CLAUDE = { cli: "claude", model: "haiku", ...(loadBrand().gemini?.claudeFallback ?? {}) };
// the native installer puts claude in ~/.local/bin, which a process started before PATH was updated (Studio from the
// Desktop shortcut) cannot see (2026-11-05): use that file directly when it exists
const NATIVE = join(homedir(), ".local", "bin", process.platform === "win32" ? "claude.exe" : "claude");
if (CLAUDE.cli === "claude" && existsSync(NATIVE)) CLAUDE.cli = NATIVE;

const parseOut = (out, json) => (json ? JSON.parse(out.replace(/^[\s\S]*?```json\s*|```[\s\S]*$/g, "").trim()) : out.replace(/^```\w*\s*|```$/g, "").trim());

// one headless Claude Code run: everything goes through stdin (the system text is long), only Read is allowed (to look
// at an attached image), and it runs from the temp folder so no project CLAUDE.md is loaded
function claudeCli({ system, text, image, json }) {
  const img = image && resolve(image);
  const prompt = `${system}\n\n---\n\n${text}${img ? `\n\nAn image is attached for this task: open ${img} with the Read tool and look at it before answering.` : ""}\n\n${json ? "Answer with the JSON object only: no prose before or after, no code fences." : "Answer with the final text only: no preamble, no code fences."}`;
  const args = ["-p", "--model", CLAUDE.model, "--output-format", "json", "--max-turns", "4", "--allowedTools", "Read", ...(img ? ["--add-dir", dirname(img)] : [])];
  return new Promise((ok, fail) => {
    // Windows: an npm .cmd shim only starts through cmd.exe; the native .exe starts directly (the args are fixed flags and a path)
    const direct = process.platform !== "win32" || /\.exe$/i.test(CLAUDE.cli);
    const [bin, argv] = direct ? [CLAUDE.cli, args] : [process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", CLAUDE.cli, ...args]];
    const c = spawn(bin, argv, { cwd: tmpdir(), windowsHide: true });
    let out = "", err = "";
    const timer = setTimeout(() => { c.kill(); fail(new Error("Claude CLI: tidak menjawab dalam 5 menit")); }, 300000);
    c.stdout.on("data", (d) => (out += d));
    c.stderr.on("data", (d) => (err += d));
    c.on("error", (e) => { clearTimeout(timer); fail(new Error(`Claude CLI tidak bisa dijalankan (${e.message}); pasang dengan npm i -g @anthropic-ai/claude-code lalu login sekali`)); });
    c.on("close", (code) => {
      clearTimeout(timer);
      let j;
      try { j = JSON.parse(out); } catch { return fail(new Error(`Claude CLI exit ${code}: ${(err || out).trim().slice(-300)}`)); }
      if (j.is_error || !j.result) return fail(new Error(`Claude CLI: ${String(j.result || j.subtype || "error").slice(0, 300)}`));
      console.log(`  claude ${CLAUDE.model} (cadangan Gemini)${j.total_cost_usd != null ? `: $${j.total_cost_usd.toFixed(4)} setara API` : ""}`);
      ok(j.result);
    });
    c.stdin.end(prompt);
  });
}

// soft: throw instead of exiting (Studio server calls this; a failed translation must not stop the server)
async function viaClaude(req, why) {
  if (CLAUDE.enabled === false) { if (req.soft) throw new Error(why); die(why); }
  console.log(`  ${why} → pakai Claude ${CLAUDE.model}`);
  try {
    return parseOut(await claudeCli(req), req.json);
  } catch (e) {
    if (req.soft) throw new Error(`${why}; cadangan Claude juga gagal: ${e.message}`);
    die(`${why}; cadangan Claude juga gagal: ${e.message}`);
  }
}

// every Gemini model over quota: skip Gemini for an hour instead of trying 4 models before each Claude call
const QUOTA = join(tmpdir(), "tertortor-gemini-quota.json");
const quotaUntil = () => { try { return JSON.parse(readFileSync(QUOTA, "utf8")).until ?? 0; } catch { return 0; } };

export async function gemini({ system, text, image, json, soft }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return viaClaude({ system, text, image, json, soft }, `GEMINI_API_KEY belum ada di ${join(ROOT, ".env")}`);
  if (quotaUntil() > Date.now()) return viaClaude({ system, text, image, json, soft }, `kuota Gemini habis (dicek ulang setelah ${new Date(quotaUntil()).toLocaleTimeString()})`);
  const parts = [{ text }];
  if (image) parts.push({ inline_data: { mime_type: extname(image).toLowerCase() === ".png" ? "image/png" : "image/jpeg", data: readFileSync(image).toString("base64") } });
  const body = {
    system_instruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts }],
    generationConfig: { temperature: 0.7, ...(json ? { responseMimeType: "application/json" } : {}) },
  };
  // 503 "high demand" is usually gone within seconds: retry. 429 = this model's quota is used up: try the next model
  // in brand.json → gemini.fallback (quotas are per model).
  let r, j, used;
  for (const m of MODELS) {
    used = m;
    // soft (Studio, someone waiting on a button): one 25 s try per model, then the next model
    for (let i = 0; i < (soft ? 1 : 3); i++) {
      // a hung request must not stall a whole book scan: give up after 3 minutes and treat it like "busy"
      try {
        r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body), signal: AbortSignal.timeout(soft ? 25000 : 180000) });
        j = await r.json();
      } catch (e) {
        r = { status: 503, ok: false };
        j = { error: { message: `no answer (${e.name})` } };
      }
      if (r.status !== 503) break;
      if (i < 2) await new Promise((ok) => setTimeout(ok, 3000 * 2 ** i));
    }
    if (r.status !== 429 && r.status !== 503) break;
    console.log(`  gemini ${m}: ${r.status}, trying the next model`);
  }
  // every Gemini model over quota / busy (or another API error): the same request to Claude
  if (r.status === 429) try { writeFileSync(QUOTA, JSON.stringify({ until: Date.now() + 3600e3 })); } catch {}
  if (!r.ok) return viaClaude({ system, text, image, json, soft }, `Gemini ${r.status}: ${(j.error?.message ?? JSON.stringify(j)).slice(0, 160)}`);
  const out = (j.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
  if (!out) return viaClaude({ system, text, image, json, soft }, `Gemini returned no text (${j.candidates?.[0]?.finishReason ?? "?"})`);
  const tokens = j.usageMetadata?.totalTokenCount;
  if (tokens) console.log(`  gemini ${used}: ${tokens} tokens`);
  return parseOut(out, json);
}
