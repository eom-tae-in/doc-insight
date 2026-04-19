import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as uploadPOST } from '@/app/api/documents/upload/route';
import { POST as questionsPOST } from '@/app/api/questions/route';
import { POST as answersPOST } from '@/app/api/answers/route';

// Mock services and libraries
const {
  uploadDocumentMock,
  processDocumentMock,
  createQuestionMock,
  generateTextEmbeddingMock,
  generateAnswerMock,
} = vi.hoisted(() => ({
  uploadDocumentMock: vi.fn(),
  processDocumentMock: vi.fn(),
  createQuestionMock: vi.fn(),
  generateTextEmbeddingMock: vi.fn(),
  generateAnswerMock: vi.fn(),
}));

vi.mock('@/lib/services/document', () => ({
  documentUploadService: {
    uploadDocument: uploadDocumentMock,
  },
  documentProcessService: {
    processDocument: processDocumentMock,
  },
}));

vi.mock('@/lib/database', () => ({
  documentRepository: {
    findById: vi.fn().mockResolvedValue({
      id: 'doc-1',
      fileName: 'test.pdf',
      status: 'completed',
    }),
  },
  questionRepository: {
    create: createQuestionMock,
  },
  chunkRepository: {
    findByDocumentId: vi.fn().mockResolvedValue([
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        text: 'Test content chunk 1',
        embedding: new Array(1536).fill(0.1),
        chunkIndex: 0,
      },
      {
        id: 'chunk-2',
        documentId: 'doc-1',
        text: 'Test content chunk 2',
        embedding: new Array(1536).fill(0.2),
        chunkIndex: 1,
      },
    ]),
  },
}));

vi.mock('@/lib/embeddings', () => ({
  generateTextEmbedding: generateTextEmbeddingMock,
}));

vi.mock('@/lib/llm', () => ({
  generateAnswer: generateAnswerMock,
}));

vi.mock('@/lib/vector', () => ({
  cosineSimilarity: vi.fn().mockReturnValue(0.85),
}));

describe('End-to-End Workflow Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Document Upload and Processing Flow', () => {
    it('should upload document and trigger processing', async () => {
      const documentId = 'doc-workflow-1';

      uploadDocumentMock.mockResolvedValue({
        id: documentId,
        fileName: 'workflow-test.pdf',
        status: 'completed',
      });

      processDocumentMock.mockResolvedValue({
        totalChunks: 2,
        totalTokens: 100,
        processingTime: 5,
      });

      const formData = new FormData();
      formData.append(
        'file',
        new File([Buffer.from('test-content')], 'workflow-test.pdf', {
          type: 'application/pdf',
        })
      );

      const response = await uploadPOST(
        new Request('http://localhost/api/documents/upload', {
          method: 'POST',
          body: formData,
        }) as never
      );

      expect(response.status).toBe(201);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.id).toBe(documentId);
      expect(uploadDocumentMock).toHaveBeenCalledTimes(1);
      expect(processDocumentMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Question and Answer Flow', () => {
    it('should call embedding and question creation when question is submitted', async () => {
      const embeddingVector = new Array(1536).fill(0.5);
      const questionText = 'What is the document about?';

      generateTextEmbeddingMock.mockResolvedValue(embeddingVector);
      createQuestionMock.mockResolvedValue({
        id: 'q-1',
        documentId: 'doc-1',
        text: questionText,
        embedding: embeddingVector,
        createdAt: new Date(),
      });

      const response = await questionsPOST(
        new Request('http://localhost/api/questions', {
          method: 'POST',
          body: JSON.stringify({
            document_id: 'doc-1',
            question_text: questionText,
          }),
        }) as never
      );

      // Verify integration of embedding and storage
      expect(response.status).toBe(200);
      expect(generateTextEmbeddingMock).toHaveBeenCalledWith(questionText);
      expect(createQuestionMock).toHaveBeenCalled();
    });
  });

  describe('API Response Format Consistency', () => {
    it('upload API returns success with document data', async () => {
      uploadDocumentMock.mockResolvedValue({
        id: 'doc-format-1',
        fileName: 'format-test.pdf',
        status: 'completed',
      });

      processDocumentMock.mockResolvedValue({
        totalChunks: 1,
        totalTokens: 50,
        processingTime: 2,
      });

      const formData = new FormData();
      formData.append(
        'file',
        new File([Buffer.from('format')], 'format-test.pdf', {
          type: 'application/pdf',
        })
      );

      const response = await uploadPOST(
        new Request('http://localhost/api/documents/upload', {
          method: 'POST',
          body: formData,
        }) as never
      );

      expect(response.status).toBe(201);
      const data = await response.json();

      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('data');
      expect(data.success).toBe(true);
    });

    it('all success responses include success and data fields', async () => {
      uploadDocumentMock.mockResolvedValue({
        id: 'doc-consistency-1',
        fileName: 'consistency-test.pdf',
        status: 'completed',
      });

      processDocumentMock.mockResolvedValue({
        totalChunks: 1,
        totalTokens: 50,
        processingTime: 2,
      });

      const formData = new FormData();
      formData.append(
        'file',
        new File([Buffer.from('test')], 'consistency-test.pdf', {
          type: 'application/pdf',
        })
      );

      const response = await uploadPOST(
        new Request('http://localhost/api/documents/upload', {
          method: 'POST',
          body: formData,
        }) as never
      );

      const data = await response.json();

      // All success responses should have consistent structure
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('data');
    });
  });

  describe('Error Handling', () => {
    it('question API returns 400 when question_text is missing', async () => {
      const response = await questionsPOST(
        new Request('http://localhost/api/questions', {
          method: 'POST',
          body: JSON.stringify({
            document_id: 'doc-1',
          }),
        }) as never
      );

      expect(response.status).toBe(400);
      const data = await response.json();

      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('message');
    });

    it('answer API returns 400 when required fields are missing', async () => {
      const response = await answersPOST(
        new Request('http://localhost/api/answers', {
          method: 'POST',
          body: JSON.stringify({
            question_id: 'q-1',
          }),
        }) as never
      );

      expect(response.status).toBe(400);
      const data = await response.json();

      expect(data).toHaveProperty('error');
    });
  });

  describe('Data Integrity', () => {
    it('question creation should call embedding generation', async () => {
      const embeddingVector = new Array(1536).fill(0.7);
      const questionText = 'Data integrity test';

      generateTextEmbeddingMock.mockResolvedValue(embeddingVector);
      createQuestionMock.mockResolvedValue({
        id: 'q-integrity-1',
        documentId: 'doc-1',
        text: questionText,
        embedding: embeddingVector,
        createdAt: new Date(),
      });

      await questionsPOST(
        new Request('http://localhost/api/questions', {
          method: 'POST',
          body: JSON.stringify({
            document_id: 'doc-1',
            question_text: questionText,
          }),
        }) as never
      );

      // Verify embedding generation was called with correct text
      expect(generateTextEmbeddingMock).toHaveBeenCalledWith(questionText);
      expect(createQuestionMock).toHaveBeenCalled();
    });

    it('document upload should persist filename in response', async () => {
      const fileName = 'important-document.pdf';

      uploadDocumentMock.mockResolvedValue({
        id: 'doc-metadata-1',
        fileName,
        status: 'completed',
      });

      processDocumentMock.mockResolvedValue({
        totalChunks: 1,
        totalTokens: 50,
        processingTime: 2,
      });

      const formData = new FormData();
      formData.append('file', new File([Buffer.from('content')], fileName, {
        type: 'application/pdf',
      }));

      const response = await uploadPOST(
        new Request('http://localhost/api/documents/upload', {
          method: 'POST',
          body: formData,
        }) as never
      );

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.fileName).toBe(fileName);
    });
  });
});
