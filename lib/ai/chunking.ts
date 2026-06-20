import {
  CHUNK_OVERLAP_CHARS,
  CHUNK_SIZE_CHARS,
  NIM_MAX_INPUT_CHARS,
} from "@/lib/ai/models";

export function chunkText(text: string): string[] {
  if (!text.trim()) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + CHUNK_SIZE_CHARS, text.length);

    if (end < text.length) {
      const lastPeriod = text.lastIndexOf(". ", end);
      const lastNewline = text.lastIndexOf("\n", end);
      const breakAt = Math.max(lastPeriod, lastNewline);
      if (breakAt > start + CHUNK_SIZE_CHARS * 0.5) {
        end = breakAt + 1;
      }
    }

    let chunk = text.slice(start, end).trim();
    if (chunk.length > NIM_MAX_INPUT_CHARS) {
      chunk = chunk.slice(0, NIM_MAX_INPUT_CHARS);
    }
    if (chunk) chunks.push(chunk);

    if (end >= text.length) break;
    start = Math.max(end - CHUNK_OVERLAP_CHARS, start + 1);
  }

  return chunks;
}
