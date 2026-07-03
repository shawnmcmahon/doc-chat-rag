"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";

import type { RetrievedSource } from "@/lib/types";

type ChatPanelProps = {
  documentId: string | null;
  onSourcesChange: (sources: RetrievedSource[]) => void;
  onCitationHover: (index: number | null) => void;
};

function extractText(parts: Array<{ type: string; text?: string }>): string {
  return parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
}

function formatChatError(error: Error): string {
  try {
    const parsed = JSON.parse(error.message) as { error?: unknown };
    if (typeof parsed.error === "string") return parsed.error;
  } catch {
    // Plain-text or non-JSON errors fall through.
  }

  return error.message;
}

function renderWithCitations(
  text: string,
  onCitationHover: (index: number | null) => void,
) {
  const segments = text.split(/(\[\d+\])/g);

  return segments.map((segment, index) => {
    const match = segment.match(/^\[(\d+)\]$/);
    if (!match) {
      return <span key={index}>{segment}</span>;
    }

    const citation = Number(match[1]);

    return (
      <button
        key={index}
        type="button"
        className="mx-0.5 rounded px-1 font-medium text-blue-700 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-950"
        onMouseEnter={() => {
          onCitationHover(citation);
          document
            .getElementById(`source-${citation}`)
            ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }}
        onMouseLeave={() => onCitationHover(null)}
      >
        {segment}
      </button>
    );
  });
}

export function ChatPanel({
  documentId,
  onSourcesChange,
  onCitationHover,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [messageSources, setMessageSources] = useState<
    Record<string, RetrievedSource[]>
  >({});
  const streamingMessageIdRef = useRef<string | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: documentId ? { documentId } : undefined,
      }),
    [documentId],
  );

  const { messages, sendMessage, status, error } = useChat({
    id: documentId ?? undefined,
    transport,
    onData: (dataPart) => {
      if (dataPart.type !== "data-sources") return;

      const sources = dataPart.data as RetrievedSource[];
      const messageId =
        streamingMessageIdRef.current ?? `pending-${Date.now()}`;

      setMessageSources((current) => ({
        ...current,
        [messageId]: sources,
      }));
      onSourcesChange(sources);
    },
  });

  useEffect(() => {
    if (status === "streaming" || status === "submitted") {
      const lastAssistant = [...messages]
        .reverse()
        .find((message) => message.role === "assistant");

      if (lastAssistant) {
        streamingMessageIdRef.current = lastAssistant.id;
      }
    }
  }, [messages, status]);

  const isBusy = status === "streaming" || status === "submitted";

  return (
    <div className="flex h-full min-h-[420px] flex-col rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Upload a PDF, then ask a question about its contents.
          </p>
        ) : null}

        {messages.map((message) => {
          const text = extractText(message.parts);
          const isUser = message.role === "user";

          return (
            <div
              key={message.id}
              className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                isUser
                  ? "ml-auto bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
              }`}
            >
              {isUser ? (
                <p className="whitespace-pre-wrap">{text}</p>
              ) : (
                <div
                  className="whitespace-pre-wrap"
                  onMouseEnter={() => {
                    const sources = messageSources[message.id];
                    if (!sources) return;
                    onSourcesChange(sources);
                  }}
                >
                  {renderWithCitations(text, onCitationHover)}
                </div>
              )}
            </div>
          );
        })}

        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            {formatChatError(error)}
          </p>
        ) : null}
      </div>

      <form
        className="border-t border-zinc-200 p-4 dark:border-zinc-800"
        onSubmit={(event) => {
          event.preventDefault();
          if (!documentId || !input.trim() || isBusy) return;

          void sendMessage({ text: input.trim() });
          setInput("");
        }}
      >
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={
              documentId
                ? "Ask a question about your document..."
                : "Upload a PDF to start chatting"
            }
            disabled={!documentId || isBusy}
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={!documentId || !input.trim() || isBusy}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {isBusy ? "..." : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
