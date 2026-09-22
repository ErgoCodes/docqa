export interface Chunk {
  id: string;
  documentId: string;
  userId: string;
  page: number;
  index: number;
  text: string;
}

export interface ChunkSearchResult extends Chunk {
  score: number;
}
