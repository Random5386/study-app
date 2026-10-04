// The real GeminiClient, with the network faked: checks what we send to Google and how we
// handle its answers and errors, without a key or an internet connection.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { summaryOutputSchema } from '@studyapp/shared';
import { PermanentAiError, TemporaryAiError } from '../src/ai/aiClient.js';
import { GeminiClient } from '../src/ai/geminiClient.js';
import { env } from '../src/config/env.js';

const okBody = (text: string) => ({
  candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' }],
  usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 45 },
});
const errorBody = (code: number, message: string, status: string) => ({ error: { code, message, status } });

function fakeGoogle(...responses: { status: number; body: unknown }[]) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    calls.push({
      url: String(input instanceof Request ? input.url : input),
      body: JSON.parse(String(init?.body)),
    });
    const next = responses[Math.min(calls.length - 1, responses.length - 1)]!;
    return new Response(JSON.stringify(next.body), {
      status: next.status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  return calls;
}

const args = { system: 'Be careful.', prompt: 'Summarise this.', schema: summaryOutputSchema };
const goodJson = JSON.stringify({ points: ['One point.'], keyTerms: [] });

afterEach(() => vi.restoreAllMocks());

describe('GeminiClient', () => {
  it('asks for JSON in our schema and validates the reply', async () => {
    const calls = fakeGoogle({ status: 200, body: okBody(goodJson) });
    const res = await new GeminiClient('test-key').generateJson(args);

    expect(res).toEqual({
      data: { points: ['One point.'], keyTerms: [] },
      model: env.GEMINI_MODEL,
      inputTokens: 120,
      outputTokens: 45,
    });
    expect(calls[0]!.url).toContain(`models/${env.GEMINI_MODEL}:generateContent`);
    const config = calls[0]!.body.generationConfig as Record<string, unknown>;
    expect(config.responseMimeType).toBe('application/json');
    expect(config.responseJsonSchema).toMatchObject({ type: 'object', required: ['points', 'keyTerms'] });
    expect(JSON.stringify(calls[0]!.body)).not.toContain('test-key'); // the key goes in a header, not the body
  });

  it('falls back to the second model when the first is rate-limited', async () => {
    const calls = fakeGoogle(
      { status: 429, body: errorBody(429, 'Resource exhausted', 'RESOURCE_EXHAUSTED') },
      { status: 200, body: okBody(goodJson) },
    );
    const res = await new GeminiClient('test-key').generateJson(args);
    expect(res.model).toBe(env.GEMINI_FALLBACK_MODEL);
    expect(calls.at(-1)!.url).toContain(env.GEMINI_FALLBACK_MODEL);
  });

  it('a rejected key is permanent (no point retrying)', async () => {
    fakeGoogle({
      status: 400,
      body: errorBody(400, 'API key not valid. Please pass a valid API key.', 'INVALID_ARGUMENT'),
    });
    await expect(new GeminiClient('bad-key').generateJson(args)).rejects.toBeInstanceOf(PermanentAiError);
  });

  it('a reply in the wrong shape is temporary (a retry usually fixes it)', async () => {
    fakeGoogle({ status: 200, body: okBody('{"summary": "wrong shape"}') });
    await expect(new GeminiClient('test-key').generateJson(args)).rejects.toBeInstanceOf(TemporaryAiError);
  });
});
