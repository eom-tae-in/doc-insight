import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const { uploadDocumentMock, processDocumentMock } = vi.hoisted(() => ({
  uploadDocumentMock: vi.fn(),
  processDocumentMock: vi.fn(),
}));

vi.mock('@/lib/services/document', () => ({
  documentUploadService: {
    uploadDocument: uploadDocumentMock,
  },
  documentProcessService: {
    processDocument: processDocumentMock,
  },
}));

describe('POST /api/documents/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when file is missing', async () => {
    const formData = new FormData();
    const response = await POST(
      new Request('http://localhost/api/documents/upload', {
        method: 'POST',
        body: formData,
      }) as never
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: 'BadRequest',
    });
  });

  it('returns 201 completed when upload and processing both succeed', async () => {
    uploadDocumentMock.mockResolvedValue({
      id: 'doc-1',
      fileName: 'sample.pdf',
      status: 'processing',
    });
    processDocumentMock.mockResolvedValue({
      totalChunks: 2,
      totalTokens: 20,
      processingTime: 10,
    });

    const formData = new FormData();
    formData.append('file', new File([Buffer.from('pdf')], 'sample.pdf', { type: 'application/pdf' }));

    const response = await POST(
      new Request('http://localhost/api/documents/upload', {
        method: 'POST',
        body: formData,
      }) as never
    );

    expect(response.status).toBe(201);
    expect(uploadDocumentMock).toHaveBeenCalledTimes(1);
    expect(processDocumentMock).toHaveBeenCalledWith('doc-1');
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        id: 'doc-1',
        fileName: 'sample.pdf',
        status: 'completed',
      },
    });
  });

  it('returns 201 failed when processing fails after upload', async () => {
    uploadDocumentMock.mockResolvedValue({
      id: 'doc-2',
      fileName: 'sample.pdf',
      status: 'processing',
    });
    processDocumentMock.mockRejectedValue(new Error('processing failed'));

    const formData = new FormData();
    formData.append('file', new File([Buffer.from('pdf')], 'sample.pdf', { type: 'application/pdf' }));

    const response = await POST(
      new Request('http://localhost/api/documents/upload', {
        method: 'POST',
        body: formData,
      }) as never
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        id: 'doc-2',
        status: 'failed',
      },
    });
  });

  it('maps unsupported format errors to 400', async () => {
    uploadDocumentMock.mockRejectedValue(new Error('지원하지 않는 파일 형식입니다'));

    const formData = new FormData();
    formData.append('file', new File([Buffer.from('png')], 'image.png', { type: 'image/png' }));

    const response = await POST(
      new Request('http://localhost/api/documents/upload', {
        method: 'POST',
        body: formData,
      }) as never
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: 'BadRequest',
    });
  });
});
