export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            DocInsight
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            문서 기반 지능형 Q&A 시스템
          </p>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            PDF, TXT, MD 형식의 문서를 업로드하고, AI 기반 의미론적 검색으로
            정확한 답변을 얻어보세요.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">1. 문서 업로드</h2>
            <p className="text-gray-600">
              PDF, TXT, MD 파일을 간편하게 업로드하세요.
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">2. 자동 처리</h2>
            <p className="text-gray-600">
              문서가 자동으로 분할되고 임베딩이 생성됩니다.
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">3. Q&A 시작</h2>
            <p className="text-gray-600">
              질문하면 관련 문서 조각과 함께 답변을 제공받습니다.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">시작하기</h2>
          <a
            href="/upload"
            className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg transition"
          >
            문서 업로드하기
          </a>
          <p className="text-gray-600 text-sm mt-4">
            문서 업로드 후 자동으로 Q&A 페이지로 이동됩니다.
          </p>
        </div>

        <div className="mt-12 text-center text-gray-600 text-sm">
          <p>MVP 버전 - 기본 기능만 구현됨</p>
        </div>
      </main>
    </div>
  );
}
