export type DocumentChunk = {
  id: string;
  chunk_text: string;
  source: string;
  page: number;
  chunk_index: number;
};

export type RetrievedSource = {
  id: string;
  page: number;
  text: string;
  score: number;
  chunkIndex: number;
};

export type SearchResult = {
  sources: RetrievedSource[];
  noContext: boolean;
};
