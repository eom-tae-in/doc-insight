import { cosineSimilarity } from './embeddings';

const KEYWORD_WEIGHT = 0.2;

export interface ScorableChunk {
  id: string;
  text: string;
  chunkIndex: number;
  embedding: unknown;
}

export interface SearchScore {
  id: string;
  text: string;
  order: number;
  similarity: number;
  vectorSimilarity: number;
  keywordScore: number;
}

function normalizeForKeywordSearch(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ');
}

function extractKeywords(text: string): string[] {
  const normalized = normalizeForKeywordSearch(text);
  const tokens = normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

  return Array.from(new Set(tokens));
}

export function calculateKeywordScore(questionText: string, chunkText: string): number {
  const queryKeywords = extractKeywords(questionText);
  if (queryKeywords.length === 0) {
    return 0;
  }

  const normalizedChunk = normalizeForKeywordSearch(chunkText);
  const matchedCount = queryKeywords.filter((keyword) =>
    normalizedChunk.includes(keyword)
  ).length;

  return matchedCount / queryKeywords.length;
}

export function scoreChunk(
  questionText: string,
  queryEmbedding: number[],
  chunk: ScorableChunk
): SearchScore {
  const vectorSimilarity = cosineSimilarity(
    queryEmbedding,
    chunk.embedding as number[]
  );
  const keywordScore = calculateKeywordScore(questionText, chunk.text);
  const hybridSimilarity = Math.min(
    vectorSimilarity + keywordScore * KEYWORD_WEIGHT,
    1
  );

  return {
    id: chunk.id,
    text: chunk.text,
    order: chunk.chunkIndex,
    similarity: hybridSimilarity,
    vectorSimilarity,
    keywordScore,
  };
}

export function scoreChunks(
  questionText: string,
  queryEmbedding: number[],
  chunks: ScorableChunk[]
): SearchScore[] {
  return chunks
    .map((chunk) => scoreChunk(questionText, queryEmbedding, chunk))
    .sort((a, b) => b.similarity - a.similarity);
}
