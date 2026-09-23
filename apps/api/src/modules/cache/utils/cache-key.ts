import { createHash } from 'node:crypto';

export interface BuildCacheKeyInput {
  userId: string;
  documentIds: string[];
  question: string;
  generation: number;
}

export function buildCacheKey({ userId, documentIds, question, generation }: BuildCacheKeyInput): string {
  const normalizedQuestion = question.trim().toLowerCase().replace(/\s+/g, ' ');
  const sortedDocIds = [...documentIds].sort().join(',');
  const canonical = `${userId}:${sortedDocIds}:${normalizedQuestion}:${generation}`;
  return createHash('sha256').update(canonical).digest('hex');
}
