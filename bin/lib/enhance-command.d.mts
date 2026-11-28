/** Name of the slash command. */
export declare const ENHANCE_COMMAND_NAME: string

/** Text shown in command lists. */
export declare const ENHANCE_COMMAND_DESCRIPTION: string

/** Split the argument text into the leading `--ask` option and the prompt. */
export declare function parseEnhanceArguments(text: string | undefined): {
  ask: boolean
  prompt: string
}

/** Build the text submitted to the session for one invocation. */
export declare function buildEnhancePrompt(input: { prompt: string; ask: boolean }): string

/**
 * Register `/enhance` on a server plugin context, feature-detected and
 * never-throwing; `false` when the host lacks the command or session-prompt
 * API or the registration failed.
 */
export declare function registerEnhanceCommand(ctx: unknown): Promise<boolean>
