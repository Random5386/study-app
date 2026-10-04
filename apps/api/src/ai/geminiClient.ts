// The real AiClient: Google Gemini through the official @google/genai SDK.
// This is the ONLY file that touches GEMINI_API_KEY, and it only ever runs on the server.
import { ApiError, GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { PermanentAiError, TemporaryAiError, type AiClient, type AiResult } from './aiClient.js';

export class GeminiClient implements AiClient {
  private readonly ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generateJson<T>(args: {
    system: string;
    prompt: string;
    schema: z.ZodType<T>;
  }): Promise<AiResult<T>> {
    // Try the main model; if it's busy (429/503), try the fallback before giving up.
    const models = [env.GEMINI_MODEL, env.GEMINI_FALLBACK_MODEL].filter((m, i, all) => all.indexOf(m) === i);
    let lastError: unknown;
    for (const model of models) {
      try {
        return await this.callModel(model, args);
      } catch (err) {
        lastError = err;
        if (!(err instanceof TemporaryAiError)) throw err;
        logger.warn({ model, err: err.message }, 'Gemini model busy, trying the next one');
      }
    }
    throw lastError;
  }

  private async callModel<T>(
    model: string,
    { system, prompt, schema }: { system: string; prompt: string; schema: z.ZodType<T> },
  ): Promise<AiResult<T>> {
    let res;
    try {
      res = await this.ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: system,
          responseMimeType: 'application/json',
          responseJsonSchema: z.toJSONSchema(schema), // the same Zod schema tells Gemini the shape we want
          temperature: 0.3, // lower = more focused, less "creative"
        },
      });
    } catch (err) {
      throw translateError(err);
    }

    // Never trust model output: parse it and validate it against the schema.
    let data: T;
    try {
      data = schema.parse(JSON.parse(res.text ?? ''));
    } catch {
      // Models occasionally return the wrong shape; a retry usually fixes it.
      throw new TemporaryAiError("The AI's answer wasn't in the expected format.");
    }
    return {
      data,
      model,
      inputTokens: res.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: res.usageMetadata?.candidatesTokenCount ?? 0,
    };
  }
}

/** Turn SDK/network errors into our two kinds, with messages that are safe to show users. */
function translateError(err: unknown): Error {
  if (err instanceof ApiError) {
    if (err.status === 429)
      return new TemporaryAiError("Gemini's free tier is busy right now. Try again in a minute.");
    if (err.status >= 500)
      return new TemporaryAiError('Gemini is having problems right now. Try again soon.');
    if (err.status === 400 && /api key/i.test(err.message))
      return new PermanentAiError('The Gemini API key was rejected. Check GEMINI_API_KEY in .env.');
    if (err.status === 401 || err.status === 403)
      return new PermanentAiError('The Gemini API key was rejected. Check GEMINI_API_KEY in .env.');
    if (err.status === 404) return new PermanentAiError('The Gemini model name in .env was not found.');
    return new PermanentAiError('Gemini could not process this document.');
  }
  return new TemporaryAiError('Could not reach Gemini. Check your internet connection.'); // network errors
}
