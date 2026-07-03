import { config as loadEnv } from "dotenv";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

import { chunkPages } from "../lib/chunk";
import { parsePdf } from "../lib/parse-pdf";
import {
  deleteDocumentNamespace,
  ensurePineconeIndex,
  searchDocument,
  upsertDocumentChunks,
  waitForNamespaceRecords,
} from "../lib/pinecone";
import { buildRagPrompt, buildSystemPrompt, REFUSAL_MESSAGE } from "../lib/rag-prompt";

loadEnv({ path: path.join(process.cwd(), ".env.local") });

type GoldenCase = {
  question: string;
  mustRetrieveKeywords: string[];
  mustAnswerContain: string[];
  expectRefusal?: boolean;
};

function checkRetrieval(
  hits: Array<{ text: string }>,
  keywords: string[],
): boolean {
  if (keywords.length === 0) return true;

  const haystack = hits.map((hit) => hit.text.toLowerCase()).join("\n");
  return keywords.every((keyword) => haystack.includes(keyword.toLowerCase()));
}

function checkAnswer(answer: string, expected: string[]): boolean {
  const normalized = answer.toLowerCase();
  return expected.every((fragment) => normalized.includes(fragment.toLowerCase()));
}

async function main() {
  const goldenPath = path.join(process.cwd(), "eval", "golden-set.json");
  const samplePath = path.join(process.cwd(), "eval", "sample.pdf");

  const cases = JSON.parse(await readFile(goldenPath, "utf8")) as GoldenCase[];
  const pdfBuffer = await readFile(samplePath);

  await ensurePineconeIndex();

  const documentId = randomUUID();
  const pages = await parsePdf(pdfBuffer);
  const chunks = chunkPages(pages, documentId, "sample.pdf");

  try {
    await upsertDocumentChunks(documentId, chunks);
    await waitForNamespaceRecords(documentId, chunks.length);

    console.info(`Indexed sample.pdf as ${documentId} (${chunks.length} chunks)\n`);
    console.info("| # | Question | Retrieval | Answer | Pass |");
    console.info("|---|----------|-----------|--------|------|");

    let passed = 0;

    for (const [index, testCase] of cases.entries()) {
      const search = await searchDocument(documentId, testCase.question, 5);
      const retrievalPass = checkRetrieval(
        search.sources,
        testCase.mustRetrieveKeywords,
      );

      let answer = REFUSAL_MESSAGE;

      if (!search.noContext && !testCase.expectRefusal) {
        const result = await generateText({
          model: openai("gpt-4.1-mini"),
          system: buildSystemPrompt(),
          prompt: buildRagPrompt(testCase.question, search.sources),
        });
        answer = result.text;
      } else if (testCase.expectRefusal) {
        answer = search.noContext
          ? REFUSAL_MESSAGE
          : (
              await generateText({
                model: openai("gpt-4.1-mini"),
                system: buildSystemPrompt(),
                prompt: buildRagPrompt(testCase.question, search.sources),
              })
            ).text;
      }

      const answerPass = checkAnswer(answer, testCase.mustAnswerContain);
      const rowPass = retrievalPass && answerPass;
      if (rowPass) passed += 1;

      const label = testCase.question.slice(0, 28).padEnd(28, " ");
      console.info(
        `| ${index + 1} | ${label} | ${retrievalPass ? "PASS" : "FAIL"} | ${answerPass ? "PASS" : "FAIL"} | ${rowPass ? "PASS" : "FAIL"} |`,
      );
    }

    console.info(`\n${passed}/${cases.length} cases passed`);
    process.exit(passed === cases.length ? 0 : 1);
  } finally {
    await deleteDocumentNamespace(documentId).catch((error) => {
      console.warn(`Failed to delete eval namespace ${documentId}:`, error);
    });
  }
}

void main();
