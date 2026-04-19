import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const {
  findQuestionByIdMock,
  findChunkByIdMock,
  createAnswerMock,
  generateAnswerMock,
  generateTextEmbeddingMock,
  cosineSimilarityMock,
} = vi.hoisted(() => ({
  findQuestionByIdMock: vi.fn(),
  findChunkByIdMock: vi.fn(),
  createAnswerMock: vi.fn(),
  generateAnswerMock: vi.fn(),
  generateTextEmbeddingMock: vi.fn(),
  cosineSimilarityMock: vi.fn(),
}));

vi.mock('@/lib/database', () => ({
  questionRepository: {
    findById: findQuestionByIdMock,
  },
  documentChunkRepository: {
    findById: findChunkByIdMock,
  },
  answerRepository: {
    create: createAnswerMock,
  },
}));

vi.mock('@/lib/llm', () => ({
  generateAnswer: generateAnswerMock,
}));

vi.mock('@/lib/embeddings', () => ({
  generateTextEmbedding: generateTextEmbeddingMock,
  cosineSimilarity: cosineSimilarityMock,
}));

describe('POST /api/answers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when question_id is missing', async () => {
    const response = await POST(
      new Request('http://localhost/api/answers', {
        method: 'POST',
        body: JSON.stringify({ chunk_ids: ['c-1'] }),
      }) as never
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'BadRequest',
    });
  });

  it('returns 404 when the question does not exist', async () => {
    findQuestionByIdMock.mockResolvedValue(null);

    const response = await POST(
      new Request('http://localhost/api/answers', {
        method: 'POST',
        body: JSON.stringify({ question_id: 'missing', chunk_ids: ['c-1'] }),
      }) as never
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: 'NotFound',
    });
  });

  it('returns 400 when chunks do not belong to the question document', async () => {
    findQuestionByIdMock.mockResolvedValue({
      id: 'q-1',
      text: '질문',
      documentId: 'doc-1',
      embedding: [0.1, 0.2],
    });
    findChunkByIdMock
      .mockResolvedValueOnce({ id: 'c-1', documentId: 'doc-2', text: '다른 문서', chunkIndex: 0 })
      .mockResolvedValueOnce(null);

    const response = await POST(
      new Request('http://localhost/api/answers', {
        method: 'POST',
        body: JSON.stringify({ question_id: 'q-1', chunk_ids: ['c-1', 'c-2'] }),
      }) as never
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'BadRequest',
    });
  });

  it('uses the stored question text, saves the answer, and returns chunk scores', async () => {
    findQuestionByIdMock.mockResolvedValue({
      id: 'q-1',
      text: '저장된 질문',
      documentId: 'doc-1',
      embedding: [0.3, 0.7],
    });
    findChunkByIdMock
      .mockResolvedValueOnce({
        id: 'c-1',
        documentId: 'doc-1',
        text: '첫 번째 청크',
        chunkIndex: 0,
        embedding: [1, 0],
      })
      .mockResolvedValueOnce({
        id: 'c-2',
        documentId: 'doc-1',
        text: '두 번째 청크',
        chunkIndex: 1,
        embedding: [0, 1],
      });
    generateAnswerMock.mockResolvedValue('생성된 답변');
    createAnswerMock.mockResolvedValue({
      id: 'a-1',
      text: '생성된 답변',
      createdAt: '2026-04-18T00:00:00.000Z',
    });
    cosineSimilarityMock.mockReturnValueOnce(0.82).mockReturnValueOnce(0.76);

    const response = await POST(
      new Request('http://localhost/api/answers', {
        method: 'POST',
        body: JSON.stringify({
          question_id: 'q-1',
          question_text: '클라이언트가 보낸 질문',
          chunk_ids: ['c-1', 'c-2'],
        }),
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(generateAnswerMock).toHaveBeenCalledWith(
      '저장된 질문',
      '첫 번째 청크\n\n두 번째 청크'
    );
    expect(generateTextEmbeddingMock).not.toHaveBeenCalled();
    expect(createAnswerMock).toHaveBeenCalledWith({
      questionId: 'q-1',
      text: '생성된 답변',
      chunkIds: ['c-1', 'c-2'],
    });
    expect(body).toMatchObject({
      id: 'a-1',
      answer_text: '생성된 답변',
      chunks: [
        { id: 'c-1', order: 0, similarity: 0.82 },
        { id: 'c-2', order: 1, similarity: 0.76 },
      ],
    });
  });

  it('maps llm rate-limit errors to 429', async () => {
    findQuestionByIdMock.mockResolvedValue({
      id: 'q-1',
      text: '저장된 질문',
      documentId: 'doc-1',
      embedding: [0.3, 0.7],
    });
    findChunkByIdMock.mockResolvedValue({
      id: 'c-1',
      documentId: 'doc-1',
      text: '첫 번째 청크',
      chunkIndex: 0,
      embedding: [1, 0],
    });
    generateAnswerMock.mockRejectedValue(Object.assign(new Error('rate limited'), { status: 429 }));

    const response = await POST(
      new Request('http://localhost/api/answers', {
        method: 'POST',
        body: JSON.stringify({ question_id: 'q-1', chunk_ids: ['c-1'] }),
      }) as never
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      error: 'RateLimitError',
      message: 'rate limited',
    });
  });
});
