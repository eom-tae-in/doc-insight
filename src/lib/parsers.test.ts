import { beforeEach, describe, expect, it, vi } from 'vitest';

const setWorkerMock = vi.fn();
const getTextMock = vi.fn();
const destroyMock = vi.fn();
const existsSyncMock = vi.fn();

vi.mock('node:fs', () => ({
  existsSync: existsSyncMock,
}));

vi.mock('pdf-parse', () => ({
  PDFParse: class MockPDFParse {
    static setWorker = setWorkerMock;

    constructor() {}

    getText() {
      return getTextMock();
    }

    destroy() {
      return destroyMock();
    }
  },
}));

describe('parsers', () => {
  beforeEach(() => {
    vi.resetModules();
    setWorkerMock.mockReset();
    getTextMock.mockReset();
    destroyMock.mockReset();
    existsSyncMock.mockReset();
  });

  it('configures the pdf worker from an absolute file URL before parsing', async () => {
    existsSyncMock.mockImplementation((candidate: string) =>
      candidate.endsWith('node_modules/pdf-parse/dist/pdf-parse/cjs/pdf.worker.mjs')
    );
    getTextMock.mockResolvedValue({ text: 'parsed pdf text' });
    destroyMock.mockResolvedValue(undefined);

    const { parseDocumentBuffer } = await import('./parsers');

    await expect(
      parseDocumentBuffer(Buffer.from('%PDF-1.4'), 'PDF')
    ).resolves.toBe('parsed pdf text');

    expect(setWorkerMock).toHaveBeenCalledTimes(1);
    expect(setWorkerMock.mock.calls[0]?.[0]).toMatch(
      /^file:\/\/.+node_modules\/pdf-parse\/dist\/pdf-parse\/cjs\/pdf\.worker\.mjs$/
    );
    expect(destroyMock).toHaveBeenCalledTimes(1);
  });

  it('configures the pdf worker only once per module instance', async () => {
    existsSyncMock.mockReturnValue(true);
    getTextMock.mockResolvedValue({ text: 'parsed pdf text' });
    destroyMock.mockResolvedValue(undefined);

    const { parseDocumentBuffer } = await import('./parsers');

    await parseDocumentBuffer(Buffer.from('%PDF-1.4'), 'PDF');
    await parseDocumentBuffer(Buffer.from('%PDF-1.4'), 'PDF');

    expect(setWorkerMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to default library behavior when no worker file is found', async () => {
    existsSyncMock.mockReturnValue(false);
    getTextMock.mockRejectedValue(new Error('no worker available'));
    destroyMock.mockResolvedValue(undefined);

    const { parseDocumentBuffer } = await import('./parsers');

    await expect(
      parseDocumentBuffer(Buffer.from('%PDF-1.4'), 'PDF')
    ).rejects.toThrow('PDF 파싱 실패: no worker available');

    expect(setWorkerMock).not.toHaveBeenCalled();
    expect(destroyMock).toHaveBeenCalledTimes(1);
  });
});
