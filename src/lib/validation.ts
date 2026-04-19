import { z } from 'zod';

/**
 * 애플리케이션 시작 시 필수 환경 변수를 검증합니다.
 * @throws {Error} 필수 환경 변수가 누락된 경우
 */
export function validateEnv(): void {
  const required = ['DATABASE_URL', 'OPENAI_API_KEY'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
      `Please check your .env file and ensure all variables are set.`
    );
  }
}

// Zod 스키마 정의
export const DocumentCreateSchema = z.object({
  id: z.string().optional(),
  fileName: z.string().min(1, '파일명은 필수입니다').max(255, '파일명은 255자 이내여야 합니다'),
  fileType: z.enum(['PDF', 'TXT', 'MD'], { message: '파일 타입은 PDF, TXT, MD 중 하나여야 합니다' }),
  filePath: z.string().optional().default(''),
  content: z.string().optional().nullable(),
});

export const DocumentUpdateSchema = z.object({
  fileName: z.string().min(1, '파일명은 필수입니다').max(255, '파일명은 255자 이내여야 합니다').optional(),
  fileType: z.enum(['PDF', 'TXT', 'MD'], { message: '파일 타입은 PDF, TXT, MD 중 하나여야 합니다' }).optional(),
  content: z.string().nullable().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: '최소 하나 이상의 필드를 업데이트해야 합니다' }
);

export const DocumentChunkCreateSchema = z.object({
  id: z.string().optional(),
  documentId: z.string().min(1, 'documentId는 필수입니다'),
  chunkIndex: z.number().int().nonnegative('chunkIndex는 0 이상이어야 합니다'),
  text: z.string().min(1, '텍스트는 필수입니다').max(5000, '텍스트는 5000자 이내여야 합니다'),
  embedding: z.array(z.number()).optional().nullable(),
});

export const DocumentChunkUpdateSchema = z.object({
  text: z.string().min(1, '텍스트는 필수입니다').max(5000, '텍스트는 5000자 이내여야 합니다').optional(),
  embedding: z.array(z.number()).nullable().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: '최소 하나 이상의 필드를 업데이트해야 합니다' }
);

export const QuestionCreateSchema = z.object({
  id: z.string().optional(),
  documentId: z.string().min(1, 'documentId는 필수입니다'),
  text: z.string().min(1, '질문 텍스트는 필수입니다').max(1000, '질문 텍스트는 1000자 이내여야 합니다'),
  embedding: z.array(z.number()).optional().nullable(),
});

export const QuestionUpdateSchema = z.object({
  text: z.string().min(1, '질문 텍스트는 필수입니다').max(1000, '질문 텍스트는 1000자 이내여야 합니다').optional(),
  embedding: z.array(z.number()).nullable().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: '최소 하나 이상의 필드를 업데이트해야 합니다' }
);

export const AnswerCreateSchema = z.object({
  id: z.string().optional(),
  questionId: z.string().min(1, 'questionId는 필수입니다'),
  text: z.string().min(1, '답변 텍스트는 필수입니다').max(5000, '답변 텍스트는 5000자 이내여야 합니다'),
  chunkIds: z.array(z.string()).optional(),
});

export const AnswerUpdateSchema = z.object({
  text: z.string().min(1, '답변 텍스트는 필수입니다').max(5000, '답변 텍스트는 5000자 이내여야 합니다').optional(),
  chunkIds: z.array(z.string()).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: '최소 하나 이상의 필드를 업데이트해야 합니다' }
);

// 검증 함수
export function parseDocumentCreate(data: unknown): z.infer<typeof DocumentCreateSchema> {
  try {
    return DocumentCreateSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Document 검증 실패: ${error.issues.map((e: z.ZodIssue) => e.message).join(', ')}`);
    }
    throw error;
  }
}

export function parseDocumentChunkCreate(data: unknown): z.infer<typeof DocumentChunkCreateSchema> {
  try {
    return DocumentChunkCreateSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`DocumentChunk 검증 실패: ${error.issues.map((e: z.ZodIssue) => e.message).join(', ')}`);
    }
    throw error;
  }
}

export function parseQuestionCreate(data: unknown): z.infer<typeof QuestionCreateSchema> {
  try {
    return QuestionCreateSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Question 검증 실패: ${error.issues.map((e: z.ZodIssue) => e.message).join(', ')}`);
    }
    throw error;
  }
}

export function parseAnswerCreate(data: unknown): z.infer<typeof AnswerCreateSchema> {
  try {
    return AnswerCreateSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Answer 검증 실패: ${error.issues.map((e: z.ZodIssue) => e.message).join(', ')}`);
    }
    throw error;
  }
}

export function parseDocumentUpdate(data: unknown): z.infer<typeof DocumentUpdateSchema> {
  try {
    return DocumentUpdateSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Document 업데이트 검증 실패: ${error.issues.map((e: z.ZodIssue) => e.message).join(', ')}`);
    }
    throw error;
  }
}

export function parseDocumentChunkUpdate(data: unknown): z.infer<typeof DocumentChunkUpdateSchema> {
  try {
    return DocumentChunkUpdateSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`DocumentChunk 업데이트 검증 실패: ${error.issues.map((e: z.ZodIssue) => e.message).join(', ')}`);
    }
    throw error;
  }
}

export function parseQuestionUpdate(data: unknown): z.infer<typeof QuestionUpdateSchema> {
  try {
    return QuestionUpdateSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Question 업데이트 검증 실패: ${error.issues.map((e: z.ZodIssue) => e.message).join(', ')}`);
    }
    throw error;
  }
}

export function parseAnswerUpdate(data: unknown): z.infer<typeof AnswerUpdateSchema> {
  try {
    return AnswerUpdateSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Answer 업데이트 검증 실패: ${error.issues.map((e: z.ZodIssue) => e.message).join(', ')}`);
    }
    throw error;
  }
}

/**
 * 환경 변수 값을 안전하게 가져옵니다.
 * 프로덕션 환경에서 안전한 접근을 보장합니다.
 */
export const env = {
  database: {
    url: process.env.DATABASE_URL || '',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
  embedding: {
    model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    dimension: parseInt(process.env.EMBEDDING_DIMENSION || '1536'),
  },
  llm: {
    model: process.env.LLM_MODEL || 'gpt-4o',
    timeout: parseInt(process.env.LLM_TIMEOUT || '30'),
  },
  search: {
    resultLimit: parseInt(process.env.SEARCH_RESULT_LIMIT || '5'),
    similarityThreshold: parseFloat(process.env.SIMILARITY_THRESHOLD || '0.5'),
  },
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600'),
    directory: process.env.UPLOAD_DIR || './uploads',
  },
  processing: {
    timeout: parseInt(process.env.DOCUMENT_PROCESSING_TIMEOUT || '1800'),
  },
};
