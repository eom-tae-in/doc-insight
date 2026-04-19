import { generateEmbedding } from './openai';
import { cosineSimilarity } from './vector';

/**
 * 텍스트의 예상 토큰 수를 계산합니다.
 * 대략 1토큰 ≈ 4글자 기준으로 계산합니다.
 * @param text 토큰 수를 계산할 텍스트
 * @returns 예상 토큰 수
 */
export function countTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * 단일 텍스트를 임베딩으로 변환합니다.
 * @param text 임베딩할 텍스트
 * @returns 임베딩 벡터
 */
export async function generateTextEmbedding(text: string): Promise<number[]> {
  return generateEmbedding(text);
}

/**
 * 여러 텍스트를 병렬로 임베딩으로 변환합니다.
 * @param texts 임베딩할 텍스트 배열
 * @returns 각 텍스트의 임베딩 벡터 배열
 */
export async function generateBatchEmbeddings(
  texts: string[]
): Promise<number[][]> {
  try {
    const embeddings = await Promise.all(texts.map((text) => generateEmbedding(text)));
    return embeddings;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Batch embedding generation failed:', errorMessage);
    throw error;
  }
}

/**
 * 텍스트 배열의 총 토큰 수를 계산합니다.
 * @param texts 텍스트 배열
 * @returns 총 토큰 수
 */
export function countBatchTokens(texts: string[]): number {
  return texts.reduce((total, text) => total + countTokens(text), 0);
}

export { cosineSimilarity };

export const embeddings = {
  countTokens,
  generateTextEmbedding,
  generateBatchEmbeddings,
  countBatchTokens,
  cosineSimilarity,
};
