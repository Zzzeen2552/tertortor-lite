---
name: h3-prompt-writing
description: Write MiniMax H3 video generation prompts for T2VA (text-to-video), I2VA (image-to-video), FL2VA (first+last frame), L2VA (last-frame), and full-reference Ref2VA modes. Use this skill whenever the user wants to write, rewrite, or format a prompt for MiniMax's H3 video model — including composing integrated_multimodal_description, overall_soundscape, and non_diegetic_music fields, aligning keyframes/reference pictures to timestamps, defining Subject/Picture/Video/Audio reference labels, or converting a rough video idea/reference assets into H3's exact field structure. Trigger on mentions of "MiniMax H3", "H3 prompt", "T2VA/I2VA/FL2VA/L2VA/Ref2VA", or a request to build a structured multimodal video-generation prompt with keyframes, dialogue, and soundscape fields.
compatibility: Portable to any agent that can read local reference files. No external API calls, MiniMax Hub tools, or proprietary runtime required.
---

# H3 Prompt Writing

## Workflow

1. Identify the input mode: T2VA, I2VA, FL2VA, L2VA, or full-reference Ref2VA.
2. For base text/keyframe modes, read `references/base-en.txt` and follow its final prompt structure.
3. For full-reference mode, read `references/ref-en.txt` and follow its six-section rewrite format.
4. Preserve the exact field names, section order, labels, and timing notation from the selected guide.

## Base Modes

- T2VA: build the full audiovisual timeline from text.
- I2VA: start from the first frame and develop forward from it.
- FL2VA: describe the continuous path between the first and last frames.
- L2VA: infer a plausible opening and converge to the supplied last frame.

Use `integrated_multimodal_description`, `overall_soundscape`, and `non_diegetic_music` in the order shown in `references/base-en.txt`.

## Full-Reference Mode

Ref2VA rewrites use `subject_definitions`, `summary`, `retention_analysis`, `detailed_description`, `overall_soundscape`, and `non_diegetic_music` in that order. Reference labels stay consistent across all sections.

Read `references/ref-en.txt` for label rules, retention analysis, and complete examples.

## Output Rules

- Write rewrite sections in English; preserve dialogue, lyrics, and visible scene text in their original language.
- Describe each shot by composition, subjects, environment, actions, camera, sound, and the exact point where referenced content appears.
- Avoid plot summaries, unresolved reference labels, and timing that does not match the requested duration.

## Tips for Better Results

- Always match the total duration of the description to the requested video length (4–15 seconds).
- Keep reference labels consistent (e.g. `<Picture 1>`, `<Video 1>`, `<Audio 1>`) across every section.
- Prefer concrete visual and audio details over abstract words like "cinematic" or "beautiful".
- When using keyframes (I2VA / FL2VA / L2VA), clearly state how the first and/or last frame connects to the timeline.
