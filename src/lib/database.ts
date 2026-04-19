import { PrismaClient, Prisma } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import type { DocumentModel } from '../generated/prisma/models/Document';
import type { DocumentChunkModel } from '../generated/prisma/models/DocumentChunk';
import type { QuestionModel } from '../generated/prisma/models/Question';
import type { AnswerModel } from '../generated/prisma/models/Answer';
import type { FileType, Status } from '../generated/prisma/enums';
import {
  parseDocumentCreate,
  parseDocumentChunkCreate,
  parseQuestionCreate,
  parseAnswerCreate,
  parseDocumentUpdate,
  parseDocumentChunkUpdate,
  parseQuestionUpdate,
  parseAnswerUpdate,
} from './validation';

let prismaClient: PrismaClient | null = null;

function getPrismaClient(): PrismaClient {
  if (!prismaClient) {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    prismaClient = new PrismaClient({ adapter });
  }
  return prismaClient;
}

function toJsonValue(embedding: number[] | null | undefined): Prisma.InputJsonValue | undefined {
  return embedding ?? undefined;
}

export class DocumentRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = getPrismaClient();
  }

  async create(data: {
    id?: string;
    fileName: string;
    fileType: FileType;
    filePath: string;
    content?: string | null;
  }): Promise<DocumentModel> {
    const validated = parseDocumentCreate(data);
    return this.prisma.document.create({
      data: {
        id: validated.id,
        fileName: validated.fileName,
        fileType: validated.fileType as FileType,
        filePath: validated.filePath,
        content: validated.content,
      },
    });
  }

  async findById(id: string): Promise<DocumentModel | null> {
    return this.prisma.document.findUnique({
      where: { id },
    });
  }

  async findAll(): Promise<DocumentModel[]> {
    return this.prisma.document.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(
    id: string,
    data: {
      fileName?: string;
      fileType?: FileType;
      content?: string | null;
    }
  ): Promise<DocumentModel> {
    const validated = parseDocumentUpdate(data);
    try {
      return this.prisma.document.update({
        where: { id },
        data: {
          fileName: validated.fileName,
          fileType: validated.fileType as FileType | undefined,
          content: validated.content,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new Error(`Document with ID ${id} not found`);
      }
      throw error;
    }
  }

  async updateStatus(id: string, status: Status): Promise<DocumentModel> {
    return this.prisma.document.update({
      where: { id },
      data: { status },
    });
  }

  async updateFilePath(id: string, filePath: string): Promise<DocumentModel> {
    return this.prisma.document.update({
      where: { id },
      data: { filePath },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.document.delete({
      where: { id },
    });
  }
}

export const documentRepository = new DocumentRepository();

export class DocumentChunkRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = getPrismaClient();
  }

  async create(data: {
    id?: string;
    documentId: string;
    chunkIndex: number;
    text: string;
    embedding?: number[] | null;
  }): Promise<DocumentChunkModel> {
    const validated = parseDocumentChunkCreate(data);
    return this.prisma.documentChunk.create({
      data: {
        id: validated.id,
        documentId: validated.documentId,
        chunkIndex: validated.chunkIndex,
        text: validated.text,
        embedding: toJsonValue(validated.embedding),
      },
    });
  }

  async findById(id: string): Promise<DocumentChunkModel | null> {
    return this.prisma.documentChunk.findUnique({
      where: { id },
    });
  }

  async findByDocumentId(documentId: string): Promise<DocumentChunkModel[]> {
    return this.prisma.documentChunk.findMany({
      where: { documentId },
      orderBy: { chunkIndex: 'asc' },
    });
  }

  async update(
    id: string,
    data: {
      text?: string;
      embedding?: number[] | null;
    }
  ): Promise<DocumentChunkModel> {
    const validated = parseDocumentChunkUpdate(data);
    try {
      return this.prisma.documentChunk.update({
        where: { id },
        data: {
          text: validated.text,
          embedding: toJsonValue(validated.embedding),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new Error(`DocumentChunk with ID ${id} not found`);
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    await this.prisma.documentChunk.delete({
      where: { id },
    });
  }
}

export const documentChunkRepository = new DocumentChunkRepository();

export class QuestionRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = getPrismaClient();
  }

  async create(data: {
    id?: string;
    documentId: string;
    text: string;
    embedding?: number[] | null;
  }): Promise<QuestionModel> {
    const validated = parseQuestionCreate(data);

    // documentId FK 검증
    const documentExists = await this.prisma.document.findUnique({
      where: { id: validated.documentId },
    });

    if (!documentExists) {
      throw new Error(`Document with ID ${validated.documentId} not found`);
    }

    return this.prisma.question.create({
      data: {
        id: validated.id,
        documentId: validated.documentId,
        text: validated.text,
        embedding: toJsonValue(validated.embedding),
      },
    });
  }

  async findById(id: string): Promise<QuestionModel | null> {
    return this.prisma.question.findUnique({
      where: { id },
    });
  }

  async findByDocumentId(documentId: string): Promise<QuestionModel[]> {
    return this.prisma.question.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(): Promise<QuestionModel[]> {
    return this.prisma.question.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(
    id: string,
    data: {
      text?: string;
      embedding?: number[] | null;
    }
  ): Promise<QuestionModel> {
    const validated = parseQuestionUpdate(data);
    try {
      return this.prisma.question.update({
        where: { id },
        data: {
          text: validated.text,
          embedding: toJsonValue(validated.embedding),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new Error(`Question with ID ${id} not found`);
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    await this.prisma.question.delete({
      where: { id },
    });
  }
}

export const questionRepository = new QuestionRepository();

export class AnswerRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = getPrismaClient();
  }

  async create(data: {
    id?: string;
    questionId: string;
    text: string;
    chunkIds?: string[];
  }): Promise<AnswerModel> {
    const validated = parseAnswerCreate(data);

    try {
      return this.prisma.answer.create({
        data: {
          id: validated.id,
          questionId: validated.questionId,
          text: validated.text,
          chunks: validated.chunkIds
            ? {
                connect: validated.chunkIds.map((id) => ({ id })),
              }
            : undefined,
        },
        include: {
          chunks: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new Error(`Question or DocumentChunk with provided ID not found`);
      }
      throw error;
    }
  }

  async findById(id: string): Promise<AnswerModel | null> {
    return this.prisma.answer.findUnique({
      where: { id },
      include: {
        chunks: true,
      },
    });
  }

  async findByQuestionId(questionId: string): Promise<AnswerModel | null> {
    return this.prisma.answer.findUnique({
      where: { questionId },
      include: {
        chunks: true,
      },
    });
  }

  async update(
    id: string,
    data: {
      text?: string;
      chunkIds?: string[];
    }
  ): Promise<AnswerModel> {
    const validated = parseAnswerUpdate(data);
    try {
      return this.prisma.answer.update({
        where: { id },
        data: {
          text: validated.text,
          chunks: validated.chunkIds
            ? {
                set: validated.chunkIds.map((id) => ({ id })),
              }
            : undefined,
        },
        include: {
          chunks: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new Error(`Answer or DocumentChunk with provided ID not found`);
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    await this.prisma.answer.delete({
      where: { id },
    });
  }
}

export const answerRepository = new AnswerRepository();
