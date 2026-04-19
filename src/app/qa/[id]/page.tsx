'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import LoadingIndicator from '@/components/LoadingIndicator';
import ErrorMessage from '@/components/ErrorMessage';

interface SearchChunk {
  id: string;
  text: string;
  order: number;
  similarity: number;
}

interface Answer {
  id: string;
  answer_text: string;
  chunks: SearchChunk[];
  created_at: string;
  isFallback: boolean;
}

interface UIState {
  isLoading: boolean;
  error: string | null;
  answer: Answer | null;
  noResults: boolean;
}

export default function QAPage() {
  const params = useParams();
  const documentId = params.id as string;

  const [question, setQuestion] = useState('');
  const [state, setState] = useState<UIState>({
    isLoading: false,
    error: null,
    answer: null,
    noResults: false,
  });

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setState({ isLoading: true, error: null, answer: null, noResults: false });

    try {
      // 1단계: 질문 저장
      const questionRes = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_text: question,
          document_id: documentId,
        }),
      });

      if (!questionRes.ok) {
        const errorData = await questionRes.json();
        throw new Error(errorData.message || '질문 저장 실패');
      }

      const questionData = await questionRes.json();
      const questionId = questionData.data?.id as string | undefined;

      if (!questionId) {
        throw new Error('질문 ID를 받지 못했습니다');
      }

      // 2단계: 검색 API 호출
      const searchRes = await fetch(
        `/api/search?question_id=${encodeURIComponent(questionId)}`
      );

      if (!searchRes.ok) {
        const errorData = await searchRes.json();
        throw new Error(errorData.message || '검색 요청 실패');
      }

      const { chunks, fallback } = await searchRes.json();

      // 검색 결과가 없으면
      if (!chunks || chunks.length === 0) {
        setState({
          isLoading: false,
          error: null,
          answer: null,
          noResults: true,
        });
        return;
      }

      // 3단계: 답변 생성 API 호출
      const answerRes = await fetch('/api/answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: questionId,
          chunk_ids: chunks.map((c: SearchChunk) => c.id),
        }),
      });

      if (!answerRes.ok) {
        const errorData = await answerRes.json();
        throw new Error(errorData.message || '답변 생성 실패');
      }

      const answerData = await answerRes.json();
      setState({
        isLoading: false,
        error: null,
        answer: {
          ...answerData,
          isFallback: Boolean(fallback),
        },
        noResults: false,
      });
    } catch (err) {
      setState({
        isLoading: false,
        error: err instanceof Error ? err.message : '오류가 발생했습니다',
        answer: null,
        noResults: false,
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
          >
            메인 페이지로 이동
          </Link>
        </div>

        <h1 className="text-4xl font-bold text-gray-900 mb-8 text-center">
          문서 Q&A
        </h1>

        {/* 검색 폼 */}
        <form onSubmit={handleSearch} className="mb-8">
          <div className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="질문을 입력하세요..."
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder:text-gray-500 caret-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={state.isLoading}
            />
            <button
              type="submit"
              disabled={state.isLoading || !question.trim()}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition"
            >
              {state.isLoading ? '검색 중...' : '검색'}
            </button>
          </div>
        </form>

        {/* 에러 표시 */}
        {state.error && <ErrorMessage message={state.error} />}

        {/* 검색 결과 없음 (친화적 메시지) */}
        {state.noResults && (
          <div className="mb-6 p-6 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex gap-3">
              <div className="text-blue-600 text-2xl">ℹ️</div>
              <div>
                <p className="font-semibold text-blue-900 mb-1">
                  죄송합니다
                </p>
                <p className="text-blue-800">
                  제공된 문서에서는 &quot;{question}&quot;에 대한 정보를 찾을 수
                  없습니다.
                </p>
                <p className="text-blue-700 text-sm mt-2">
                  다른 질문을 시도해보시거나, 더 많은 문서를 업로드해보세요.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 답변 표시 */}
        {state.answer && (
          <div className="space-y-6">
            {/* 답변 박스 */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                답변
              </h2>
              <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                  {state.answer.answer_text}
                </p>
              </div>
            </div>

            {/* 근거 청크 표시 */}
            {state.answer.chunks && state.answer.chunks.length > 0 && (
              <EvidenceSection answer={state.answer} />
            )}
          </div>
        )}

        {/* 로딩 상태 */}
        {state.isLoading && <LoadingIndicator message="검색 중입니다..." />}

        {/* 초기 상태 메시지 */}
        {!state.isLoading &&
          !state.answer &&
          !state.error &&
          !state.noResults && (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">
                질문을 입력하면 문서에서 답변을 찾아드립니다.
              </p>
            </div>
          )}
      </div>
    </div>
  );
}

function EvidenceSection({ answer }: { answer: Answer }) {
  return (
    <div
      className={`rounded-lg p-6 shadow-lg ${
        answer.isFallback
          ? 'border border-amber-200 bg-amber-50'
          : 'bg-white'
      }`}
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {answer.isFallback ? '가장 가까운 참고 문서' : '근거'} (
            {answer.chunks.length}개)
          </h2>
          {answer.isFallback && (
            <p className="mt-1 text-sm text-amber-800">
              정확한 기준을 넘긴 결과가 없어, 가장 가까운 문서 조각을 참고했습니다.
            </p>
          )}
        </div>
        {answer.isFallback && (
          <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
            관련성 낮을 수 있음
          </span>
        )}
      </div>
      <div className="space-y-3">
        {answer.chunks.map((chunk) => (
          <div
            key={chunk.id}
            className={`rounded-lg border p-4 transition ${
              answer.isFallback
                ? 'border-amber-200 bg-white/80 hover:bg-white'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <span className="text-sm font-medium text-gray-600">
                청크 #{chunk.order + 1}
              </span>
              <span
                className={`rounded px-2 py-1 text-xs ${
                  answer.isFallback
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-indigo-100 text-indigo-800'
                }`}
              >
                {(chunk.similarity * 100).toFixed(1)}% 유사도
              </span>
            </div>
            <p className="text-gray-700 text-sm leading-relaxed line-clamp-3">
              {chunk.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
