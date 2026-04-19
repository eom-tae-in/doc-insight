import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const { findByIdMock } = vi.hoisted(() => ({
  findByIdMock: vi.fn(),
}));

vi.mock('@/lib/database', () => ({
  DocumentRepository: class MockDocumentRepository {
    findById = findByIdMock;
  },
}));

describe('GET /api/documents/[id]/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with document status data', async () => {
    findByIdMock.mockResolvedValue({
      id: 'doc-1',
      fileName: 'sample.pdf',
      fileType: 'PDF',
      status: 'completed',
      createdAt: '2026-04-18T00:00:00.000Z',
      updatedAt: '2026-04-18T00:00:00.000Z',
    });

    const response = await GET(new Request('http://localhost/api/documents/doc-1/status') as never, {
      params: Promise.resolve({ id: 'doc-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        id: 'doc-1',
        fileName: 'sample.pdf',
        status: 'completed',
      },
    });
  });

  it('returns 404 when document is missing', async () => {
    findByIdMock.mockResolvedValue(null);

    const response = await GET(
      new Request('http://localhost/api/documents/missing/status') as never,
      { params: Promise.resolve({ id: 'missing' }) }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: 'NotFound',
    });
  });

  it('returns 500 when repository throws', async () => {
    findByIdMock.mockRejectedValue(new Error('db failure'));

    const response = await GET(
      new Request('http://localhost/api/documents/doc-2/status') as never,
      { params: Promise.resolve({ id: 'doc-2' }) }
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: 'InternalServerError',
      message: 'db failure',
    });
  });
});
