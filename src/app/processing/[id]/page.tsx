'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import LoadingIndicator from '@/components/LoadingIndicator';
import ErrorMessage from '@/components/ErrorMessage';

interface DocumentStatus {
  id: string;
  fileName: string;
  status: 'processing' | 'completed' | 'failed';
}

export default function ProcessingPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.id as string;

  const [status, setStatus] = useState<DocumentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(true);

  useEffect(() => {
    if (!documentId) return;

    let timeoutId: NodeJS.Timeout;

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/documents/${documentId}/status`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || '상태 조회 실패');
        }

        const data = await response.json();
        const docStatus = data.data as DocumentStatus;

        setStatus(docStatus);
        setError(null);

        if (docStatus.status === 'completed') {
          setIsPolling(false);
          // 1초 후 QA 페이지로 이동
          timeoutId = setTimeout(() => {
            router.push(`/qa/${documentId}`);
          }, 1000);
        } else if (docStatus.status === 'failed') {
          setIsPolling(false);
          setError('문서 처리에 실패했습니다. 다시 시도해주세요.');
        } else if (isPolling) {
          // processing 상태: 1초 후 다시 폴링
          timeoutId = setTimeout(pollStatus, 1000);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '오류가 발생했습니다');
        setIsPolling(false);
      }
    };

    pollStatus();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [documentId, isPolling, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8 text-center">
          문서 처리 중
        </h1>

        {error && <ErrorMessage message={error} />}

        <div className="bg-white rounded-lg shadow-lg p-8">
          {status && (
            <>
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  파일: <span className="font-semibold">{status.fileName}</span>
                </p>
              </div>

              {status.status === 'processing' && (
                <>
                  <div className="mb-6">
                    <p className="text-lg font-semibold text-gray-900 mb-4">
                      상태: 처리 중
                    </p>
                    <LoadingIndicator message="문서를 처리하고 있습니다. 잠시만 기다려주세요..." />
                  </div>
                  <p className="text-center text-gray-600 text-sm">
                    문서 크기와 복잡도에 따라 몇 초에서 수십 초 정도 소요될 수 있습니다.
                  </p>
                </>
              )}

              {status.status === 'completed' && (
                <div className="text-center py-8">
                  <div className="mb-4 text-5xl">✓</div>
                  <h2 className="text-2xl font-bold text-green-600 mb-4">
                    처리 완료
                  </h2>
                  <p className="text-gray-600 mb-4">
                    문서가 성공적으로 처리되었습니다.
                  </p>
                  <p className="text-sm text-gray-500">
                    곧 Q&A 페이지로 이동합니다...
                  </p>
                </div>
              )}

              {status.status === 'failed' && (
                <div className="text-center py-8">
                  <div className="mb-4 text-5xl">✗</div>
                  <h2 className="text-2xl font-bold text-red-600 mb-4">
                    처리 실패
                  </h2>
                  <p className="text-gray-600 mb-6">
                    문서 처리 중 오류가 발생했습니다.
                  </p>
                  <button
                    onClick={() => router.push('/upload')}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition"
                  >
                    다시 업로드하기
                  </button>
                </div>
              )}
            </>
          )}

          {!status && (
            <LoadingIndicator message="상태를 확인하고 있습니다..." />
          )}
        </div>
      </div>
    </div>
  );
}
