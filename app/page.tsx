"use client";

import type { UIMessage } from "ai";
import { useCallback, useEffect, useState } from "react";

import { ChatPanel } from "@/components/ChatPanel";
import { ChatSidebar } from "@/components/ChatSidebar";
import { DocumentUpload } from "@/components/DocumentUpload";
import { SourcesPanel } from "@/components/SourcesPanel";
import {
  createChat,
  deriveChatTitle,
  getActiveChatId,
  getChat,
  getChats,
  getDocuments,
  getMostRecentChatForDocument,
  saveChat,
  saveDocument,
  setActiveChatId,
  type StoredChat,
  type StoredDocument,
} from "@/lib/chat-storage";
import type { RetrievedSource } from "@/lib/types";

function toStoredMessages(messages: UIMessage[]): StoredChat["messages"] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role as StoredChat["messages"][number]["role"],
    parts: message.parts as Array<{ type: string; text?: string }>,
  }));
}

function getLatestAssistantSources(
  chat: StoredChat,
): RetrievedSource[] {
  const lastAssistant = [...chat.messages]
    .reverse()
    .find((message) => message.role === "assistant");

  if (!lastAssistant) return [];
  return chat.messageSources[lastAssistant.id] ?? [];
}

export default function HomePage() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [chats, setChats] = useState<StoredChat[]>([]);
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [loadedChat, setLoadedChat] = useState<StoredChat | null>(null);
  const [sources, setSources] = useState<RetrievedSource[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);

  const refreshLists = useCallback(() => {
    setChats(getChats());
    setDocuments(getDocuments());
  }, []);

  const loadChat = useCallback(
    (chatId: string) => {
      const chat = getChat(chatId);
      if (!chat) return;

      setActiveChatId(chat.id);
      setLoadedChat(chat);
      setSources(getLatestAssistantSources(chat));
      setHighlightedIndex(null);
      refreshLists();
    },
    [refreshLists],
  );

  useEffect(() => {
    refreshLists();

    const storedActiveChatId = getActiveChatId();
    if (storedActiveChatId) {
      const chat = getChat(storedActiveChatId);
      if (chat) {
        setLoadedChat(chat);
      }
    }

    setIsHydrated(true);
  }, [refreshLists]);

  const handleSelectDocument = useCallback(
    (docId: string) => {
      const document = getDocuments().find((item) => item.documentId === docId);
      if (!document) return;

      const recentChat = getMostRecentChatForDocument(docId);
      if (recentChat) {
        loadChat(recentChat.id);
        return;
      }

      const newChat = createChat({
        documentId: document.documentId,
        filename: document.filename,
      });
      setLoadedChat(newChat);
      setSources([]);
      setHighlightedIndex(null);
      refreshLists();
    },
    [loadChat, refreshLists],
  );

  const handleNewChat = useCallback(() => {
    if (!loadedChat) return;

    const newChat = createChat({
      documentId: loadedChat.documentId,
      filename: loadedChat.filename,
    });
    setLoadedChat(newChat);
    setSources([]);
    setHighlightedIndex(null);
    refreshLists();
  }, [loadedChat, refreshLists]);

  const handleUploaded = useCallback(
    (payload: { documentId: string; chunkCount: number; filename: string }) => {
      saveDocument({
        documentId: payload.documentId,
        filename: payload.filename,
        chunkCount: payload.chunkCount,
        uploadedAt: Date.now(),
      });

      const newChat = createChat({
        documentId: payload.documentId,
        filename: payload.filename,
      });

      setLoadedChat(newChat);
      setSources([]);
      setHighlightedIndex(null);
      refreshLists();
    },
    [refreshLists],
  );

  const handleChatUpdate = useCallback(
    (payload: {
      chatId: string;
      messages: UIMessage[];
      messageSources: Record<string, RetrievedSource[]>;
    }) => {
      const chat = getChat(payload.chatId);
      if (!chat) return;

      const storedMessages = toStoredMessages(payload.messages);
      const updatedChat: StoredChat = {
        ...chat,
        messages: storedMessages,
        messageSources: payload.messageSources,
        title: deriveChatTitle(storedMessages),
        updatedAt: Date.now(),
      };

      saveChat(updatedChat);
      setChats(getChats());
    },
    [],
  );

  if (!isHydrated) {
    return (
      <main className="min-h-screen bg-zinc-100 px-4 py-8 dark:bg-black">
        <div className="mx-auto max-w-6xl text-sm text-zinc-500">Loading...</div>
      </main>
    );
  }

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

        <section className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)_320px]">
          <ChatSidebar
            chats={chats}
            documents={documents}
            activeChatId={loadedChat?.id ?? null}
            activeDocumentId={loadedChat?.documentId ?? null}
            onSelectChat={loadChat}
            onSelectDocument={handleSelectDocument}
            onNewChat={handleNewChat}
            canCreateChat={loadedChat !== null}
          />

          <div className="space-y-4">
            <DocumentUpload onUploaded={handleUploaded} />

            {loadedChat ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Active document:{" "}
                <span className="font-medium">{loadedChat.filename}</span>
              </p>
            ) : null}

            <ChatPanel
              key={loadedChat?.id ?? "no-chat"}
              chatId={loadedChat?.id ?? "no-chat"}
              documentId={loadedChat?.documentId ?? null}
              initialMessages={(loadedChat?.messages ?? []) as UIMessage[]}
              initialMessageSources={loadedChat?.messageSources ?? {}}
              onSourcesChange={setSources}
              onCitationHover={setHighlightedIndex}
              onChatUpdate={handleChatUpdate}
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
