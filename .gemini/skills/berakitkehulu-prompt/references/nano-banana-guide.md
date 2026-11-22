# Nano Banana prompting guide (Google Flow and Gemini)

Synthesized from Google Cloud's "Ultimate Nano Banana prompting guide" (Mar 2026), Google's Nano Banana Pro prompting tips, and community guides, researched Nov 2026. Model names change quickly; check the current picker in Flow before quoting specifics.

## Contents
1. Model landscape
2. Core principles
3. Formulas
4. Vocabulary for the BerakitKeHulu look
5. Character consistency across ages
6. Reference images
7. Editing instead of re-rolling
8. Text on signs and props
9. Flow settings
10. Troubleshooting
Sources

## 1. Model landscape

- **Nano Banana (Gemini 2.5 Flash Image):** original fast model, about 1K output.
- **Nano Banana Pro (Gemini 3 Pro Image):** "thinking" model, best fidelity and text rendering, 1K/2K/4K, up to 14 reference images, supports style references.
- **Nano Banana 2 (Gemini 3.1 Flash Image, Feb 26 2026):** faster, default in the Gemini app and Flow, 512px to 4K, wide aspect ratios including 16:9 and 9:16, strong multi-reference consistency.
- Both Gemini 3 models reason about the prompt first, so narrative direction beats keyword lists.

Practical choice: draft with Nano Banana 2, finish key frames (hero portraits, thumbnails, anything with text) with Nano Banana Pro.

## 2. Core principles (from Google)

1. Be specific about subject, lighting and composition.
2. Use positive framing: describe what you want ("empty street") rather than what to avoid.
3. Control the camera with photographic terms (low angle, 50 mm, shallow depth of field).
4. Iterate conversationally.
5. Start with a strong verb ("Create an image of…", "Generate an image of…") so the model returns an image, not text.
6. Skip spam keywords ("8k, masterpiece"); they no longer help.
7. Put the most important instruction first; if details are ignored, simplify and add them back one at a time.

## 3. Formulas

- **Text-to-image:** `[Subject] + [Action] + [Location/context] + [Composition] + [Style]`
- **With references:** `[Reference images] + [Relationship instruction] + [New scenario]`, with one role per image ("Image 1 for the character, Image 2 for the style").
- **Editing:** state the change, then what must stay ("Keep the face, clothes and street exactly as they are; change only the sky to golden hour").

## 4. Vocabulary for the BerakitKeHulu look

- **Look:** stylized 3D render, heightened realism, Pixar-like expressive faces, tactile weathered materials.
- **Light:** soft overcast, hazy tropical sun, golden-hour side light, hanging tungsten bulbs, window light shafts with dust, blue-hour with orange lantern bokeh.
- **Camera:** 35 mm for streets, 50 mm for portraits, 85 mm close-ups, f/2 shallow depth of field, low angle for pride, over-the-shoulder for dialogue, wide-angle for harbors.
- **Grade:** muted sepia and ochre with a faded teal sky; one saturated accent; subtle film grain and vignette.
- **Material words:** burlap, wicker, frayed linen, rusted steel, brass, wet cobblestone, peeling plaster, enamel sign.

## 5. Character consistency across ages

Stories follow one hero from boy to elder, so consistency is the hardest and most important job.

1. Write the protagonist ladder in `style-bible.md` (one fixed sentence per age) and paste it verbatim in every prompt of that age.
2. Generate a **character sheet** first: "Create a character sheet of [boy description] showing front, three-quarter and side views on a plain warm grey background, neutral expression, full body." Keep the best one.
3. Attach the sheet as a reference to each later prompt: "Use the attached character sheet for the boy's face, hair and build. Keep clothing and expression as described below."
4. For an aged version, attach the younger sheet and say: "The same person thirty years later: keep the eye shape, nose and jawline, add grey hair at the temples and a tailored suit."
5. Keep supporting archetypes fixed the same way (the vendor, the craftsman, the merchant).
6. Anchor with concrete traits (hair texture, eye shape, a freckle pattern), not names.

## 6. Reference images

- Up to 14 references on Pro; practical set is a character sheet plus one or two style frames from the channel.
- Style frame instruction: "Match the color grade, grain, face style and material rendering of the attached reference; do not copy its composition."
- In Flow, characters and references can be attached as ingredients to image generation.

## 7. Editing instead of re-rolling

If the image is about 80% right, ask for one change: "Keep everything the same, but make the sky hazier and shift the light to golden hour." Change one variable per iteration, and name what must stay before naming the change.

## 8. Text on signs and props

- Put exact words in quotes; name the font style and material ("white serif capitals on a dark blue enamel signboard").
- Keep it to 1–3 words per sign; short text renders best.
- When text matters (title cards, price tags, ledger headings), render with Nano Banana Pro and check spelling.
- For a long caption, generate the text concept in conversation first, then ask for the image with that text.
- Never ask for real brand logos; add them in editing if the channel has the rights.

## 9. Flow settings

- Choose the image model (Nano Banana Pro, Nano Banana 2, Imagen), aspect ratio **16:9** (9:16 for Shorts), and 2–4 outputs per run.
- Generate several variants and pick the best rather than rewriting the prompt blindly.
- Images can serve as start or end frames for video (Veo). For animation-ready frames keep one clear subject, a simple background and one dominant light direction; ask for a gentle camera move in the video prompt (slow push-in, drifting dust).

## 10. Troubleshooting

| Problem | Fix |
|---|---|
| Looks too glossy or photoreal | Strengthen "stylized 3D render, heightened realism, Pixar-like expressive faces, matte tactile materials, film grain" |
| Wrong era details | Add the era sentence from `era-and-settings.md`; list what is absent ("no modern signage, no plastic") as a plain sentence |
| People look generic East Asian or Western | Name the heritage in the first words ("a Javanese boy with tawny-brown skin"), describe regional dress, and add tropical setting cues; attach an Indonesian-looking character sheet |
| Setting looks like a European or Chinese town | Add coconut palms, banana plants, flamboyant trees, deep eaves, verandas and a named Indonesian city; say "in a Javanese port city" |
| Hero looks different each time | Paste the fixed description verbatim and attach a character sheet |
| Palette too neon or orange-teal | Say "muted sepia and ochre with a faded teal sky, one saturated accent" |
| Misspelled sign text | Shorten to 1–3 words, put in quotes, regenerate with Pro |
| Faces too bland | Specify brows, eyes and mouth ("brows pinched, tired but stubborn eyes, mouth pressed flat") |
| Crowded background | "Softly blurred background with only one or two distant figures" |
| Output arrives as text | Open with "Create an image of" |

## Sources

- Google Cloud Blog, "The ultimate Nano Banana prompting guide" (Mar 5 2026): https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-nano-banana
- Google, "7 tips to get the most out of Nano Banana Pro": https://blog.google/products-and-platforms/products/gemini/prompting-tips-nano-banana-pro/
- DEV Community, "Nano-Banana Pro: Prompting Guide & Strategies": https://dev.to/googleai/nano-banana-pro-prompting-guide-strategies-1h9n
