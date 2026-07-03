import { openai } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  type ModelMessage,
  type UIMessage,
} from "ai";
import { z } from "zod";

import { rateLimitResponse } from "@/lib/rate-limit";
import { buildRagPrompt, buildSystemPrompt, REFUSAL_MESSAGE } from "@/lib/rag-prompt";
import { searchDocument } from "@/lib/pinecone";
import { logTokenUsage } from "@/lib/token-usage";

export const runtime = "nodejs";
export const maxDuration = 60;

const chatRequestSchema = z.object({
  id: z.string().optional(),
  documentId: z.uuid(),
  messages: z.array(z.custom<UIMessage>()).min(1),
  trigger: z.string().optional(),
  messageId: z.string().optional(),
});

function getLatestUserQuestion(messages: UIMessage[]): string | null {
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

  return null;
}

function replaceLatestUserWithRagPrompt(
  modelMessages: ModelMessage[],
  prompt: string,
): ModelMessage[] {
  const result = [...modelMessages];

  while (result.length > 0 && result[result.length - 1]?.role === "user") {
    result.pop();
  }

  result.push({ role: "user", content: prompt });
  return result;
}

function streamRefusal() {
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({ type: "text-start", id: "refusal" });
      writer.write({ type: "text-delta", id: "refusal", delta: REFUSAL_MESSAGE });
      writer.write({ type: "text-end", id: "refusal" });
    },
  });

  return createUIMessageStreamResponse({ stream });
}

function plainTextError(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function POST(request: Request) {
  const limited = rateLimitResponse(request, "chat", 60, 60 * 60 * 1000);
  if (limited) return limited;

  try {
    const body = await request.json();
    const parsed = chatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return plainTextError("Invalid chat request", 400);
    }

    const { documentId, messages } = parsed.data;
    const question = getLatestUserQuestion(messages);

    if (!question) {
      return plainTextError("No user message found", 400);
    }

    const { sources, noContext } = await searchDocument(documentId, question, 5);

    if (noContext) {
      return streamRefusal();
    }

    const ragPrompt = buildRagPrompt(question, sources);
    const modelMessages = await convertToModelMessages(messages);

    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({ type: "data-sources", data: sources });

        const result = streamText({
          model: openai("gpt-4.1-mini"),
          system: buildSystemPrompt(),
          messages: replaceLatestUserWithRagPrompt(modelMessages, ragPrompt),
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
    return plainTextError(
      error instanceof Error ? error.message : "Chat request failed",
      500,
    );
  }
}
