// agent.mjs: which "brain" works on this TERTORTOR LITE install (user 2026-11-23: one repo, the user picks the brain).
//   .env  AGENT=claude        Claude Code (default): skills in .claude/skills, CLAUDE.md, Studio chat = claude -p
//   .env  AGENT=antigravity   Google Antigravity: skills in .gemini/skills, GEMINI.md, Studio chat = Gemini API
// Studio texts, progress labels and briefs are written once with the word "Antigravity" or "Claude" in them;
// agentText() turns either into the chosen agent's name, so the dashboard always names the brain that really works.
import "./lib.mjs"; // loads .env
export const AGENT = String(process.env.AGENT || "claude").trim().toLowerCase() === "antigravity" ? "antigravity" : "claude";
export const AGENT_NAME = AGENT === "antigravity" ? "Antigravity" : "Claude";
const OTHER = AGENT === "antigravity" ? /\bClaude(?! Code| desktop| in Chrome| haiku)\b/g : /\bAntigravity\b/g;
export const agentText = (s) => (typeof s === "string" ? s.replace(OTHER, AGENT_NAME) : s);
