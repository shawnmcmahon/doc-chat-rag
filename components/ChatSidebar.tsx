"use client";

import type { StoredChat, StoredDocument } from "@/lib/chat-storage";

type ChatSidebarProps = {
  chats: StoredChat[];
  documents: StoredDocument[];
  activeChatId: string | null;
  activeDocumentId: string | null;
  onSelectChat: (chatId: string) => void;
  onSelectDocument: (documentId: string) => void;
  onNewChat: () => void;
  canCreateChat: boolean;
};

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

export function ChatSidebar({
  chats,
  documents,
  activeChatId,
  activeDocumentId,
  onSelectChat,
  onSelectDocument,
  onNewChat,
  canCreateChat,
}: ChatSidebarProps) {
  return (
    <aside className="flex flex-col gap-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="space-y-2">
        <button
          type="button"
          onClick={onNewChat}
          disabled={!canCreateChat}
          className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          New chat
        </button>
        {!canCreateChat ? (
          <p className="text-xs text-zinc-500">
            Select or upload a document first.
          </p>
        ) : null}
      </div>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Past chats
        </h2>
        {chats.length === 0 ? (
          <p className="text-sm text-zinc-500">No chats yet.</p>
        ) : (
          <ul className="max-h-56 space-y-1 overflow-y-auto">
            {chats.map((chat) => {
              const isActive = chat.id === activeChatId;

              return (
                <li key={chat.id}>
                  <button
                    type="button"
                    onClick={() => onSelectChat(chat.id)}
                    className={`w-full rounded-lg px-3 py-2 text-left transition ${
                      isActive
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    }`}
                  >
                    <p className="truncate text-sm font-medium">{chat.title}</p>
                    <p
                      className={`truncate text-xs ${
                        isActive
                          ? "text-zinc-300 dark:text-zinc-600"
                          : "text-zinc-500"
                      }`}
                    >
                      {chat.filename} · {formatRelativeTime(chat.updatedAt)}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Your documents
        </h2>
        {documents.length === 0 ? (
          <p className="text-sm text-zinc-500">Upload a PDF to get started.</p>
        ) : (
          <ul className="max-h-56 space-y-1 overflow-y-auto">
            {documents.map((document) => {
              const isActive = document.documentId === activeDocumentId;

              return (
                <li key={document.documentId}>
                  <button
                    type="button"
                    onClick={() => onSelectDocument(document.documentId)}
                    className={`w-full rounded-lg px-3 py-2 text-left transition ${
                      isActive
                        ? "border border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/40"
                        : "border border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    }`}
                  >
                    <p className="truncate text-sm font-medium">
                      {document.filename}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {document.chunkCount} chunks ·{" "}
                      {formatRelativeTime(document.uploadedAt)}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </aside>
  );
}
