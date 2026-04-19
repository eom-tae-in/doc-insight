import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PDFParse } from 'pdf-parse';

export type FileType = 'PDF' | 'TXT' | 'MD';

let configuredPdfWorkerSrc: string | null | undefined;

function resolvePdfWorkerSrc(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'node_modules/pdf-parse/dist/pdf-parse/cjs/pdf.worker.mjs'),
    path.resolve(process.cwd(), 'node_modules/pdf-parse/dist/worker/pdf.worker.mjs'),
  ];

  const workerPath = candidates.find((candidate) => existsSync(candidate));
  return workerPath ? pathToFileURL(workerPath).href : null;
}

function ensurePdfWorkerConfigured(): string | null {
  if (configuredPdfWorkerSrc !== undefined) {
    return configuredPdfWorkerSrc;
  }

  configuredPdfWorkerSrc = resolvePdfWorkerSrc();

  if (configuredPdfWorkerSrc) {
    PDFParse.setWorker(configuredPdfWorkerSrc);
  }

  return configuredPdfWorkerSrc;
}

/**
 * 파일 확장자로부터 파일 타입을 결정합니다.
 */
export function getFileType(filename: string): FileType {
  const ext = filename.split('.').pop()?.toUpperCase();

  switch (ext) {
    case 'PDF':
      return 'PDF';
    case 'TXT':
      return 'TXT';
    case 'MD':
    case 'MARKDOWN':
      return 'MD';
    default:
      throw new Error(`지원하지 않는 파일 형식: ${ext}`);
  }
}

/**
 * PDF 파일을 파싱하여 텍스트를 추출합니다.
 */
async function parsePDF(buffer: Buffer): Promise<string> {
  ensurePdfWorkerConfigured();
  const pdfParse = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    const data = await pdfParse.getText();
    return data.text;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`PDF 파싱 실패: ${errorMessage}`);
  } finally {
    await pdfParse.destroy();
  }
}

/**
 * TXT 또는 MD 파일을 파싱하여 텍스트를 추출합니다.
 */
function parseTextFile(buffer: Buffer): string {
  try {
    return buffer.toString('utf-8');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`텍스트 파일 파싱 실패: ${errorMessage}`);
  }
}

/**
 * Buffer를 파싱하여 텍스트를 추출합니다.
 * @param buffer 파일 버퍼
 * @param fileType 파일 타입 (PDF, TXT, MD)
 * @returns 추출된 텍스트
 */
export async function parseDocumentBuffer(
  buffer: Buffer,
  fileType: FileType
): Promise<string> {
  try {
    switch (fileType) {
      case 'PDF':
        return await parsePDF(buffer);
      case 'TXT':
      case 'MD':
        return parseTextFile(buffer);
      default:
        throw new Error(`지원하지 않는 파일 타입: ${fileType}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Document parsing failed:', errorMessage);
    throw error;
  }
}

/**
 * 파일을 파싱하여 텍스트를 추출합니다.
 * @param file 파일 객체
 * @param fileType 파일 타입 (PDF, TXT, MD)
 * @returns 추출된 텍스트
 */
export async function parseDocument(
  file: File,
  fileType: FileType
): Promise<string> {
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    return parseDocumentBuffer(buffer, fileType);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Document parsing failed:', errorMessage);
    throw error;
  }
}

/**
 * 파일명과 함께 파일을 파싱합니다.
 */
export async function parseDocumentByFilename(file: File): Promise<string> {
  const fileType = getFileType(file.name);
  return parseDocument(file, fileType);
}

export const parsers = {
  parseDocument,
  parseDocumentBuffer,
  parseDocumentByFilename,
  getFileType,
};

export const parserInternals = {
  ensurePdfWorkerConfigured,
  resolvePdfWorkerSrc,
};
