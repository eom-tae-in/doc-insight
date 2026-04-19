export type DocumentStatus = 'processing' | 'completed' | 'failed';
export type FileType = 'PDF' | 'TXT' | 'MD';

export interface ErrorResponse {
  success?: false;
  error: string;
  message: string;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface DocumentChunkWithSimilarity {
  id: string;
  text: string;
  order: number;
  similarity: number;
}

export interface QuestionRequest {
  question_text: string;
  document_id: string;
}

export interface QuestionResponseData {
  id: string;
  created_at: string;
}

export type QuestionResponse = ApiSuccessResponse<QuestionResponseData>;

export interface SearchRequest {
  question_id: string;
  limit?: number;
}

export interface SearchResult {
  chunks: DocumentChunkWithSimilarity[];
  fallback: boolean;
}

export interface AnswerRequest {
  question_id: string;
  chunk_ids: string[];
}

export interface AnswerResponse {
  id: string;
  answer_text: string;
  chunks: DocumentChunkWithSimilarity[];
  created_at: string;
}

export interface DocumentUploadResponseData {
  id: string;
  fileName: string;
  status: DocumentStatus;
  message: string;
}

export type DocumentUploadResponse = ApiSuccessResponse<DocumentUploadResponseData>;

export interface DocumentProcessResponseData {
  documentId: string;
  chunkCount: number;
  totalTokens: number;
  processingTime: number;
  message: string;
}

export type DocumentProcessResponse = ApiSuccessResponse<DocumentProcessResponseData>;

export interface DocumentStatusResponseData {
  id: string;
  fileName: string;
  fileType: FileType;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
}

export type DocumentStatusResponse = ApiSuccessResponse<DocumentStatusResponseData>;
