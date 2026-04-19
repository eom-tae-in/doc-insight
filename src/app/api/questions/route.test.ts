import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const { findByIdMock, createQuestionMock, generateTextEmbeddingMock } = vi.hoisted(() => ({
  findByIdMock: vi.fn(),
  createQuestionMock: vi.fn(),
  generateTextEmbeddingMock: vi.fn(),
}));

vi.mock('@/lib/database', () => ({
  documentRepository: {
    findById: findByIdMock,
  },
  questionRepository: {
    create: createQuestionMock,
  },
}));

vi.mock('@/lib/embeddings', () => ({
  generateTextEmbedding: generateTextEmbeddingMock,
}));

describe('POST /api/questions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when question text is missing', async () => {
    const response = await POST(
      new Request('http://localhost/api/questions', {
        method: 'POST',
        body: JSON.stringify({ document_id: 'doc-1' }),
      }) as never
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'BadRequest',
    });
  });

  it('returns 404 when the document does not exist', async () => {
    findByIdMock.mockResolvedValue(null);

    const response = await POST(
      new Request('http://localhost/api/questions', {
        method: 'POST',
        body: JSON.stringify({ question_text: '질문', document_id: 'missing' }),
      }) as never
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: 'NotFound',
    });
  });

  it('returns 400 when the document is not completed', async () => {
    findByIdMock.mockResolvedValue({
      id: 'doc-1',
      status: 'processing',
    });

    const response = await POST(
      new Request('http://localhost/api/questions', {
        method: 'POST',
        body: JSON.stringify({ question_text: '질문', document_id: 'doc-1' }),
      }) as never
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      message: '문서 처리가 완료되지 않았습니다',
    });
  });

  it('creates a question with an embedding for a completed document', async () => {
    findByIdMock.mockResolvedValue({
      id: 'doc-1',
      status: 'completed',
    });
    generateTextEmbeddingMock.mockResolvedValue([0.1, 0.2]);
    createQuestionMock.mockResolvedValue({
      id: 'q-1',
      createdAt: '2026-04-18T00:00:00.000Z',
    });

    const response = await POST(
      new Request('http://localhost/api/questions', {
        method: 'POST',
        body: JSON.stringify({ question_text: '질문', document_id: 'doc-1' }),
      }) as never
    );

    expect(response.status).toBe(200);
    expect(generateTextEmbeddingMock).toHaveBeenCalledWith('질문');
    expect(createQuestionMock).toHaveBeenCalledWith({
      text: '질문',
      documentId: 'doc-1',
      embedding: [0.1, 0.2],
    });
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { id: 'q-1' },
    });
  });

  it('maps rate-limit embedding errors to 429', async () => {
    findByIdMock.mockResolvedValue({
      id: 'doc-1',
      status: 'completed',
    });
    generateTextEmbeddingMock.mockRejectedValue(new Error('Rate limit exceeded'));

    const response = await POST(
      new Request('http://localhost/api/questions', {
        method: 'POST',
        body: JSON.stringify({ question_text: '질문', document_id: 'doc-1' }),
      }) as never
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      error: 'RateLimitError',
    });
  });
});
