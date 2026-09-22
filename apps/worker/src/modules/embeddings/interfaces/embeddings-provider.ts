export interface EmbeddingsProvider {
  embed(texts: string[]): Promise<number[][]>;
}
