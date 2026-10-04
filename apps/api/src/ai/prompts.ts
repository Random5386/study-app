// Prompts live in apps/api/prompts/*.md, so changes show up clearly in Git diffs.
// Each file name carries a version (summary.v1). The version is saved with every summary,
// so a new prompt version automatically skips old cached results.
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Works from src/ai (dev, tests) and dist/ai (production): both are two levels below apps/api.
const PROMPTS_DIR = path.resolve(import.meta.dirname, '../../prompts');
const cache = new Map<string, string>();

export function loadPrompt(name: string): string {
  let text = cache.get(name);
  if (text === undefined) {
    text = readFileSync(path.join(PROMPTS_DIR, `${name}.md`), 'utf8').trim();
    cache.set(name, text);
  }
  return text;
}

/** Replace {{placeholders}}. Values are inserted as-is, once; they are never re-scanned for placeholders. */
export function fillPrompt(name: string, values: Record<string, string>): string {
  return loadPrompt(name).replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = values[key];
    if (value === undefined) throw new Error(`Prompt ${name} needs a value for {{${key}}}`);
    return value;
  });
}

/**
 * Untrusted document text goes between <document> tags. Remove any such tags inside the text,
 * so a document can't "close" the tag early and smuggle in instructions (prompt injection).
 */
export const asDocumentText = (text: string) => text.replace(/<\s*\/?\s*document\s*>/gi, '');
