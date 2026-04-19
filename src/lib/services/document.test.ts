import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentProcessService, DocumentUploadService } from './document';

const {
  parseDocumentBufferMock,
  splitDocumentMock,
  generateBatchEmbeddingsMock,
  countBatchTokensMock,
  countTokensMock,
} = vi.hoisted(() => ({
  parseDocumentBufferMock: vi.fn(),
  splitDocumentMock: vi.fn(),
  generateBatchEmbeddingsMock: vi.fn(),
  countBatchTokensMock: vi.fn(),
  countTokensMock: vi.fn(),
}));

vi.mock('../parsers', () => ({
  parseDocumentBuffer: parseDocumentBufferMock,
}));

vi.mock('../chunking', () => ({
  splitDocument: splitDocumentMock,
}));

vi.mock('../embeddings', () => ({
  generateBatchEmbeddings: generateBatchEmbeddingsMock,
  countBatchTokens: countBatchTokensMock,
  countTokens: countTokensMock,
}));

describe('DocumentUploadService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores the file and persists the resolved file path', async () => {
    const fileStorage = {
      save: vi.fn().mockResolvedValue('/tmp/docs/doc-1-renamed.pdf'),
    };
    const documentRepository = {
      create: vi.fn().mockResolvedValue({
        id: 'doc-1',
        fileName: 'sample.pdf',
        status: 'processing',
      }),
      updateFilePath: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    const service = new DocumentUploadService(
      fileStorage as never,
      documentRepository as never
    );

    const file = new File([Buffer.from('pdf')], 'sample.pdf', {
      type: 'application/pdf',
    });

    const result = await service.uploadDocument(file);

    expect(documentRepository.create).toHaveBeenCalledWith({
      fileName: 'sample.pdf',
      fileType: 'PDF',
      filePath: '',
    });
    expect(fileStorage.save).toHaveBeenCalledWith('doc-1', 'sample.pdf', expect.any(Buffer));
    expect(documentRepository.updateFilePath).toHaveBeenCalledWith(
      'doc-1',
      '/tmp/docs/doc-1-renamed.pdf'
    );
    expect(result).toEqual({
      id: 'doc-1',
      fileName: 'sample.pdf',
      status: 'processing',
    });
  });

  it('rejects unsupported file types before persistence', async () => {
    const documentRepository = {
      create: vi.fn(),
    };
    const service = new DocumentUploadService({} as never, documentRepository as never);
    const file = new File([Buffer.from('png')], 'image.png', { type: 'image/png' });

    await expect(service.uploadDocument(file)).rejects.toThrow('PDF, TXT, MD 파일만 지원됩니다');
    expect(documentRepository.create).not.toHaveBeenCalled();
  });

  it('rolls back the document record when file storage fails', async () => {
    const fileStorage = {
      save: vi.fn().mockRejectedValue(new Error('disk full')),
    };
    const documentRepository = {
      create: vi.fn().mockResolvedValue({
        id: 'doc-2',
        fileName: 'sample.pdf',
        status: 'processing',
      }),
      updateFilePath: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    const service = new DocumentUploadService(
      fileStorage as never,
      documentRepository as never
    );
    const file = new File([Buffer.from('pdf')], 'sample.pdf', { type: 'application/pdf' });

    await expect(service.uploadDocument(file)).rejects.toThrow('파일 저장에 실패했습니다');
    expect(documentRepository.delete).toHaveBeenCalledWith('doc-2');
    expect(documentRepository.updateFilePath).not.toHaveBeenCalled();
  });
});

describe('DocumentProcessService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parseDocumentBufferMock.mockReset();
    splitDocumentMock.mockReset();
    generateBatchEmbeddingsMock.mockReset();
    countBatchTokensMock.mockReset();
    countTokensMock.mockReset();
  });

  it('reads the stored file path, replaces old chunks, and marks the document completed', async () => {
    const fileStorage = {
      readByPath: vi.fn().mockResolvedValue(Buffer.from('stored-file')),
    };
    const documentRepository = {
      findById: vi.fn().mockResolvedValue({
        id: 'doc-1',
        fileType: 'PDF',
        filePath: '/tmp/docs/doc-1-renamed.pdf',
      }),
      updateStatus: vi.fn().mockResolvedValue(undefined),
    };
    const chunkRepository = {
      findByDocumentId: vi.fn().mockResolvedValue([{ id: 'old-1' }, { id: 'old-2' }]),
      delete: vi.fn().mockResolvedValue(undefined),
      create: vi.fn().mockResolvedValue(undefined),
    };

    parseDocumentBufferMock.mockResolvedValue('parsed text');
    splitDocumentMock.mockReturnValue(['chunk A', 'chunk B']);
    generateBatchEmbeddingsMock.mockResolvedValue([
      [0.1, 0.9],
      [0.2, 0.8],
    ]);
    countBatchTokensMock.mockReturnValue(24);

    const service = new DocumentProcessService(
      fileStorage as never,
      documentRepository as never,
      chunkRepository as never
    );

    const result = await service.processDocument('doc-1');

    expect(fileStorage.readByPath).toHaveBeenCalledWith('/tmp/docs/doc-1-renamed.pdf');
    expect(documentRepository.updateStatus).toHaveBeenNthCalledWith(1, 'doc-1', 'processing');
    expect(chunkRepository.findByDocumentId).toHaveBeenCalledWith('doc-1');
    expect(chunkRepository.delete).toHaveBeenCalledTimes(2);
    expect(chunkRepository.create).toHaveBeenNthCalledWith(1, {
      documentId: 'doc-1',
      chunkIndex: 0,
      text: 'chunk A',
      embedding: [0.1, 0.9],
    });
    expect(chunkRepository.create).toHaveBeenNthCalledWith(2, {
      documentId: 'doc-1',
      chunkIndex: 1,
      text: 'chunk B',
      embedding: [0.2, 0.8],
    });
    expect(documentRepository.updateStatus).toHaveBeenNthCalledWith(2, 'doc-1', 'completed');
    expect(result.totalChunks).toBe(2);
    expect(result.totalTokens).toBe(24);
  });

  it('marks the document failed when parsing throws', async () => {
    const fileStorage = {
      readByPath: vi.fn().mockResolvedValue(Buffer.from('stored-file')),
    };
    const documentRepository = {
      findById: vi.fn().mockResolvedValue({
        id: 'doc-err',
        fileType: 'PDF',
        filePath: '/tmp/docs/doc-err.pdf',
      }),
      updateStatus: vi.fn().mockResolvedValue(undefined),
    };
    const chunkRepository = {
      findByDocumentId: vi.fn(),
      delete: vi.fn(),
      create: vi.fn(),
    };

    parseDocumentBufferMock.mockRejectedValue(new Error('parser failed'));

    const service = new DocumentProcessService(
      fileStorage as never,
      documentRepository as never,
      chunkRepository as never
    );

    await expect(service.processDocument('doc-err')).rejects.toThrow('parser failed');
    expect(documentRepository.updateStatus).toHaveBeenNthCalledWith(1, 'doc-err', 'processing');
    expect(documentRepository.updateStatus).toHaveBeenNthCalledWith(2, 'doc-err', 'failed');
    expect(chunkRepository.create).not.toHaveBeenCalled();
  });

  it('falls back to a relaxed minTokens threshold for short documents', async () => {
    const fileStorage = {
      readByPath: vi.fn().mockResolvedValue(Buffer.from('stored-file')),
    };
    const documentRepository = {
      findById: vi.fn().mockResolvedValue({
        id: 'doc-short',
        fileType: 'PDF',
        filePath: '/tmp/docs/doc-short.pdf',
      }),
      updateStatus: vi.fn().mockResolvedValue(undefined),
    };
    const chunkRepository = {
      findByDocumentId: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
      create: vi.fn().mockResolvedValue(undefined),
    };

    parseDocumentBufferMock.mockResolvedValue('Short document. Still should be kept.');
    splitDocumentMock
      .mockReturnValueOnce([])
      .mockReturnValueOnce(['Short document. Still should be kept.']);
    generateBatchEmbeddingsMock.mockResolvedValue([[0.5, 0.5]]);
    countBatchTokensMock.mockReturnValue(10);
    countTokensMock.mockReturnValue(10);

    const service = new DocumentProcessService(
      fileStorage as never,
      documentRepository as never,
      chunkRepository as never
    );

    const result = await service.processDocument('doc-short');

    expect(splitDocumentMock).toHaveBeenNthCalledWith(1, 'Short document. Still should be kept.');
    expect(splitDocumentMock).toHaveBeenNthCalledWith(2, 'Short document. Still should be kept.', {
      minTokens: 1,
    });
    expect(chunkRepository.create).toHaveBeenCalledWith({
      documentId: 'doc-short',
      chunkIndex: 0,
      text: 'Short document. Still should be kept.',
      embedding: [0.5, 0.5],
    });
    expect(documentRepository.updateStatus).toHaveBeenNthCalledWith(2, 'doc-short', 'completed');
    expect(result.totalChunks).toBe(1);
  });
});
