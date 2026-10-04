// The AI "port": code that needs a language model depends on this interface, not on Gemini.
// That's dependency inversion. It lets tests use FakeAiClient (no network, no quota, no key)
// and would let us swap Gemini for another model later. See docs/11-ai-gemini.md.
import type { z } from 'zod';

export type AiResult<T> = { data: T; model: string; inputTokens: number; outputTokens: number };

export interface AiClient {
  /** Ask the model for JSON matching `schema`. The reply is validated before it is returned. */
  generateJson<T>(args: { system: string; prompt: string; schema: z.ZodType<T> }): Promise<AiResult<T>>;
}

/**
 * A failure that retrying won't fix (bad API key, a reply in the wrong shape twice...).
 * `message` is safe to show the user.
 */
export class PermanentAiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentAiError';
  }
}

/** A temporary failure (rate limit, model overloaded). The job queue retries these later. */
export class TemporaryAiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemporaryAiError';
  }
}
