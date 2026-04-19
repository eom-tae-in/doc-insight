import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const {
  findQuestionByIdMock,
  findDocumentByIdMock,
  findChunksByDocumentIdMock,
  generateTextEmbeddingMock,
  cosineSimilarityMock,
} = vi.hoisted(() => ({
  findQuestionByIdMock: vi.fn(),
  findDocumentByIdMock: vi.fn(),
  findChunksByDocumentIdMock: vi.fn(),
  generateTextEmbeddingMock: vi.fn(),
  cosineSimilarityMock: vi.fn(),
}));

vi.mock('@/lib/database', () => ({
  questionRepository: {
    findById: findQuestionByIdMock,
  },
  documentRepository: {
    findById: findDocumentByIdMock,
  },
  documentChunkRepository: {
    findByDocumentId: findChunksByDocumentIdMock,
  },
}));

vi.mock('@/lib/embeddings', () => ({
  generateTextEmbedding: generateTextEmbeddingMock,
  cosineSimilarity: cosineSimilarityMock,
}));

describe('GET /api/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when question_id is missing', async () => {
    const response = await GET(new Request('http://localhost/api/search') as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'BadRequest',
    });
  });

  it('returns 404 when the question does not exist', async () => {
    findQuestionByIdMock.mockResolvedValue(null);

    const response = await GET(
      new Request('http://localhost/api/search?question_id=missing') as never
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: 'NotFound',
    });
  });

  it('returns 400 when the related document is not completed', async () => {
    findQuestionByIdMock.mockResolvedValue({
      id: 'q-1',
      text: '질문',
      documentId: 'doc-1',
      embedding: [0.1, 0.2],
    });
    findDocumentByIdMock.mockResolvedValue({
      id: 'doc-1',
      status: 'processing',
    });

    const response = await GET(
      new Request('http://localhost/api/search?question_id=q-1') as never
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      message: '문서 처리가 완료되지 않았습니다',
    });
  });

  it('returns filtered chunks ordered by similarity using the stored question embedding', async () => {
    findQuestionByIdMock.mockResolvedValue({
      id: 'q-1',
      text: '질문',
      documentId: 'doc-1',
      embedding: [0.1, 0.2],
    });
    findDocumentByIdMock.mockResolvedValue({
      id: 'doc-1',
      status: 'completed',
    });
    findChunksByDocumentIdMock.mockResolvedValue([
      { id: 'c-1', text: 'A', chunkIndex: 0, embedding: [1, 0] },
      { id: 'c-2', text: 'B', chunkIndex: 1, embedding: [0, 1] },
      { id: 'c-3', text: 'C', chunkIndex: 2, embedding: [0.5, 0.5] },
    ]);
    cosineSimilarityMock
      .mockReturnValueOnce(0.51)
      .mockReturnValueOnce(0.92)
      .mockReturnValueOnce(0.3);

    const response = await GET(
      new Request('http://localhost/api/search?question_id=q-1&limit=2') as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(generateTextEmbeddingMock).not.toHaveBeenCalled();
    expect(body.chunks).toEqual([
      { id: 'c-2', text: 'B', order: 1, similarity: 0.92 },
      { id: 'c-1', text: 'A', order: 0, similarity: 0.51 },
    ]);
    expect(body.fallback).toBe(false);
  });

  it('returns top fallback chunks when no result passes the threshold', async () => {
    findQuestionByIdMock.mockResolvedValue({
      id: 'q-1',
      text: '전혀 다른 질문',
      documentId: 'doc-1',
      embedding: [0.1, 0.2],
    });
    findDocumentByIdMock.mockResolvedValue({
      id: 'doc-1',
      status: 'completed',
    });
    findChunksByDocumentIdMock.mockResolvedValue([
      { id: 'c-1', text: 'A', chunkIndex: 0, embedding: [1, 0] },
      { id: 'c-2', text: 'B', chunkIndex: 1, embedding: [0, 1] },
      { id: 'c-3', text: 'C', chunkIndex: 2, embedding: [0.5, 0.5] },
    ]);
    cosineSimilarityMock
      .mockReturnValueOnce(0.21)
      .mockReturnValueOnce(0.34)
      .mockReturnValueOnce(0.12);

    const response = await GET(
      new Request('http://localhost/api/search?question_id=q-1&limit=5') as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.chunks).toEqual([
      { id: 'c-2', text: 'B', order: 1, similarity: 0.34 },
      { id: 'c-1', text: 'A', order: 0, similarity: 0.21 },
    ]);
    expect(body.fallback).toBe(true);
  });

  it('boosts chunks that contain matching keywords', async () => {
    findQuestionByIdMock.mockResolvedValue({
      id: 'q-1',
      text: '캐시 TTL 설정',
      documentId: 'doc-1',
      embedding: [0.1, 0.2],
    });
    findDocumentByIdMock.mockResolvedValue({
      id: 'doc-1',
      status: 'completed',
    });
    findChunksByDocumentIdMock.mockResolvedValue([
      {
        id: 'c-1',
        text: '캐시 TTL은 10분이며 프로젝트 멤버 목록은 5분입니다.',
        chunkIndex: 0,
        embedding: [1, 0],
      },
      {
        id: 'c-2',
        text: '모니터링 지표와 장애 대응 기준을 설명합니다.',
        chunkIndex: 1,
        embedding: [0, 1],
      },
    ]);
    cosineSimilarityMock.mockReturnValueOnce(0.41).mockReturnValueOnce(0.44);

    const response = await GET(
      new Request('http://localhost/api/search?question_id=q-1&limit=2') as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.chunks[0]).toMatchObject({
      id: 'c-1',
      order: 0,
    });
    expect(body.chunks[0].similarity).toBeCloseTo(0.543);
  });
});
