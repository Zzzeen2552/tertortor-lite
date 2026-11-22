---
name: berakitkehulu-prompt
description: Writes Nano Banana (Google Flow / Gemini image) prompts in the signature visual style of the BerakitKeHulu channel — cinematic stylized 3D with heightened realism, Pixar-like expressive faces, tactile gritty materials, muted sepia-ochre-teal palette with a few red/orange accents, shallow depth of field, 16:9 frames. The channel tells rags-to-riches stories of Indonesian business founders and conglomerates from the colonial, Japanese-occupation, revolution and early-independence eras. Use this skill whenever the user mentions BerakitKeHulu, Berakit ke Hulu, "prompt untuk channel", konglomerat, pengusaha, Tionghoa / Peranakan pengusaha, tokoh bisnis, perjuangan dari nol, jaman penjajahan, jaman Jepang, masa perang, revolusi, Hindia Belanda, kisah pendiri perusahaan, or asks Nano Banana / Flow prompts, storyboards, scene lists or thumbnails for such stories — even if they only give a topic, a script or a narration and never say "prompt".
---

# BerakitKeHulu prompt writer

> **Di MOTION (proyek Berakit ke Hulu/BKH, skill `/berakit-ke-hulu`), user 2026-11-07:** selalu **9:16**, bukan 16:9: "Create a cinematic vertical
> 9:16 image of …", kedalaman ditumpuk vertikal, subjek di dua pertiga bawah, konteks era di atas, sepertiga bawah tanpa
> teks (caption). Style block di akhir prompt = `brand.json → berakitkehulu.styleAnchor` **persis** (`node tools/musafo.mjs
> check` menolak bila tidak ada). Tanpa teks di gambar kecuali user memberi tulisan papan; logo merek nyata tidak pernah
> di-generate. Contoh di `references/` tetap 16:9; ambil isinya, ubah rasionya.
> Bila user memberi foto asli tokoh, wajahnya mengikuti character sheet dari foto itu (skill `/berakit-ke-hulu` § Tokoh),
> menimpa aturan "invented people, not likenesses" di bawah; nama asli tetap tidak masuk prompt.

You turn a topic, narration script or single idea into ready-to-paste Nano Banana prompts that look like they belong to the BerakitKeHulu channel. The channel's name comes from the proverb about rowing upstream first and enjoying the shore later: every story is struggle first, reward after. The visuals must make a viewer feel the dust, the hunger and the stubbornness, then the slow rise.

The look is constant; scenes change. Every prompt carries the same style block and differs only in subject, era and setting. That is what keeps a 40-image documentary looking like one film.

Why the style is spelled out every time: Nano Banana reasons over the whole prompt and follows natural-language direction well, but it drifts toward glossy modern AI imagery (clean skin, saturated teal-orange, generic old-timey sepia) when light, material and era are left implicit.

## Workflow

1. **Read the brief.** A topic, a narration script, or a list of scenes. For a script, split into visual beats (roughly one image per sentence or idea) and place each beat on the story arc and in an era (see `references/story-beats.md`).
2. **Choose the people and place.** Decide the hero's heritage (Javanese, Sundanese, Minang, Bugis, Batak, Madurese, Betawi, Peranakan Chinese-Indonesian, etc.) and the city or region (Batavia, Surabaya, Semarang, Medan, Makassar, Bandung, Padang, a Javanese village, etc.) from the story. Use "People and places" in `references/era-and-settings.md`.
3. **Choose the era** for each beat from `references/era-and-settings.md`: colonial Hindia Belanda, Japanese occupation, revolution, 1950s–60s, or modern growth. Era decides architecture, clothing, vehicles, props and signage.
4. **Choose a shot type** from the shot library in `references/style-bible.md`. Vary across a batch: wide and intimate, crowd and solitary, faces and hands.
5. **Write each prompt** with the template below, opening with a strong verb ("Create a cinematic 16:9 image of…").
6. **Self-check** against the list at the bottom, then deliver.

Read `references/style-bible.md` before writing anything: it holds palette, light, materials, character design and framing extracted from the channel's reference images and video. Read `references/era-and-settings.md` for every prompt (era accuracy is half the channel's credibility). Read `references/story-beats.md` when turning a script into a shot list. Read `references/nano-banana-guide.md` for model tactics: reference images, character consistency across ages, text on signs, Flow settings. Read `references/examples.md` to calibrate length and tone.

## Prompt template

Natural, narrative sentences, not keyword soup. Google's formula `[Subject] + [Action] + [Location/context] + [Composition] + [Style]`, with light and material spelled out.

```
Create a cinematic 16:9 image of [SUBJECT: age, heritage, role, expression, clothing with material/wear]. [ACTION: what they are doing, what they hold]. [LOCATION + ERA: place, year-feel, architecture, signage]. [COMPOSITION: shot size, lens, angle, depth of field, foreground/background]. [LIGHT: source, direction, time of day, haze]. [STYLE BLOCK].
```

**Style block** (append to every prompt; adapt wording lightly but keep every idea):

> Cinematic stylized 3D render with heightened realism: Pixar-like expressive faces with slightly enlarged eyes and softly exaggerated proportions, set against tactile real-world materials (burlap, wicker, worn linen, rusted steel, cracked plaster, wet cobblestones). Muted warm earth palette of sepia brown, dusty ochre and faded teal-blue sky, with one or two saturated accents. Soft atmospheric haze, shallow depth of field with a gently blurred background, subtle film grain. Gritty but hopeful mood.

Keep prompts to roughly 90–150 words. Longer ones bury the main instruction; shorter ones let the default look creep in.

## Rules that protect the look and the story

- **Faces are expressive.** Unlike a faceless style, this channel lives on emotion: tired, worried, determined, startled, laughing. Name the expression and the eyes ("brows lifted and pinched together, tired but stubborn eyes"). Skin should be smooth and slightly stylized, with honest dirt, sweat or freckles for the poor and cleaner finish for later success.
- **Struggle is tactile.** Torn hems, rolled sleeves, bare feet, dirty cuffs, calloused hands, patched sacks, cracked walls. Wealth shows gradually: first a shirt without holes, then a vest, then a tailored suit.
- **Materials over decoration.** Describe what things are made of; avoid ornate clutter.
- **Light follows the mood.** Hazy overcast day for hardship, warm tungsten bulbs and window shafts for interiors, blue-hour with orange lantern bokeh for night markets, golden hour for hope or victory.
- **Color accents with purpose.** One saturated accent per frame (a red roasting machine, a red shirt, orange lanterns, a green plant) so the eye lands on the story object.
- **People look Indonesian.** Everyone in the frame is Indonesian by default, and the heritage goes into the subject sentence ("a Javanese boy", "a Minang trader", "a Peranakan Chinese-Indonesian shopkeeper"). Without that anchor the model drifts to generic East Asian or Western faces and costumes. Use the appearance anchors and regional clothing in `references/era-and-settings.md`, and keep crowds visibly mixed (Javanese, Sundanese, Betawi, Chinese-Indonesian, Arab-Indonesian, Indo-European), because that is what Indonesian port cities looked like.
- **Chinese-Indonesian founders are Indonesians.** Many of the channel's subjects are Tionghoa (Peranakan or Totok). Show them as people of this archipelago: Indonesian shophouse neighborhoods, Indonesian streets, kebaya encim and cotton jackets, tropical surroundings, mixed customers and neighbors. Give them individual, dignified features and expressions; never caricature (no exaggerated eyes, teeth or gestures, no money-hungry tropes). Their struggles, loyalties and warmth carry the story, not their ethnicity.
- **Places look Indonesian and tropical,** not like a European town. Add tropical cues every time: coconut palms, banana plants, flamboyant or rain trees, humid haze, deep roof eaves and verandas, stained whitewash, monsoon clouds, kampung bamboo houses at the edges, warung and pasar life.
- **Same hero across ages.** Keep a fixed character description for the protagonist at each life stage (see `references/style-bible.md`) and reuse the exact sentence in every prompt.
- **Era accuracy.** Add one era sentence from `references/era-and-settings.md` and avoid its anachronism list (modern plastic, LED, 21st-century signage, wrong uniforms).
- **Invented people, not likenesses.** The stories are about real founders, but prompts describe archetypes by age, role and look ("a skinny barefoot boy with messy black hair"), never real people's names or likenesses. The narration carries the names. Why: it avoids putting a made-up face on a real person and keeps the channel safe from misrepresentation.
- **Brands and logos.** Don't reproduce real company logos or trademarked packaging. For signage use short period-style text the user supplies or invented generic names (see text rules below); describe packaging as "a paper coffee bag with a simple emblem" and let the editor add the real mark in post.
- **War and hardship with restraint.** Show scarcity, queues, fear, resilience and aftermath, never gore. Treat every group (Indonesian, Chinese-Indonesian, Dutch, Japanese, Arab, Indian) with dignity; no caricatured features or stereotyped gestures; villains are shown by situation and posture, not ethnicity.
- **Text in images.** Put exact words in quotes, name the style ("white serif capitals on a dark blue enamel sign"), keep it to a few words, and prefer period wording ("NV", "Toko", "Handel Maatschappij"). If the user gave no text, leave signs blurred or blank.
- **Positive framing.** Say what you want ("empty cobblestone street") not what to avoid. State a must-exclude as a plain sentence at the end.

## Output format

Reply in the user's language (default Indonesian) for the framing, but write the prompts themselves in English, which Nano Banana follows best.

For a batch, number the prompts and give each a short label:

```
1. [Label — era — shot type]
<prompt>
```

After the prompts add at most two short lines: recommended Flow settings (model, 16:9, outputs per prompt) and one consistency tip for the batch. If the brief is ambiguous, deliver the best interpretation first and ask one clarifying question afterward.

If the user wants vertical (Shorts/Reels), change "16:9" to "9:16" and recompose: stack depth vertically, put the subject in the lower two-thirds and the era context above.

## Self-check before delivering

- Opens with a verb and states the aspect ratio?
- Full style block present (stylized 3D, heightened realism, muted earth palette, haze, shallow DOF, grain)?
- Expression and clothing wear specified for each person?
- Era sentence present, no anachronisms?
- Heritage named for each person, regional clothing right, tropical cues present, no stereotype?
- Light source and direction named; one accent color?
- No real names, likenesses or real logos; any text in quotes?
- Shot types varied; protagonist description identical across the batch for the same age?
