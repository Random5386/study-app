// Split long text into pieces that fit comfortably in one AI request.
// Rule of thumb: 1 token ≈ 4 characters of English, so 120,000 characters ≈ 30,000 tokens.
// We split on blank lines (paragraphs) so ideas aren't cut in half.
export const DEFAULT_CHUNK_CHARS = 120_000;

export function chunkText(text: string, maxChars = DEFAULT_CHUNK_CHARS): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const para of text.split(/\n{2,}/)) {
    if (current && current.length + para.length + 2 > maxChars) {
      chunks.push(current);
      current = '';
    }
    if (para.length > maxChars) {
      // One enormous paragraph: cut it into fixed-size slices.
      for (let i = 0; i < para.length; i += maxChars) chunks.push(para.slice(i, i + maxChars));
      continue;
    }
    current = current ? `${current}\n\n${para}` : para;
  }
  if (current.trim()) chunks.push(current);
  return chunks;
}
