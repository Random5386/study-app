// A stand-in for Gemini in tests: returns canned replies and records every prompt it was sent.
// Pass a function to decide the reply per call, or an Error to make the call fail.
import type { z } from 'zod';
import type { AiClient, AiResult } from './aiClient.js';

type Reply = unknown | ((prompt: string, callNumber: number) => unknown);

export class FakeAiClient implements AiClient {
  readonly prompts: string[] = [];

  constructor(private reply: Reply) {}

  setReply(reply: Reply) {
    this.reply = reply;
  }

  async generateJson<T>({
    prompt,
    schema,
  }: {
    system: string;
    prompt: string;
    schema: z.ZodType<T>;
  }): Promise<AiResult<T>> {
    this.prompts.push(prompt);
    const value = typeof this.reply === 'function' ? this.reply(prompt, this.prompts.length) : this.reply;
    if (value instanceof Error) throw value;
    return { data: schema.parse(value), model: 'fake-model', inputTokens: 10, outputTokens: 20 };
  }
}
