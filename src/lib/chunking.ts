import { countTokens } from './embeddings';

export interface ChunkConfig {
  minTokens?: number;
  maxTokens?: number;
  overlapTokens?: number;
}

const DEFAULT_CONFIG: Required<ChunkConfig> = {
  minTokens: 150,
  maxTokens: 400,
  overlapTokens: 50,
};

const SECTION_TITLE_PATTERN = /\[(?:\d+\.\s*)?[^\]\n]{2,80}\]/g;

/**
 * 문장 단위로 텍스트를 분할합니다.
 * 마침표(.), 줄바꿈(\n), 세미콜론(;) 기준으로 분할합니다.
 */
function splitIntoSentences(text: string): string[] {
  return text.split(/(?<=[.!?;\n])\s+/).filter((s) => s.trim().length > 0);
}

function getSectionTitles(text: string): string[] {
  return Array.from(text.matchAll(SECTION_TITLE_PATTERN), (match) => match[0]);
}

function startsWithSectionTitle(text: string): boolean {
  return /^\s*\[(?:\d+\.\s*)?[^\]\n]{2,80}\]/.test(text);
}

function addSectionTitleContext(chunks: string[]): string[] {
  let activeSectionTitle = '';

  return chunks.map((chunk) => {
    const sectionTitles = getSectionTitles(chunk);
    const shouldPrefix = activeSectionTitle && !startsWithSectionTitle(chunk);
    const enrichedChunk = shouldPrefix
      ? `${activeSectionTitle}\n${chunk}`
      : chunk;

    if (sectionTitles.length > 0) {
      activeSectionTitle = sectionTitles[sectionTitles.length - 1];
    }

    return enrichedChunk;
  });
}

/**
 * 청크에서 토큰 기반으로 마지막 부분을 추출합니다 (오버랩용).
 */
function getOverlapSuffix(chunk: string, overlapTokens: number): string {
  if (overlapTokens <= 0) return '';

  const sentences = splitIntoSentences(chunk);
  let overlapText = '';
  let tokens = 0;

  for (let i = sentences.length - 1; i >= 0; i--) {
    const sentenceTokens = countTokens(sentences[i]);
    if (tokens + sentenceTokens <= overlapTokens) {
      overlapText = sentences[i] + (overlapText ? ' ' : '') + overlapText;
      tokens += sentenceTokens;
    } else {
      break;
    }
  }

  return overlapText;
}

/**
 * 텍스트를 토큰 기반으로 분할하여 청크를 생성합니다.
 * @param text 분할할 텍스트
 * @param config 분할 설정 (minTokens, maxTokens, overlapTokens)
 * @returns 분할된 청크 배열
 */
export function splitDocument(
  text: string,
  config: ChunkConfig = {}
): string[] {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const sentences = splitIntoSentences(text);

  if (sentences.length === 0) {
    return [];
  }

  const chunks: string[] = [];
  let currentChunk = '';
  let previousChunk = '';

  for (const sentence of sentences) {
    const currentTokens = countTokens(currentChunk);
    const sentenceTokens = countTokens(sentence);
    const combinedTokens = currentTokens + sentenceTokens;

    if (combinedTokens > finalConfig.maxTokens && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      previousChunk = currentChunk;

      // 오버랩 추가
      const overlapSuffix = getOverlapSuffix(previousChunk, finalConfig.overlapTokens);
      currentChunk = overlapSuffix ? overlapSuffix + ' ' + sentence : sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return addSectionTitleContext(chunks).filter(
    (chunk) => countTokens(chunk) >= finalConfig.minTokens
  );
}

/**
 * 텍스트를 토큰 기반으로 분할하며, 청크 메타데이터를 함께 반환합니다.
 */
export interface ChunkWithMetadata {
  text: string;
  order: number;
  tokens: number;
}

export function splitDocumentWithMetadata(
  text: string,
  config: ChunkConfig = {}
): ChunkWithMetadata[] {
  const chunks = splitDocument(text, config);

  return chunks.map((chunk, index) => ({
    text: chunk,
    order: index,
    tokens: countTokens(chunk),
  }));
}

/**
 * 여러 문서를 분할합니다.
 */
export function splitDocuments(
  texts: string[],
  config: ChunkConfig = {}
): string[][] {
  return texts.map((text) => splitDocument(text, config));
}

export const chunking = {
  splitDocument,
  splitDocumentWithMetadata,
  splitDocuments,
};
