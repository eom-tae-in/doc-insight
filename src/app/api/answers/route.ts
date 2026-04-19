import { NextRequest, NextResponse } from 'next/server';
import { questionRepository, documentChunkRepository, answerRepository } from '@/lib/database';
import { generateAnswer } from '@/lib/llm';
import { generateTextEmbedding } from '@/lib/embeddings';
import { scoreChunks } from '@/lib/search-scoring';
import { AnswerRequest } from '@/types';
import type { DocumentChunkModel } from '@/generated/prisma/models/DocumentChunk';

type ErrorWithStatus = Error & { status?: number };
type ValidChunk = DocumentChunkModel;

export async function POST(request: NextRequest) {
  try {
    const body: AnswerRequest = await request.json();
    const { question_id, chunk_ids } = body;

    if (!question_id) {
      return NextResponse.json(
        { error: 'BadRequest', message: '질문 ID가 필요합니다' },
        { status: 400 }
      );
    }

    if (!chunk_ids || !Array.isArray(chunk_ids) || chunk_ids.length === 0) {
      return NextResponse.json(
        { error: 'BadRequest', message: '근거 청크가 필요합니다' },
        { status: 400 }
      );
    }

    // 저장된 Question 조회 (클라이언트가 보낸 question_text는 무시)
    const question = await questionRepository.findById(question_id);

    if (!question) {
      return NextResponse.json(
        { error: 'NotFound', message: '질문을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    const chunks = await Promise.all(
      chunk_ids.map((id) => documentChunkRepository.findById(id))
    );

    // chunk 검증: null 필터링 및 document 소속 확인
    const validChunks: ValidChunk[] = chunks.filter(
      (c): c is ValidChunk => c !== null && c.documentId === question.documentId
    );

    // 요청된 chunk_ids와 검증된 chunk 수가 다를 경우
    if (validChunks.length !== chunk_ids.length) {
      const invalidChunkIds = chunk_ids.filter((id, idx) => chunks[idx] === null);
      const missingDocChunkIds = chunk_ids.filter((id, idx) => {
        const chunk = chunks[idx];
        return chunk !== null && chunk.documentId !== question.documentId;
      });

      const details: string[] = [];
      if (invalidChunkIds.length > 0) {
        details.push(`존재하지 않음: ${invalidChunkIds.join(', ')}`);
      }
      if (missingDocChunkIds.length > 0) {
        details.push(`다른 문서 소속: ${missingDocChunkIds.join(', ')}`);
      }

      return NextResponse.json(
        {
          error: 'BadRequest',
          message: `유효하지 않은 청크가 포함되었습니다 (${details.join('; ')})`,
        },
        { status: 400 }
      );
    }

    if (validChunks.length === 0) {
      return NextResponse.json(
        { error: 'BadRequest', message: '유효한 청크가 하나도 없습니다' },
        { status: 400 }
      );
    }

    // DB에 저장된 question.text 사용 (클라이언트 입력 무시)
    const context = validChunks.map((c) => c.text).join('\n\n');
    const generatedAnswer = await generateAnswer(question.text, context);

    // 저장된 question.embedding 사용 (이미 생성되어 있음)
    const queryEmbedding = (question.embedding as number[]) || await generateTextEmbedding(question.text);

    const answer = await answerRepository.create({
      questionId: question_id,
      text: generatedAnswer,
      chunkIds: chunk_ids,
    });
    const scoredChunks = scoreChunks(question.text, queryEmbedding, validChunks);

    return NextResponse.json({
      id: answer.id,
      answer_text: answer.text,
      chunks: scoredChunks.map(({ id, text, order, similarity }) => ({
        id,
        text,
        order,
        similarity,
      })),
      created_at: answer.createdAt,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const status = (error as ErrorWithStatus).status || 500;
    const errorCode =
      status === 429
        ? 'RateLimitError'
        : status === 504
          ? 'TimeoutError'
          : 'InternalServerError';

    console.error('Answer creation error:', errorMessage);
    return NextResponse.json(
      { error: errorCode, message: errorMessage },
      { status }
    );
  }
}
