import { PDFParse } from "pdf-parse";

import type { PageText } from "./chunk";

export async function parsePdf(buffer: Buffer): Promise<PageText[]> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.pages.map((page) => ({
      page: page.num,
      text: page.text.trim(),
    }));
  } finally {
    await parser.destroy();
  }
}
