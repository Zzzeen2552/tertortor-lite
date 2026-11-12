// voice-samples.mjs: one short sample per Gemini TTS speaker (brand.json → voice.gemini.voices), so the user can hear a
// voice before picking it in Studio (user 2026-11-07). Same sentence for every speaker, made once through the Gemini API
// (GEMINI_API_KEY in .env, model brand.json → voice.gemini.model) and kept in library/voices/<Name>.mp3, served by Studio
// as /files/library/voices/<Name>.mp3. Never used in a video: the narration is still one take per project.
//
//   node tools/voice-samples.mjs            make the missing samples
//   node tools/voice-samples.mjs --force    make all of them again (e.g. after changing the sentence)
import { existsSync, mkdirSync, writeFileSync, appendFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ROOT, loadBrand, run, die } from "./lib.mjs";

export const SAMPLE_DIR = join(ROOT, "library", "voices");
export const sampleFile = (name) => join(SAMPLE_DIR, `${name}.mp3`);
const TEXT = "Umur sembilan tahun, ia naik kapal sendirian ke negeri asing. Tidak ada yang menyangka, anak kecil itu kelak bangkrut empat kali, dan selalu bangkit lagi.";
const STYLE = "Bacakan dengan hangat seperti pendongeng, tempo sedang, ada jeda kecil sebelum kalimat kedua: ";

if (process.argv[1]?.endsWith("voice-samples.mjs")) {
  const g = loadBrand().voice?.gemini ?? {};
  const key = process.env.GEMINI_API_KEY;
  if (!key) die("GEMINI_API_KEY belum ada di .env");
  const force = process.argv.includes("--force");
  mkdirSync(SAMPLE_DIR, { recursive: true });
  let tokens = 0, made = 0;
  for (const v of g.voices ?? []) {
    if (!force && existsSync(sampleFile(v.name))) { console.log(`• ${v.name} sudah ada`); continue; }
    // the TTS model allows only a few requests a minute: on 429, wait and try again
    let r, j;
    for (let i = 0; i < 5; i++) {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${g.model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ contents: [{ parts: [{ text: STYLE + TEXT }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: v.name } } } } }),
        signal: AbortSignal.timeout(120000),
      });
      j = await r.json();
      if (r.status !== 429) break;
      console.log(`  ${v.name}: batas per menit, tunggu 30 s`);
      await new Promise((ok) => setTimeout(ok, 30000));
    }
    const part = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
    if (!r.ok || !part) { console.error(`✖ ${v.name}: ${r.status} ${(j.error?.message ?? "tanpa audio").slice(0, 160)}`); continue; }
    // audio/wav, or raw PCM (audio/L16;rate=24000) from older models
    const raw = join(tmpdir(), `tts-${v.name}.bin`);
    writeFileSync(raw, Buffer.from(part.data, "base64"));
    const pcm = /L16|pcm/i.test(part.mimeType);
    const rate = part.mimeType.match(/rate=(\d+)/)?.[1] ?? "24000";
    run("ffmpeg", ["-y", "-v", "error", ...(pcm ? ["-f", "s16le", "-ar", rate, "-ac", "1"] : []), "-i", raw, "-af", "loudnorm=I=-16:TP=-1.5", "-c:a", "libmp3lame", "-b:a", "96k", sampleFile(v.name)]);
    unlinkSync(raw);
    tokens += j.usageMetadata?.totalTokenCount ?? 0;
    made++;
    console.log(`✔ ${v.name} → library/voices/${v.name}.mp3`);
  }
  if (made) appendFileSync(join(SAMPLE_DIR, "costs.md"), `- ${new Date().toISOString().slice(0, 10)}: ${made} sampel suara, Gemini API ${g.model}, ${tokens} token\n`);
  console.log(`${made} sampel dibuat, ${tokens} token`);
}
