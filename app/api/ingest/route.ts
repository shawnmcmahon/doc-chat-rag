import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { chunkPages } from "@/lib/chunk";
import { ensurePineconeIndex, upsertDocumentChunks } from "@/lib/pinecone";
import { parsePdf } from "@/lib/parse-pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "PDF file is required" }, { status: 400 });
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File exceeds 10 MB limit" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const pages = await parsePdf(buffer);

    if (pages.every((page) => !page.text.trim())) {
      return NextResponse.json(
        { error: "No extractable text found in PDF" },
        { status: 400 },
      );
    }

    const documentId = randomUUID();
    const chunks = chunkPages(pages, documentId, file.name);

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "No chunks generated from PDF" },
        { status: 400 },
      );
    }

    await ensurePineconeIndex();
    await upsertDocumentChunks(documentId, chunks);

    const payload = {
      documentId,
      chunkCount: chunks.length,
      filename: file.name,
    };

    z.object({
      documentId: z.string().uuid(),
      chunkCount: z.number().int().positive(),
      filename: z.string(),
    }).parse(payload);

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[ingest]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ingestion failed" },
      { status: 500 },
    );
  }
}
