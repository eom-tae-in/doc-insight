import { NextRequest, NextResponse } from 'next/server';
import { questionRepository, documentRepository } from '@/lib/database';
import { generateTextEmbedding } from '@/lib/embeddings';
import { QuestionRequest } from '@/types';

const MAX_QUESTION_LENGTH = 1000;
const MIN_QUESTION_LENGTH = 1;

export async function POST(request: NextRequest) {
  try {
    const body: QuestionRequest = await request.json();
    const { question_text, document_id } = body;

    // 입력 검증
    if (!question_text || typeof question_text !== 'string') {
      return NextResponse.json(
        { error: 'BadRequest', message: '질문이 입력되지 않았습니다' },
        { status: 400 }
      );
    }

    if (
      question_text.length < MIN_QUESTION_LENGTH ||
      question_text.length > MAX_QUESTION_LENGTH
    ) {
      return NextResponse.json(
        { error: 'BadRequest', message: `질문은 1자 이상 ${MAX_QUESTION_LENGTH}자 이하여야 합니다` },
        { status: 400 }
      );
    }

    if (!document_id || typeof document_id !== 'string') {
      return NextResponse.json(
        { error: 'BadRequest', message: '문서 ID가 필요합니다' },
        { status: 400 }
      );
    }

    // Document 존재 확인
    const document = await documentRepository.findById(document_id);

    if (!document) {
      return NextResponse.json(
        { error: 'NotFound', message: '문서를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // Document 상태 확인
    if (document.status !== 'completed') {
      return NextResponse.json(
        { error: 'BadRequest', message: '문서 처리가 완료되지 않았습니다' },
        { status: 400 }
      );
    }

    // 임베딩 생성
    const embedding = await generateTextEmbedding(question_text);

    // Question 저장
    const question = await questionRepository.create({
      text: question_text,
      documentId: document_id,
      embedding,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: question.id,
        created_at: question.createdAt,
      },
    });
  } catch (error) {
    console.error('Question creation error:', error);

    // OpenAI API 에러 처리
    if (error instanceof Error) {
      if (error.message.includes('Rate limit')) {
        return NextResponse.json(
          { error: 'RateLimitError', message: 'API 호출 제한 초과' },
          { status: 429 }
        );
      }
      if (error.message.includes('timeout')) {
        return NextResponse.json(
          { error: 'TimeoutError', message: 'API 호출 시간 초과' },
          { status: 504 }
        );
      }
    }

    return NextResponse.json(
      { error: 'InternalServerError', message: '질문 저장에 실패했습니다' },
      { status: 500 }
    );
  }
}
