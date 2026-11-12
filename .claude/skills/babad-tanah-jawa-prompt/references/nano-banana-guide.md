# Nano Banana prompting guide for drawn styles (Google Flow and Gemini)

Synthesized from Google Cloud's "Ultimate Nano Banana prompting guide" (Mar 2026), Google's Nano Banana Pro prompting tips, and community guides, researched Nov 2026, then adapted to a hand-drawn medium. Model names change quickly; check the picker in Flow before quoting specifics.

## Contents
1. Model landscape
2. Core principles
3. Formulas
4. Vocabulary for the Babad Tanah Jawa look
5. Style references and consistency
6. Editing instead of re-rolling
7. Text and inscriptions
8. Flow settings and animating plates
9. Troubleshooting
Sources

## 1. Model landscape

- **Nano Banana (Gemini 2.5 Flash Image):** the original fast model, about 1K output.
- **Nano Banana Pro (Gemini 3 Pro Image):** "thinking" model with the best fidelity and text rendering, 1K/2K/4K, up to 14 reference images, style references.
- **Nano Banana 2 (Gemini 3.1 Flash Image, Feb 26 2026):** faster, default in Gemini and Flow, 512px to 4K, wide aspect ratios (16:9, 9:16, 3:4), strong multi-reference consistency.
- Both Gemini 3 models reason about the prompt before drawing, so narrative direction beats keyword lists.

Practical choice: draft with Nano Banana 2; finish thumbnails and hero plates with Nano Banana Pro.

## 2. Core principles (from Google)

1. Be specific about subject, light and composition.
2. Positive framing: describe what you want ("an empty stone path"), not what to avoid.
3. Control the framing with explicit terms; for a drawn style use viewpoint and composition words rather than lens jargon.
4. Iterate conversationally.
5. Open with a strong verb ("Create a … hand-drawn artwork of …") so the model returns an image.
6. Skip spam keywords ("8k, masterpiece, trending"): they push the model toward polished digital art, the opposite of this style.
7. Put the most important instructions first; if details are ignored, simplify and add them back one at a time.

## 3. Formulas

- **Text-to-image:** `[Subject] + [Action] + [Location/context] + [Composition] + [Style]`
- **With a style reference:** `[Reference image] + [Relationship instruction] + [New scenario]` — "Match the medium, paper tone, hatching and selective color of the attached image; do not copy its composition or subjects. New scene: …"
- **Editing:** change, then what must stay ("Keep the gate, the path and the paper texture exactly as they are; make the sky hazier").

## 4. Vocabulary for the Babad Tanah Jawa look

- **Medium:** hand-drawn mixed-media artwork, charcoal and graphite hatching, smudged tonal shading, colored pastel and chalk, light watercolor wash, scanned artwork.
- **Support:** warm buff toned paper, visible paper grain, bare paper at the edges.
- **Color:** muted grey-sepia, terracotta-red brick, dusty-rose sky, sage moss, one small warm accent.
- **Light:** diffuse overcast, soft shadowless tonal shading, faint warm glow near the horizon, heavy mist for legend scenes.
- **Framing:** two broken gate halves framing the view, seen from the low steps, a figure small in the threshold, large calm empty paper.
- **Words to avoid:** photograph, photorealistic, 3D render, 4K, ray-traced, cinematic, bokeh, HDR, lens flare.

## 5. Style references and consistency

- **Bootstrap your own reference.** Generate a few plates by text prompt, choose the one that best matches the channel's mood, and use that generated image as the style reference for the rest of the series. This keeps the style locked to the channel's own output.
- If you attach external artworks as references, make sure you have the right to use them; many 20th-century paintings are still under copyright. Use them to guide the medium and mood only, with the instruction not to copy composition or subjects.
- Repeat the same style-block sentence verbatim across a batch, and change only the scene sentences.
- Recurring characters are minor in this style (faces are small and soft), but keep costume sentences fixed ("a Javanese woman in a saffron headcloth and a green-gold kain") so a figure reads as the same person across plates.
- Up to 14 references on Pro; practical set is one style reference plus one scene reference.

## 6. Editing instead of re-rolling

If a plate is about 80% right, ask for one change: "Keep everything the same, but add more mist behind the tiered roof and remove the signature." Change one variable per iteration and name what must stay before naming the change.

## 7. Text and inscriptions

- This style often adds a signature, a handwritten note or a date at the bottom, because many training examples carry them. Add the sentence "No signature, no handwriting, no inscription." at the end of the prompt. If one still appears, regenerate or edit it out ("Remove the handwriting at the bottom and extend the paper texture").
- If the user wants text (a title card), put the exact words in quotes, name the lettering ("hand-lettered charcoal capitals on the bare paper"), keep it to 1–3 words, and render with Nano Banana Pro. Javanese script (aksara Jawa) and Arabic script often come out wrong; add them in editing instead.

## 8. Flow settings and animating plates

- Choose the image model, aspect ratio (16:9 for video, 3:4 for plates and thumbnails, 9:16 for Shorts) and 2–4 outputs per run.
- Generate variations and pick the best instead of rewriting blindly.
- Plates can serve as start or end frames for video (Veo). For a drawn look, keep motion minimal: slow push-in, drifting mist, swaying palm fronds, a figure's slow step; ask the video prompt to preserve "paper grain and hatching texture" so the footage stays a living drawing, not a 3D scene.

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| Looks like a digital painting or photo | Start with "hand-drawn mixed-media artwork on warm buff toned paper"; add "visible paper grain, loose hatching, scanned artwork, not a photograph"; drop camera words |
| Colors too saturated | "Mostly muted grey-sepia; color only on the brick and one small accent" |
| Brick looks smooth or clean | "Brick built from many short charcoal strokes, eroded edges, moss in the joints" |
| Signature or writing appears | Closing sentence "No signature, no handwriting, no inscription" |
| People too detailed or too exposed | "Faces small, softly shaded and turned away; clothed in kain and kemben with a shoulder cloth" |
| Wrong architecture (domes, pagodas) | Add the era sentence from `era-and-settings.md`; say "tiered timber roof, no dome, no minaret" |
| Mist missing in legend scenes | "Heavy mist, low contrast, edges bleed into bare paper" |
| Output arrives as text | Open with "Create an image of" |

## Sources

- Google Cloud Blog, "The ultimate Nano Banana prompting guide" (Mar 5 2026): https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-nano-banana
- Google, "7 tips to get the most out of Nano Banana Pro": https://blog.google/products-and-platforms/products/gemini/prompting-tips-nano-banana-pro/
- DEV Community, "Nano-Banana Pro: Prompting Guide & Strategies": https://dev.to/googleai/nano-banana-pro-prompting-guide-strategies-1h9n
- Wikipedia, "Candi bentar" and "Trowulan" (architecture and setting facts): https://en.wikipedia.org/wiki/Candi_bentar, https://en.wikipedia.org/wiki/Trowulan
- Wikipedia, "Demak Great Mosque" (timber tiered-roof mosque): https://en.wikipedia.org/wiki/Demak_Great_Mosque
