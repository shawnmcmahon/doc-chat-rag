import type { DocumentChunk } from "./types";

/** ~500 tokens at ~4 chars/token */
const CHUNK_SIZE = 2000;
/** ~50 token overlap */
const CHUNK_OVERLAP = 200;

export type PageText = {
  page: number;
  text: string;
};

export function chunkPages(
  pages: PageText[],
  documentId: string,
  source: string,
): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  let chunkIndex = 0;

  for (const { page, text } of pages) {
    const paragraphs = text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);

    let buffer = "";

    const flush = (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      chunks.push({
        id: `${documentId}_${chunkIndex}`,
        chunk_text: trimmed,
        source,
        page,
        chunk_index: chunkIndex,
      });
      chunkIndex += 1;
    };

    for (const paragraph of paragraphs) {
      if (paragraph.length > CHUNK_SIZE) {
        let carry = "";
        if (buffer) {
          flush(buffer);
          carry = takeOverlap(buffer);
        }

        let start = 0;
        if (carry) {
          const room = CHUNK_SIZE - carry.length;
          const portion = paragraph.slice(0, room);
          flush(carry + portion);
          start = Math.max(0, room - CHUNK_OVERLAP);
        }

        while (start < paragraph.length) {
          const end = Math.min(start + CHUNK_SIZE, paragraph.length);
          flush(paragraph.slice(start, end));
          if (end >= paragraph.length) break;
          start = end - CHUNK_OVERLAP;
        }

        buffer = takeOverlap(paragraph.slice(start, paragraph.length));
        continue;
      }

      const candidate = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
      if (candidate.length <= CHUNK_SIZE) {
        buffer = candidate;
        continue;
      }

      flush(buffer);
      buffer = takeOverlap(buffer);
      buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    }

    if (buffer) {
      flush(buffer);
      buffer = "";
    }
  }

  return chunks;
}

function takeOverlap(text: string): string {
  if (text.length <= CHUNK_OVERLAP) return text;
  return text.slice(-CHUNK_OVERLAP);
}
