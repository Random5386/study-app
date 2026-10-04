// Summarise a document's text with any AiClient. Pure "AI logic": no database, no HTTP,
// so it's easy to test with FakeAiClient. See docs/11-ai-gemini.md.
import { summaryOutputSchema, type SummaryOutput, type SummaryStyle } from '@studyapp/shared';
import { chunkText } from '../lib/chunkText.js';
import type { AiClient } from './aiClient.js';
import { audienceDescription } from './audience.js';
import { asDocumentText, fillPrompt, loadPrompt } from './prompts.js';

export const SUMMARY_PROMPT_VERSION = 'summary.v2'; // v2: written for the student's study level
export const MAX_CHUNKS = 8; // about 1 million characters; enough for any study guide we accept

export type SummariseResult = SummaryOutput & { model: string; inputTokens: number; outputTokens: number };

/** `audience` says who it's for, from audienceDescription() (e.g. "a Grade 10 high school learner..."). */
export async function summariseText(
  ai: AiClient,
  text: string,
  style: SummaryStyle,
  audience = audienceDescription(null, null),
): Promise<SummariseResult> {
  const system = loadPrompt('system.v1');
  let inputTokens = 0;
  let outputTokens = 0;
  let model = '';

  const ask = async (material: string, s: SummaryStyle) => {
    const res = await ai.generateJson({
      system,
      prompt: fillPrompt(SUMMARY_PROMPT_VERSION, { audience, style: s, text: asDocumentText(material) }),
      schema: summaryOutputSchema,
    });
    inputTokens += res.inputTokens;
    outputTokens += res.outputTokens;
    model = res.model;
    return res.data;
  };

  const chunks = chunkText(text).slice(0, MAX_CHUNKS);
  if (chunks.length === 0) throw new Error('No text to summarise');

  let final: SummaryOutput;
  if (chunks.length === 1) {
    final = await ask(chunks[0]!, style); // most study guides: one request
  } else {
    // MAP: summarise each chunk on its own, one at a time (gentle on free-tier rate limits).
    const partials: string[] = [];
    for (const chunk of chunks) partials.push((await ask(chunk, 'DETAILED')).points.join('\n\n'));
    // REDUCE: summarise the partial summaries in the style the student asked for.
    final = await ask(partials.join('\n\n'), style);
  }
  return { ...final, model, inputTokens, outputTokens };
}
