import { NextRequest, NextResponse } from 'next/server';
import { generateTextEmbedding } from '@/lib/embeddings';
import { scoreChunks } from '@/lib/search-scoring';
import {
  questionRepository,
  documentRepository,
  documentChunkRepository,
} from '@/lib/database';

const MIN_SIMILARITY = parseFloat(process.env.SIMILARITY_THRESHOLD || '0.5');
const FALLBACK_RESULT_COUNT = 2;

export async function GET(request: NextRequest) {
  try {
    const { searchParams: searchParamsObj } = new URL(request.url);
    const question_id = searchParamsObj.get('question_id');
    const limit = Math.min(parseInt(searchParamsObj.get('limit') || '5', 10), 10);

    if (!question_id) {
      return NextResponse.json(
        { error: 'BadRequest', message: '질문 ID가 필요합니다' },
        { status: 400 }
      );
    }

    const question = await questionRepository.findById(question_id);

    if (!question) {
      return NextResponse.json(
        { error: 'NotFound', message: '질문을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    const document = await documentRepository.findById(question.documentId);

    if (!document) {
      return NextResponse.json(
        { error: 'NotFound', message: '문서를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    if (document.status !== 'completed') {
      return NextResponse.json(
        { error: 'BadRequest', message: '문서 처리가 완료되지 않았습니다' },
        { status: 400 }
      );
    }

    const queryEmbedding =
      (question.embedding as number[] | null) ??
      (await generateTextEmbedding(question.text));
    const chunks = await documentChunkRepository.findByDocumentId(question.documentId);

    const scoredResults = scoreChunks(question.text, queryEmbedding, chunks);

    let results = scoredResults
      .filter((item) => item.similarity >= MIN_SIMILARITY)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
    let fallback = false;

    if (results.length === 0) {
      results = scoredResults.slice(0, Math.min(limit, FALLBACK_RESULT_COUNT));
      fallback = results.length > 0;
    }

    return NextResponse.json({
      chunks: results.map(({ id, text, order, similarity }) => ({
        id,
        text,
        order,
        similarity,
      })),
      fallback,
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: '검색에 실패했습니다' },
      { status: 500 }
    );
  }
}
