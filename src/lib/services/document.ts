import { FileStorage } from '../file-storage';
import { DocumentRepository, DocumentChunkRepository } from '../database';
import { parseDocumentBuffer } from '../parsers';
import { splitDocument } from '../chunking';
import { generateBatchEmbeddings, countBatchTokens, countTokens } from '../embeddings';
import type { FileType, Status } from '@/generated/prisma/enums';

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '104857600', 10);

const ALLOWED_FORMATS = new Map<string, FileType>([
  ['application/pdf', 'PDF'],
  ['text/plain', 'TXT'],
  ['text/markdown', 'MD'],
]);

export interface UploadResponse {
  id: string;
  fileName: string;
  status: Status;
}

export class DocumentUploadService {
  private fileStorage: FileStorage;
  private documentRepository: DocumentRepository;

  constructor(
    fileStorage?: FileStorage,
    documentRepository?: DocumentRepository
  ) {
    this.fileStorage = fileStorage || new FileStorage();
    this.documentRepository = documentRepository || new DocumentRepository();
  }

  async uploadDocument(file: File): Promise<UploadResponse> {
    // 1. 파일 검증
    this.validateFile(file);

    // 2. FileType 결정
    const fileType = ALLOWED_FORMATS.get(file.type);
    if (!fileType) {
      throw new Error('지원하지 않는 파일 형식입니다');
    }

    // 3. Document 생성 (먼저 생성하여 documentId 확보)
    const document = await this.documentRepository.create({
      fileName: file.name,
      fileType: fileType,
      filePath: '', // 임시값 (파일 저장 후 업데이트)
    });

    // 4. 파일 저장 (documentId 기반으로 저장, 실제 경로 확인)
    let savedFilePath: string;
    try {
      const buffer = await this.fileArrayBufferToBuffer(file);
      savedFilePath = await this.fileStorage.save(document.id, file.name, buffer);
    } catch (fileError) {
      // 파일 저장 실패 시 Document 삭제 (롤백)
      try {
        await this.documentRepository.delete(document.id);
      } catch (rollbackError) {
        console.error(`[CRITICAL] 롤백 실패, 고아 Document 레코드: ${document.id}`, rollbackError);
      }
      console.error('파일 저장 실패:', fileError);
      throw new Error('파일 저장에 실패했습니다');
    }

    // 5. Document filePath 업데이트
    await this.documentRepository.updateFilePath(document.id, savedFilePath);

    // 6. 성공 응답
    return {
      id: document.id,
      fileName: document.fileName,
      status: document.status,
    };
  }

  private validateFile(file: File): void {
    if (!file) {
      throw new Error('파일이 없습니다');
    }

    if (!ALLOWED_FORMATS.has(file.type)) {
      throw new Error('PDF, TXT, MD 파일만 지원됩니다');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`파일 크기가 최대 크기(${MAX_FILE_SIZE} bytes)를 초과합니다`);
    }
  }

  private async fileArrayBufferToBuffer(file: File): Promise<Buffer> {
    const arrayBuffer = await file.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}

export const documentUploadService = new DocumentUploadService();

export interface ProcessResponse {
  totalChunks: number;
  totalTokens: number;
  processingTime: number;
}

export class DocumentProcessService {
  private fileStorage: FileStorage;
  private documentRepository: DocumentRepository;
  private chunkRepository: DocumentChunkRepository;

  constructor(
    fileStorage?: FileStorage,
    documentRepository?: DocumentRepository,
    chunkRepository?: DocumentChunkRepository
  ) {
    this.fileStorage = fileStorage || new FileStorage();
    this.documentRepository = documentRepository || new DocumentRepository();
    this.chunkRepository = chunkRepository || new DocumentChunkRepository();
  }

  async processDocument(documentId: string): Promise<ProcessResponse> {
    const startTime = Date.now();

    try {
      // 1. Document 조회
      const document = await this.documentRepository.findById(documentId);
      if (!document) {
        throw new Error(`Document not found: ${documentId}`);
      }

      // 2. 파일 읽기 (저장된 filePath 사용)
      if (!document.filePath) {
        throw new Error(`파일 경로가 없습니다: ${documentId}`);
      }
      await this.documentRepository.updateStatus(documentId, 'processing');
      const fileBuffer = await this.fileStorage.readByPath(document.filePath);

      // 3. 텍스트 추출
      const text = await parseDocumentBuffer(fileBuffer, document.fileType);

      // 4. 문서 분할
      let chunks = splitDocument(text);
      if (chunks.length === 0 && countTokens(text.trim()) > 0) {
        // Short documents can fall below the default minTokens threshold.
        chunks = splitDocument(text, { minTokens: 1 });
      }
      if (chunks.length === 0) {
        throw new Error('문서 분할 실패: 유효한 청크가 없습니다');
      }

      // 5. 병렬 임베딩 생성
      const embeddings = await generateBatchEmbeddings(chunks);

      // 6. 청크와 임베딩 매핑
      const chunkWithEmbeddings = chunks.map((chunkText, index) => ({
        documentId,
        chunkIndex: index,
        text: chunkText,
        embedding: embeddings[index],
      }));

      // 7. 기존 청크 정리 (idempotency: 재처리 시 중복 방지)
      const existingChunks = await this.chunkRepository.findByDocumentId(documentId);
      for (const chunk of existingChunks) {
        await this.chunkRepository.delete(chunk.id);
      }

      // 8. 새 청크 저장
      for (const chunk of chunkWithEmbeddings) {
        await this.chunkRepository.create({
          documentId: chunk.documentId,
          chunkIndex: chunk.chunkIndex,
          text: chunk.text,
          embedding: chunk.embedding,
        });
      }

      // 9. Document status 업데이트 (processing → completed)
      await this.documentRepository.updateStatus(documentId, 'completed');

      const totalTokens = countBatchTokens(chunks);
      const processingTime = Date.now() - startTime;

      console.log(
        `✅ 문서 처리 완료: ${chunks.length}개 청크, ${totalTokens}토큰, ${processingTime}ms`
      );

      return {
        totalChunks: chunks.length,
        totalTokens,
        processingTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ 문서 처리 실패 (${documentId}):`, errorMessage);

      // 실패 시 Document status를 'failed'로 업데이트
      try {
        await this.documentRepository.updateStatus(documentId, 'failed');
      } catch (statusError) {
        console.error(`상태 업데이트 실패 (${documentId}):`, statusError);
      }

      throw error;
    }
  }
}

export const documentProcessService = new DocumentProcessService();
