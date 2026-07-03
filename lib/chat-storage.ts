import type { RetrievedSource } from "@/lib/types";

const DOCUMENTS_KEY = "doc-chat-rag:documents";
const CHATS_KEY = "doc-chat-rag:chats";
const ACTIVE_CHAT_KEY = "doc-chat-rag:active-chat-id";

export type StoredDocument = {
  documentId: string;
  filename: string;
  chunkCount: number;
  uploadedAt: number;
};

export type StoredChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  parts: Array<{ type: string; text?: string }>;
};

export type StoredChat = {
  id: string;
  title: string;
  documentId: string;
  filename: string;
  messages: StoredChatMessage[];
  messageSources: Record<string, RetrievedSource[]>;
  createdAt: number;
  updatedAt: number;
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function getDocuments(): StoredDocument[] {
  return readJson<StoredDocument[]>(DOCUMENTS_KEY, []);
}

export function saveDocument(document: StoredDocument): void {
  const documents = getDocuments();
  const existingIndex = documents.findIndex(
    (item) => item.documentId === document.documentId,
  );

  if (existingIndex >= 0) {
    documents[existingIndex] = document;
  } else {
    documents.unshift(document);
  }

  writeJson(DOCUMENTS_KEY, documents);
}

export function getChats(): StoredChat[] {
  return readJson<StoredChat[]>(CHATS_KEY, []);
}

export function getChat(chatId: string): StoredChat | null {
  return getChats().find((chat) => chat.id === chatId) ?? null;
}

export function saveChat(chat: StoredChat): void {
  const chats = getChats();
  const existingIndex = chats.findIndex((item) => item.id === chat.id);

  if (existingIndex >= 0) {
    chats[existingIndex] = chat;
  } else {
    chats.unshift(chat);
  }

  writeJson(CHATS_KEY, chats);
}

export function createChat(params: {
  documentId: string;
  filename: string;
}): StoredChat {
  const now = Date.now();
  const chat: StoredChat = {
    id: crypto.randomUUID(),
    title: "New chat",
    documentId: params.documentId,
    filename: params.filename,
    messages: [],
    messageSources: {},
    createdAt: now,
    updatedAt: now,
  };

  saveChat(chat);
  setActiveChatId(chat.id);
  return chat;
}

export function getChatsForDocument(documentId: string): StoredChat[] {
  return getChats()
    .filter((chat) => chat.documentId === documentId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getMostRecentChatForDocument(
  documentId: string,
): StoredChat | null {
  return getChatsForDocument(documentId)[0] ?? null;
}

export function getActiveChatId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_CHAT_KEY);
}

export function setActiveChatId(chatId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_CHAT_KEY, chatId);
}

export function deriveChatTitle(
  messages: Array<{
    role: string;
    parts: Array<{ type: string; text?: string }>;
  }>,
): string {
  const firstUser = messages.find((message) => message.role === "user");
  if (!firstUser) return "New chat";

  const text = firstUser.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) return "New chat";
  return text.length > 48 ? `${text.slice(0, 48)}…` : text;
}
