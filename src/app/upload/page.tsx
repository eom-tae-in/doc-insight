'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import LoadingIndicator from '@/components/LoadingIndicator';
import ErrorMessage from '@/components/ErrorMessage';

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('파일을 선택해주세요');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '파일 업로드 실패');
      }

      const data = await response.json();
      const documentId = data.data?.id;

      if (!documentId) {
        throw new Error('문서 ID를 받지 못했습니다');
      }

      // 처리 상태 페이지로 자동 이동
      router.push(`/processing/${documentId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8 text-center">
          문서 업로드
        </h1>

        {error && <ErrorMessage message={error} />}

        {!isLoading ? (
          <form onSubmit={handleUpload} className="mb-8">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="mb-6">
                <label className="block text-lg font-semibold text-gray-900 mb-4">
                  문서 파일 선택
                </label>
                <input
                  type="file"
                  accept=".pdf,.txt,.md"
                  onChange={handleFileChange}
                  disabled={isLoading}
                  className="block w-full px-4 py-3 border-2 border-dashed border-indigo-300 rounded-lg focus:outline-none focus:border-indigo-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-indigo-50 file:text-indigo-600 file:font-semibold"
                />
                <p className="text-sm text-gray-500 mt-2">
                  지원 형식: PDF, TXT, MD
                </p>
              </div>

              {file && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900">
                    선택된 파일: <span className="font-semibold">{file.name}</span>
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={!file || isLoading}
                className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition"
              >
                업로드
              </button>
            </div>
          </form>
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <LoadingIndicator message="파일을 업로드하고 있습니다..." />
          </div>
        )}

        <div className="text-center text-gray-600">
          <p className="text-sm">처리 완료 후 자동으로 처리 상태 페이지로 이동합니다.</p>
        </div>
      </div>
    </div>
  );
}
