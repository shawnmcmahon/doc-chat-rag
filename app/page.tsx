"use client";

import { useState } from "react";

import { ChatPanel } from "@/components/ChatPanel";
import { DocumentUpload } from "@/components/DocumentUpload";
import { SourcesPanel } from "@/components/SourcesPanel";
import type { RetrievedSource } from "@/lib/types";

export default function HomePage() {
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [sources, setSources] = useState<RetrievedSource[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-8 dark:bg-black">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            RAG Document Chat
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Chat with your PDF using cited retrieval
          </h1>
          <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Upload a document, ask questions, and get streamed answers grounded in
            retrieved chunks with numbered citations.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <DocumentUpload
              onUploaded={({ documentId: id, filename: name }) => {
                setDocumentId(id);
                setFilename(name);
                setSources([]);
              }}
            />

            {filename ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Active document: <span className="font-medium">{filename}</span>
              </p>
            ) : null}

            <ChatPanel
              documentId={documentId}
              onSourcesChange={setSources}
              onCitationHover={setHighlightedIndex}
            />
          </div>

          <SourcesPanel
            sources={sources}
            highlightedIndex={highlightedIndex}
            onHighlight={setHighlightedIndex}
          />
        </section>
      </div>
    </main>
  );
}
