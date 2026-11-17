// voice-clone.mjs: clone a voice for the voice-over (user 2026-11-17, from @heyartzy's ElevenLabs post: "a voice (yours,
// cloned)"). ElevenLabs Instant Voice Cloning (POST /v1/voices/add) turns 1-25 clean recordings (best: 1-3 minutes of one
// speaker, no music, no echo) into a voice id on the user's ElevenLabs account. TERTORTOR LITE then reads the whole script in that
// voice as ONE take with word timestamps (tools/tts.mjs elevenlabs, eleven_v3), exactly like any other ElevenLabs take, and
// `npm run swap` remakes single sentences in the same voice.
//
// A video uses a clone by its speaker: request.json → voiceSpeaker "clone:<id>" (picked in Studio like a Gemini speaker).
// Clones live in library/voices/clones.json (gitignored with the samples in library/voices/clones/<id>/). Only the user's own
// voice, or a voice whose owner agreed: `add` refuses without --consent (Studio: the checkbox). Needs ELEVENLABS_API_KEY in
// .env, which the user fills in themself (Instant Voice Cloning needs a paid ElevenLabs plan, Starter or higher).
//
//   node tools/voice-clone.mjs list
//   node tools/voice-clone.mjs add "<Nama>" <file> [file…] --consent [--desc "…"]
//   node tools/voice-clone.mjs sample <id>         one sample sentence → library/voices/clone-<id>.mp3 (played in Studio)
//   node tools/voice-clone.mjs remove <id>         deletes the voice on ElevenLabs too
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { ROOT, die, run } from "./lib.mjs";

const API = "https://api.elevenlabs.io/v1";
const DIR = join(ROOT, "library", "voices");
const STORE = join(DIR, "clones.json");
export const SAMPLE_TEXT = "Tahun itu, tidak ada yang percaya ia bisa berhasil. Tapi ia terus berjalan, satu langkah demi satu langkah.";

// read .env on every call (Studio keeps running while the user adds the key; lib.mjs only loads .env at start)
const envKey = () => {
  const f = join(ROOT, ".env");
  const m = existsSync(f) ? readFileSync(f, "utf8").match(/^\s*ELEVENLABS_API_KEY\s*=\s*(\S+)\s*$/m) : null;
  return m?.[1] || process.env.ELEVENLABS_API_KEY || "";
};
export const hasKey = () => !!envKey();
const headers = () => {
  const k = envKey();
  if (!k) throw new Error("ELEVENLABS_API_KEY belum diisi di .env (buat di elevenlabs.io → API Keys; clone suara butuh paket Starter ke atas).");
  return { "xi-api-key": k };
};

export const clones = () => { try { return JSON.parse(readFileSync(STORE, "utf8")); } catch { return []; } };
const save = (all) => { mkdirSync(DIR, { recursive: true }); writeFileSync(STORE, JSON.stringify(all, null, 2)); };
export const cloneById = (id) => clones().find((c) => c.id === id) ?? null;
export const sampleFile = (id) => join(DIR, `clone-${id}.mp3`);
const slug = (s) => String(s).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "suara";

// speaker "clone:<id>" in request.json → the clone; sets brand.voice.elevenlabsVoiceId so tts.mjs, takeKey and swap all follow
export function applyClone(dir, brand) {
  const f = join(dir, "request.json");
  const sp = existsSync(f) ? String(JSON.parse(readFileSync(f, "utf8")).voiceSpeaker || "") : "";
  if (!sp.startsWith("clone:")) return null;
  const c = cloneById(sp.slice(6));
  if (!c) die(`Suara clone "${sp.slice(6)}" tidak ada di library/voices/clones.json (dihapus?). Pilih speaker lain di tab Suara.`);
  brand.voice.elevenlabsVoiceId = c.voiceId;
  return c;
}

export async function addClone(name, files, { consent = false, desc = "" } = {}) {
  if (!consent) throw new Error("Clone hanya untuk suaramu sendiri atau suara yang pemiliknya sudah setuju: centang persetujuannya dulu.");
  const label = String(name || "").trim().slice(0, 40);
  if (!label) throw new Error("Beri nama suaranya.");
  if (!files.length) throw new Error("Unggah minimal satu rekaman (paling bagus 1-3 menit, satu orang bicara, tanpa musik).");
  const auth = headers(); // no key = stop before anything is copied
  let id = slug(label);
  while (cloneById(id)) id = `${id}-2`;
  const keep = join(DIR, "clones", id);
  mkdirSync(keep, { recursive: true });
  const form = new FormData();
  form.append("name", `TERTORTOR LITE · ${label}`);
  form.append("remove_background_noise", "true");
  form.append("description", desc || "Dibuat dari TERTORTOR untuk voice-over");
  form.append("labels", JSON.stringify({ language: "id", source: "tertortor" }));
  let seconds = 0;
  for (const [i, f] of files.entries()) {
    if (!existsSync(f)) throw new Error(`File tidak ada: ${f}`);
    const kept = join(keep, `${String(i + 1).padStart(2, "0")}${extname(f).toLowerCase() || ".wav"}`);
    copyFileSync(f, kept);
    const d = Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", kept]).stdout?.toString().trim()) || 0;
    seconds += d;
    form.append("files", new Blob([readFileSync(kept)]), basename(kept));
  }
  const r = await fetch(`${API}/voices/add`, { method: "POST", headers: auth, body: form, signal: AbortSignal.timeout(180e3) }).catch((e) => { rmSync(keep, { recursive: true, force: true }); throw e; });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.voice_id) { rmSync(keep, { recursive: true, force: true }); throw new Error(`ElevenLabs menolak (${r.status}): ${JSON.stringify(j.detail ?? j).slice(0, 300)}`); }
  const c = { id, name: label, voiceId: j.voice_id, seconds: Math.round(seconds), files: files.length, consent: true, createdAt: new Date().toISOString() };
  save([...clones(), c]);
  return c;
}

// one sentence in the clone's voice, so it can be heard before it is picked
export async function makeSample(id) {
  const c = cloneById(id) ?? die(`clone "${id}" tidak ada`);
  const r = await fetch(`${API}/text-to-speech/${c.voiceId}?output_format=mp3_44100_128`, {
    method: "POST", headers: { ...headers(), "content-type": "application/json" },
    body: JSON.stringify({ text: SAMPLE_TEXT, model_id: "eleven_v3", language_code: "id" }), signal: AbortSignal.timeout(120e3),
  });
  if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 300)}`);
  writeFileSync(sampleFile(id), Buffer.from(await r.arrayBuffer()));
  return sampleFile(id);
}

export async function removeClone(id) {
  const c = cloneById(id);
  if (!c) throw new Error(`clone "${id}" tidak ada`);
  const r = await fetch(`${API}/voices/${c.voiceId}`, { method: "DELETE", headers: headers(), signal: AbortSignal.timeout(60e3) });
  if (!r.ok && r.status !== 404) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 200)}`);
  save(clones().filter((x) => x.id !== id));
  rmSync(join(DIR, "clones", id), { recursive: true, force: true });
  rmSync(sampleFile(id), { force: true });
  return { removed: id };
}

if (process.argv[1]?.endsWith("voice-clone.mjs")) {
  const [cmd, ...rest] = process.argv.slice(2);
  const opt = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
  try {
    if (cmd === "list") { const all = clones(); console.log(all.length ? all.map((c) => `${c.id}  ${c.name}  (${c.seconds} s sampel, ${c.createdAt.slice(0, 10)})${existsSync(sampleFile(c.id)) ? "" : "  · belum ada sampel"}`).join("\n") : "Belum ada suara clone."); }
    else if (cmd === "add") {
      const files = rest.slice(1).filter((x, i, a) => !x.startsWith("--") && !(a[i - 1] === "--desc"));
      const c = await addClone(rest[0], files, { consent: rest.includes("--consent"), desc: opt("--desc") });
      console.log(`✔ clone "${c.name}" (${c.id}), speaker = clone:${c.id}`);
      await makeSample(c.id); console.log(`  sampel: ${sampleFile(c.id)}`);
    } else if (cmd === "sample") console.log(await makeSample(rest[0] ?? die("Usage: sample <id>")));
    else if (cmd === "remove") console.log(await removeClone(rest[0] ?? die("Usage: remove <id>")));
    else die('Usage: node tools/voice-clone.mjs list | add "<Nama>" <file…> --consent | sample <id> | remove <id>');
  } catch (e) { die(e.message); }
}
