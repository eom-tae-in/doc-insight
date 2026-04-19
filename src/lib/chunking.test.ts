import { describe, expect, it } from 'vitest';
import { splitDocument, splitDocumentWithMetadata, splitDocuments } from './chunking';

describe('chunking', () => {
  it('returns empty array for empty text', () => {
    expect(splitDocument('')).toEqual([]);
  });

  it('keeps a short document when minTokens is relaxed', () => {
    const text = 'One short sentence. Two short sentence. Three short sentence.';

    expect(splitDocument(text, { minTokens: 1, maxTokens: 1000, overlapTokens: 0 })).toEqual([
      text,
    ]);
  });

  it('splits long text into multiple chunks with overlap', () => {
    const sentences = Array.from({ length: 12 }, (_, index) =>
      `Sentence ${index + 1} has enough characters to count as multiple tokens.`
    );
    const text = sentences.join(' ');

    const chunks = splitDocument(text, {
      minTokens: 1,
      maxTokens: 25,
      overlapTokens: 8,
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toContain('Sentence 1');
    expect(chunks[1]).toContain('Sentence');
  });

  it('returns chunk metadata with order and token count', () => {
    const text =
      'Alpha sentence is long enough. Beta sentence is also long enough. Gamma sentence stays here.';

    const chunks = splitDocumentWithMetadata(text, {
      minTokens: 1,
      maxTokens: 12,
      overlapTokens: 0,
    });

    expect(chunks[0]?.order).toBe(0);
    expect(chunks.every((chunk) => chunk.tokens > 0)).toBe(true);
  });

  it('adds the active section title to following chunks', () => {
    const sentences = [
      '[2. 시스템 아키텍처] 시스템은 여러 구성 요소로 이루어져 있습니다.',
      '프론트엔드는 사용자 화면을 담당합니다.',
      'API 서버는 요청을 처리합니다.',
      '비동기 작업 서버는 오래 걸리는 작업을 처리합니다.',
      '캐시 계층은 자주 조회되는 데이터를 저장합니다.',
      '관계형 데이터베이스는 핵심 데이터를 저장합니다.',
    ];

    const chunks = splitDocument(sentences.join(' '), {
      minTokens: 1,
      maxTokens: 20,
      overlapTokens: 0,
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toContain('[2. 시스템 아키텍처]');
    expect(chunks[1]?.startsWith('[2. 시스템 아키텍처]')).toBe(true);
  });

  it('splits multiple documents independently', () => {
    const documents = [
      'Document one sentence. Another sentence.',
      'Document two sentence. Another different sentence.',
    ];

    const results = splitDocuments(documents, {
      minTokens: 1,
      maxTokens: 1000,
      overlapTokens: 0,
    });

    expect(results).toHaveLength(2);
    expect(results[0]?.[0]).toContain('Document one');
    expect(results[1]?.[0]).toContain('Document two');
  });
});
