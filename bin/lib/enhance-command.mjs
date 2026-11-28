/**
 * The `/enhance` command: improve a question or research prompt, then run it.
 *
 * The command wraps the user's prompt in instructions that make the agent
 * ground itself briefly, ask the questions whose answers would change the
 * direction, show the improved prompt, and then run it (or wait, with
 * `--ask`). It submits the wrapped text back to the same session, so the
 * improvement and the run happen in the user's own conversation.
 *
 * Registration is feature-detected and never throws: a host without the
 * command or prompt API simply has no `/enhance`.
 *
 * @module enhance-command
 */

/** Name of the slash command. */
export const ENHANCE_COMMAND_NAME = "enhance"

/** Text shown in command lists. */
export const ENHANCE_COMMAND_DESCRIPTION =
  "Improve a question or research prompt — ask what matters, show the improved prompt, then run it (--ask to approve first)"

const USAGE =
  "Usage: `/enhance [--ask] <prompt>` — improves the prompt (asking you what matters), " +
  "shows the improved version, then runs it; `--ask` waits for your go-ahead before running."

const LEADING_COMMAND_RE = /^\/enhance(?=\s|$)/
const LEADING_ASK_RE = /^--ask(?=\s|$)/

/**
 * Split the argument text into the `--ask` option and the prompt.
 *
 * Only a leading `--ask` token is the option; anywhere else it is prompt text.
 * A leading `/enhance` token is dropped in case the host passes the command
 * name along with its arguments.
 *
 * @param {string} text - The text typed after `/enhance`.
 * @returns {{ ask: boolean, prompt: string }} The option and the trimmed prompt.
 */
export function parseEnhanceArguments(text) {
  let rest = String(text ?? "").trim().replace(LEADING_COMMAND_RE, "").trim()
  const ask = LEADING_ASK_RE.test(rest)
  if (ask) rest = rest.replace(LEADING_ASK_RE, "").trim()
  return { ask, prompt: rest }
}

/**
 * Build the text submitted to the session for one invocation.
 *
 * @param {{ prompt: string, ask: boolean }} input - The parsed arguments.
 * @returns {string} The instructions with the user's prompt between markers,
 *   or a usage reply when the prompt is empty.
 */
export function buildEnhancePrompt({ prompt, ask }) {
  if (!prompt) {
    return `The user ran \`/enhance\` without a prompt. Reply with exactly this line and do nothing else:\n\n${USAGE}`
  }
  const finish = ask
    ? "4. **Wait for the user's go-ahead.** Ask whether to run the improved prompt as shown, adjust it, or stop. Run it only after the user agrees."
    : "4. **Run the improved prompt now**, exactly as if the user had typed it."
  return [
    "The user ran `/enhance`: improve the prompt below, then act on it. The prompt is the request to improve — do not start answering it before step 4.",
    "",
    "<prompt>",
    prompt,
    "</prompt>",
    "",
    "1. **Look around, briefly.** Read AGENTS.md and any file the prompt names. When the topic depends on facts that change or that you may not know well, run 1–3 quick web searches to see the current landscape. This step only finds out what to ask and add; the real work happens in step 4.",
    "2. **Ask what matters.** Find what is still only in the user's head: the decision or outcome the answer serves, their situation and constraints, and what they already know or have ruled out. Ask about every point whose answer would change the direction or the result — as many as needed, and no more. Ask them together in one batch with the question tool, as multiple choice with the recommended option first. Ask at most one follow-up batch, and only when an answer opens a new fork that matters. Write everything else down as an assumption. When nothing material is unclear, skip this step. This is a quick check, not a requirements interview: write no files and record no decisions.",
    "3. **Show the improved prompt** in one short block with these parts:",
    "   - **Goal** — the real question or outcome behind the request.",
    "   - **Context** — what you learned from the repository, the searches, and the answers.",
    "   - **Also consider** — angles the user did not mention: alternatives, trade-offs, risks, costs, prerequisites, and how to check the answer.",
    "   - **You'll also want to know** — related questions worth answering alongside this one.",
    "   - **A good answer** — a recommendation or a survey, how deep, and whether it needs sources.",
    "   - **Assumptions** — what you took for granted.",
    "   Keep the user's goal and limits exactly. Add angles freely, but never change the goal or add work the user did not ask for.",
    "   When a CodeOps skill fits the improved prompt better — deep-research for broad multi-source research, grill-me to stress-test a design, make-plan to plan a feature, make-requirements to capture requirements — say so in one line. Do not switch to it.",
    finish,
  ].join("\n")
}

/**
 * Register `/enhance` on a server plugin context.
 *
 * @param {unknown} ctx - The plugin context.
 * @returns {Promise<boolean>} `false` when the host lacks the command or
 *   session-prompt API, or the registration failed; never throws.
 */
export async function registerEnhanceCommand(ctx) {
  const context = /** @type {any} */ (ctx)
  if (typeof context?.command?.transform !== "function") return false
  if (typeof context?.session?.prompt !== "function") return false
  try {
    await context.command.transform((editor) =>
      editor.add({
        name: ENHANCE_COMMAND_NAME,
        description: ENHANCE_COMMAND_DESCRIPTION,
        async execute({ sessionID, prompt, delivery }) {
          try {
            const text = buildEnhancePrompt(parseEnhanceArguments(prompt?.text))
            await context.session.prompt({ ...prompt, sessionID, text, delivery })
          } catch {
            // A failed submission must never break the host's command loop.
          }
        },
      })
    )
    return true
  } catch {
    return false
  }
}
