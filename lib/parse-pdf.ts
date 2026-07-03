import path from "node:path";
import { pathToFileURL } from "node:url";

import { PDFParse } from "pdf-parse";

import type { PageText } from "./chunk";

let workerConfigured = false;

function ensurePdfWorker(): void {
  if (workerConfigured) return;

  const workerPath = path.join(
    process.cwd(),
    "node_modules/pdf-parse/dist/pdf-parse/esm/pdf.worker.mjs",
  );
  PDFParse.setWorker(pathToFileURL(workerPath).href);
  workerConfigured = true;
}

export async function parsePdf(buffer: Buffer): Promise<PageText[]> {
  ensurePdfWorker();

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
