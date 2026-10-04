// Which AiClient the app uses. Gemini when GEMINI_API_KEY is set; tests swap in a fake.
import { env } from '../config/env.js';
import type { AiClient } from './aiClient.js';
import { GeminiClient } from './geminiClient.js';

let client: AiClient | null | undefined;

/** The AI client, or null when no key is configured (AI features then say "not set up"). */
export function getAiClient(): AiClient | null {
  if (client === undefined) client = env.GEMINI_API_KEY ? new GeminiClient(env.GEMINI_API_KEY) : null;
  return client;
}

/** Tests only: use a fake (or null to simulate "no key"). */
export function setAiClient(fake: AiClient | null) {
  client = fake;
}
