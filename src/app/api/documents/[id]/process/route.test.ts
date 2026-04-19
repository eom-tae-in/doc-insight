import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const { processDocumentMock } = vi.hoisted(() => ({
  processDocumentMock: vi.fn(),
}));

vi.mock('@/lib/services/document', () => ({
  documentProcessService: {
    processDocument: processDocumentMock,
  },
}));

describe('POST /api/documents/[id]/process', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with processing metrics when service succeeds', async () => {
    processDocumentMock.mockResolvedValue({
      totalChunks: 3,
      totalTokens: 123,
      processingTime: 456,
    });

    const response = await POST(new Request('http://localhost/api/documents/doc-1/process') as never, {
      params: Promise.resolve({ id: 'doc-1' }),
    });

    expect(response.status).toBe(200);
    expect(processDocumentMock).toHaveBeenCalledWith('doc-1');
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        documentId: 'doc-1',
        chunkCount: 3,
        totalTokens: 123,
      },
    });
  });

  it('returns 404 when document is not found', async () => {
    processDocumentMock.mockRejectedValue(new Error('Document not found: missing'));

    const response = await POST(
      new Request('http://localhost/api/documents/missing/process') as never,
      { params: Promise.resolve({ id: 'missing' }) }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: 'NotFound',
    });
  });

  it('returns 500 for generic processing errors', async () => {
    processDocumentMock.mockRejectedValue(new Error('parser failure'));

    const response = await POST(
      new Request('http://localhost/api/documents/doc-2/process') as never,
      { params: Promise.resolve({ id: 'doc-2' }) }
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: 'ProcessingFailed',
      message: 'parser failure',
    });
  });
});
