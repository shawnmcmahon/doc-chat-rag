import { Pinecone } from "@pinecone-database/pinecone";

import { getServerEnv } from "./env";
import type { DocumentChunk, RetrievedSource, SearchResult } from "./types";

const BATCH_SIZE = 100;
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;
/** Calibrated for llama-text-embed-v2 on the eval golden set. */
const MIN_RELEVANCE_SCORE = 0.05;
const NAMESPACE_READY_TIMEOUT_MS = 30_000;
const NAMESPACE_READY_POLL_MS = 500;

let pineconeClient: Pinecone | null = null;
let indexEnsured: Promise<void> | null = null;

function getPinecone(): Pinecone {
  if (!pineconeClient) {
    const env = getServerEnv();
    pineconeClient = new Pinecone({ apiKey: env.PINECONE_API_KEY });
  }
  return pineconeClient;
}

export function documentNamespace(documentId: string): string {
  return `doc_${documentId}`;
}

function isAlreadyExistsError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("already exists") || message.includes("already_exist");
}

async function ensurePineconeIndexInternal(): Promise<void> {
  const env = getServerEnv();
  const pc = getPinecone();

  const existing = await pc.listIndexes();
  const names = existing.indexes?.map((index) => index.name) ?? [];

  if (names.includes(env.PINECONE_INDEX)) {
    return;
  }

  try {
    await pc.createIndexForModel({
      name: env.PINECONE_INDEX,
      cloud: "aws",
      region: "us-east-1",
      embed: {
        model: "llama-text-embed-v2",
        fieldMap: { text: "chunk_text" },
      },
      waitUntilReady: true,
    });
  } catch (error) {
    if (isAlreadyExistsError(error)) {
      return;
    }
    throw error;
  }
}

export async function ensurePineconeIndex(): Promise<void> {
  if (!indexEnsured) {
    indexEnsured = ensurePineconeIndexInternal().catch((error) => {
      indexEnsured = null;
      throw error;
    });
  }

  await indexEnsured;
}

async function getIndexHost(): Promise<string> {
  const env = getServerEnv();
  const pc = getPinecone();
  const indexModel = await pc.describeIndex(env.PINECONE_INDEX);
  const host = indexModel.host;

  if (!host) {
    throw new Error(`Pinecone index ${env.PINECONE_INDEX} has no host`);
  }

  return host;
}

async function getNamespace(documentId: string) {
  const pc = getPinecone();
  const host = await getIndexHost();
  return pc.index({ host, namespace: documentNamespace(documentId) });
}

async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < RETRY_ATTEMPTS) {
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAY_MS * attempt),
        );
      }
    }
  }

  throw lastError;
}

export async function waitForNamespaceRecords(
  documentId: string,
  expectedCount: number,
  options: { timeoutMs?: number; pollMs?: number } = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? NAMESPACE_READY_TIMEOUT_MS;
  const pollMs = options.pollMs ?? NAMESPACE_READY_POLL_MS;
  const namespace = documentNamespace(documentId);
  const pc = getPinecone();
  const host = await getIndexHost();
  const index = pc.index({ host });
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const stats = await index.describeIndexStats();
    const recordCount = stats.namespaces?.[namespace]?.recordCount ?? 0;

    if (recordCount >= expectedCount) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  throw new Error(
    `Timed out waiting for Pinecone namespace ${namespace} to reach ${expectedCount} records`,
  );
}

export async function upsertDocumentChunks(
  documentId: string,
  chunks: DocumentChunk[],
): Promise<void> {
  const namespace = await getNamespace(documentId);

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    await withRetry(() =>
      namespace.upsertRecords({
        records: batch.map((chunk) => ({
          _id: chunk.id,
          chunk_text: chunk.chunk_text,
          source: chunk.source,
          page: chunk.page,
          chunk_index: chunk.chunk_index,
        })),
      }),
    );
  }
}

export async function searchDocument(
  documentId: string,
  query: string,
  topK = 5,
): Promise<SearchResult> {
  const namespace = await getNamespace(documentId);

  const response = await withRetry(() =>
    namespace.searchRecords({
      query: {
        topK,
        inputs: { text: query },
      },
      fields: ["chunk_text", "page", "chunk_index", "source"],
    }),
  );

  const hits = response.result?.hits ?? [];

  if (hits.length === 0) {
    return { sources: [], noContext: true };
  }

  const sources: RetrievedSource[] = hits.map((hit) => {
    const fields = hit.fields as Record<string, unknown> | undefined;

    return {
      id: hit._id,
      page: Number(fields?.page ?? 0),
      text: String(fields?.chunk_text ?? ""),
      score: hit._score,
      chunkIndex: Number(fields?.chunk_index ?? 0),
    };
  });

  const topScore = sources[0]?.score ?? 0;

  return {
    sources,
    noContext: topScore < MIN_RELEVANCE_SCORE,
  };
}

export async function deleteDocumentNamespace(documentId: string): Promise<void> {
  const pc = getPinecone();
  const host = await getIndexHost();
  const index = pc.index({ host });
  await index.deleteNamespace(documentNamespace(documentId));
}
