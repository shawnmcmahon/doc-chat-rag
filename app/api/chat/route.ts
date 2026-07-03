import { openai } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  type UIMessage,
} from "ai";
import { z } from "zod";

import { buildRagPrompt, buildSystemPrompt, REFUSAL_MESSAGE } from "@/lib/rag-prompt";
import { searchDocument } from "@/lib/pinecone";
import { logTokenUsage } from "@/lib/token-usage";
import type { RetrievedSource } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const chatRequestSchema = z.object({
  id: z.string().optional(),
  documentId: z.string().uuid(),
  messages: z.array(z.custom<UIMessage>()).min(1),
  trigger: z.string().optional(),
  messageId: z.string().optional(),
});

function getLatestUserQuestion(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== "user") continue;

    const textParts = message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim();

    if (textParts) return textParts;
  }

  throw new Error("No user message found");
}

function streamRefusal(sources: RetrievedSource[] = []) {
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      if (sources.length > 0) {
        writer.write({ type: "data-sources", data: sources });
      }

      writer.write({ type: "text-start", id: "refusal" });
      writer.write({ type: "text-delta", id: "refusal", delta: REFUSAL_MESSAGE });
      writer.write({ type: "text-end", id: "refusal" });
    },
  });

  return createUIMessageStreamResponse({ stream });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = chatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten() }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const { documentId, messages } = parsed.data;
    const question = getLatestUserQuestion(messages);
    const { sources, noContext } = await searchDocument(documentId, question, 5);

    if (noContext) {
      return streamRefusal(sources);
    }

    const prompt = buildRagPrompt(question, sources);
    const modelMessages = await convertToModelMessages(messages);

    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({ type: "data-sources", data: sources });

        const result = streamText({
          model: openai("gpt-4.1-mini"),
          system: buildSystemPrompt(),
          messages: [
            ...modelMessages.slice(0, -1),
            { role: "user", content: prompt },
          ],
          onFinish: ({ usage }) => {
            logTokenUsage(
              usage.inputTokens ?? 0,
              usage.outputTokens ?? 0,
            );
          },
        });

        writer.merge(result.toUIMessageStream());
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    console.error("[chat]", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Chat request failed",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
