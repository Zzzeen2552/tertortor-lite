// UserPromptSubmit hook (user 2026-11-17: "di pakai setiap kali user ngetik motion graphic"): when the prompt mentions
// motion graphic(s), tell Claude to load the motion-design skill (LottieFiles, .claude/skills/motion-design) before it
// designs any motion. Prints nothing for other prompts.
let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let prompt = "";
  try { prompt = String(JSON.parse(raw || "{}").prompt ?? ""); } catch { prompt = raw; }
  if (!/motion[\s_-]*graphics?\b/i.test(prompt)) return;
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: "The user mentioned motion graphic(s). Before designing or changing any motion (GSAP timelines, transitions, entrances, stagger, easing), invoke the motion-design skill with the Skill tool and apply its timing, easing and choreography guidance. The preset's style.md (duration limits, Hindari) still wins where they conflict.",
    },
  }));
});
