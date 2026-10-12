/**
 * omp hands a loaded skill to the model as an injected message. Two shapes show
 * up depending on where it is read from:
 *
 *   session log: `<skill name="x" location="…">…the whole file…</skill>`
 *   RPC stream:  `[IMPORTANT: User invoked the "x" skill; …] …file… User: <prompt>`
 *
 * Rendering either one verbatim dumps thousands of characters into the chat, so
 * the transcript folds them into a "skill loaded" chip.
 */
export interface SkillInjection {
  name: string;
  /** The SKILL.md body, without the wrapper and without the user's prompt. */
  body: string;
  /** Whatever the user actually typed, when the message carries it. */
  rest: string;
}

export function parseSkillInjection(content: string): SkillInjection | null {
  const tagged = content.match(/^\s*<skill\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/skill>\s*/);
  if (tagged) return { name: tagged[1], body: tagged[2].trim(), rest: content.slice(tagged[0].length).trim() };

  const rpc = content.match(/^\s*\[IMPORTANT:\s*User invoked the "([^"]+)" skill[^\]]*\]\s*([\s\S]*)$/);
  if (!rpc) return null;
  const body = rpc[2];
  const promptAt = body.lastIndexOf("\nUser: ");
  return {
    name: rpc[1],
    body: (promptAt > 0 ? body.slice(0, promptAt) : body).trim(),
    rest: promptAt > 0 ? body.slice(promptAt + "\nUser: ".length).trim() : "",
  };
}

export const isSkillInjection = (content: string): boolean => parseSkillInjection(content) !== null;
