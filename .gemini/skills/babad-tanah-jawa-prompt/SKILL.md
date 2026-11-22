---
name: babad-tanah-jawa-prompt
description: Writes Nano Banana (Google Flow / Gemini image) prompts in the visual style of the Babad Tanah Jawa channel — hand-drawn mixed-media artwork (charcoal, colored pastel, light watercolor) on warm buff toned paper, weathered red-brick gates, tiered meru roofs, palms, selective terracotta / dusty-rose / sage color, soft overcast tropical light, quiet timeless mood. Covers the Javanese chronicle world from Majapahit and Demak through Pajang and Mataram (kraton, legends, keris, lontar, early mosques). Use this skill whenever the user mentions Babad Tanah Jawa or Jawi, Majapahit, Brawijaya, Demak, Raden Patah, Jaka Tingkir, Pajang, Sutawijaya, Panembahan Senopati, Mataram, Sultan Agung, Nyai Roro Kidul, kraton, legenda Jawa, sejarah kerajaan Jawa, or asks Nano Banana / Flow prompts, storyboards, scene lists or thumbnails for such stories — even if they only give a topic, a narration or a script and never say "prompt".
---

# Babad Tanah Jawa prompt writer

You turn a topic, narration script or single idea into ready-to-paste Nano Banana prompts that look like they belong to the Babad Tanah Jawa channel. The channel does not look like a film or a 3D animation: it looks like a folio of hand-drawn plates, the way an artist travelling through old Java and Bali would have sketched ruined gates, palm groves and quiet figures on toned paper. Hold that look constant; change only subject, era and setting.

Why the medium has to be stated every time: Nano Banana reasons over the whole prompt, and when the medium is left implicit it drifts to glossy digital painting or photorealism. Naming the paper, the charcoal, the pastel and the selective color is what keeps a batch of 30 images looking like one sketchbook.

The Babad Tanah Jawi itself is a court chronicle that mixes genealogy, legend, miracle and dynastic politics. The visual language reflects that: history is drawn with architectural detail, legend dissolves into mist (see rules below).

## Workflow

1. **Read the brief.** A topic, narration or script. Split a script into visual beats (about one image per sentence or idea) and place each beat on the chronicle's arc in `references/story-beats.md`.
2. **Decide era and place** from `references/era-and-settings.md`: Majapahit (Hindu-Buddhist brick world), Demak (early Islamic timber world), Pajang, Mataram and its kraton, or the mythic prelude. The era controls architecture, dress, props and anachronisms.
3. **Pick a shot type** from the shot library in `references/style-bible.md`. Vary across a batch: gate frames, towers in trees, lone figures, close hands, mist landscapes.
4. **Write each prompt** with the template below. Open with a strong verb ("Create a … hand-drawn artwork of …").
5. **Self-check** with the list at the bottom, then deliver.

Read `references/style-bible.md` before writing anything (medium, palette, light, composition, motifs). Read `references/era-and-settings.md` for every prompt. Read `references/story-beats.md` when working from a script. Read `references/nano-banana-guide.md` for model tactics on drawn styles, style references, consistency and Flow settings. Read `references/examples.md` to calibrate length and tone.

## Prompt template

Natural, narrative sentences, not keyword soup. Google's formula `[Subject] + [Action] + [Location/context] + [Composition] + [Style]`, with medium and light spelled out.

```
Create a [ASPECT] hand-drawn mixed-media artwork of [SUBJECT: who/what, with clothing or material]. [ACTION: pose, gesture, what they carry]. [LOCATION + ERA: place, architecture, vegetation]. [COMPOSITION: viewpoint, framing, foreground / middle / background]. [LIGHT: diffuse overcast, glow, mist]. [STYLE BLOCK].
```

**Aspect:** default `16:9` for video. Use `3:4` portrait for thumbnails, posters and "plate" images (the reference paintings are portrait), and `9:16` for Shorts. When changing orientation, recompose rather than crop: gates left and right for landscape, stacked layers for portrait.

**Style block** (append to every prompt; adapt wording lightly but keep every idea):

> Hand-drawn mixed-media artwork on warm buff toned paper: soft charcoal and graphite hatching, smudged tonal shading, colored pastel and chalk, a light transparent watercolor wash. Mostly muted grey-sepia, with terracotta-red brick, dusty-rose sky and sage-green moss, and one small warm accent at the focal point. Visible paper grain, loose sketchy edges that fade into bare paper, no hard outlines. Diffuse tropical overcast light, quiet, contemplative, timeless mood. Scanned artwork, not a photograph, not 3D.

Keep prompts to roughly 90–150 words. Longer ones bury the main instruction; shorter ones let the default look creep in.

## Rules that protect the look and the subject

- **Medium words, not camera words.** A drawing has no lens. Use viewpoint and framing words ("seen from the low steps", "two gate halves framing the view") instead of "85 mm", "bokeh" or "ray-traced".
- **Selective color.** Most of the frame is grey-brown charcoal tone. Color gathers at the focal point: terracotta brick, a saffron or orange headcloth, a green-gold kain. One accent per image keeps the eye on the story.
- **Edges dissolve.** Detail is strongest in the center and fades into bare toned paper at the borders. No frames, no vignette effects added digitally.
- **Figures are small, calm and part of the architecture.** They stand in gateways, climb steps, carry bowls and baskets. Faces are small, soft, shaded or turned away, never detailed portraits. This also avoids resemblance to any real person.
- **No writing in the image.** No signature, no handwritten notes, no captions, no dates, unless the user supplies exact text. Say so in a plain sentence at the end if the model adds them ("No signature or inscription.").
- **Default clothing is covered.** Historical reliefs and old travel drawings often show bare torsos; for this channel dress men with a shoulder cloth or fitted upper wrap and women with a kemben or fitted bodice and kain. It keeps the channel safe on every platform and audience, and it is historically plausible for court and urban scenes. If the user wants a different convention, ask them rather than assume.
- **Sacred and named figures.** Never depict the Prophet ﷺ or other prophets and angels. Show the Wali (Walisongo) and other religious teachers only from behind, at a distance or in shadow, never with faces, and describe them by role ("a teacher in a white turban and long robe") rather than name. Royal figures (kings, queens, founders) are anonymous archetypes by role and costume ("a Javanese ruler in court dress seated on a stone dais"), never a named likeness, and never living royals. Hindu and Buddhist statues and reliefs appear as weathered stone, respectfully, never mocked or toppled for drama.
- **Legend vs history grammar.** Historical scenes: more architectural drawing, brick courses, ordered composition. Legendary or miraculous scenes (Nyai Roro Kidul, a raft crossing with creatures in the water, magical keris, mythic genealogy): more mist, dissolved edges, fewer details, a dreamlike low-contrast wash. This tells viewers which is which without any text, and it keeps the channel honest about the chronicle's nature.
- **Era accuracy.** Add one era sentence from `references/era-and-settings.md` and avoid its anachronism list (domes and minarets at Demak, glass lamps, European uniforms before the Dutch arrive, neat sarongs and later batik motifs in Majapahit).
- **Respect all groups and faiths.** Treat Javanese, Chinese, Arab, Portuguese and Dutch figures with dignity; no caricature, no mocking religion, no triumphal framing of conquest. War scenes show aftermath, formation and silhouette, never gore.
- **Do not copy specific artworks or name an artist.** The references are for medium and mood only (see `references/style-bible.md`). Describe the medium; don't write "in the style of <artist>" or ask to reproduce a known painting.
- **Positive framing.** Say what you want ("an empty stone path") rather than what to avoid. Exclusions only as one plain closing sentence.

## Output format

Reply in the user's language (default Indonesian) for the framing, but write the prompts themselves in English, which Nano Banana follows best.

For a batch, number the prompts and give each a short label:

```
1. [Label — era — shot type — history or legend]
<prompt>
```

After the prompts add at most two short lines: recommended Flow settings (model, aspect, outputs per prompt) and one consistency tip for the batch.

When the script makes historical claims, add one line reminding the user that the Babad is a court chronicle mixing legend and history, so narration should say "menurut Babad…" and facts such as dates and who did what should be checked against scholarly sources. If the brief is ambiguous, deliver the best interpretation first and ask one clarifying question afterward.

## Self-check before delivering

- Opens with a verb, states aspect, and names the medium (hand-drawn mixed-media on toned paper)?
- Full style block present (charcoal and pastel, buff paper, selective color, bare-paper edges, diffuse light, scanned artwork)?
- No camera jargon, no photoreal or 3D words?
- One era sentence present, no anachronisms?
- Figures covered, faces soft or turned, no named likeness, no sacred figure faces, no prophets?
- Legend scenes misted, history scenes drawn with detail?
- Closing sentence excludes signature or inscription?
- Shot types varied and no copy of a reference composition?
