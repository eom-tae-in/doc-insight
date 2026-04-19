import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { loadEnv } from '../shared/utils';
import { assertApiServerReachable, assertDatabaseReachable } from '../shared/preflight';

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  return { response, data };
}

async function getJson(url: string) {
  const response = await fetch(url);
  const data = await response.json();
  return { response, data };
}

async function runE2ETest() {
  const envVars = loadEnv();
  const dbUrl = envVars.DATABASE_URL;
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: dbUrl }),
  });
  const baseUrl = 'http://localhost:3000';

  try {
    console.log('='.repeat(70));
    console.log('DocInsight E2E 테스트');
    console.log('='.repeat(70));
    await assertDatabaseReachable(prisma);
    await assertApiServerReachable(baseUrl);

    const document = await prisma.document.findFirst({
      where: { status: 'completed' },
      orderBy: { createdAt: 'desc' },
    });

    if (!document) {
      console.error('❌ completed 상태의 테스트용 문서가 없습니다.');
      process.exitCode = 1;
      return;
    }

    console.log(`사용 문서 ID: ${document.id}`);
    console.log(`문서명: ${document.fileName}`);

    const questionPayload = {
      question_text: '이 문서의 핵심 내용을 간단히 설명해줘.',
      document_id: document.id,
    };

    console.log('\n[1] 질문 생성');
    const questionResult = await postJson(`${baseUrl}/api/questions`, questionPayload);
    console.log(`상태 코드: ${questionResult.response.status}`);
    console.log(JSON.stringify(questionResult.data, null, 2));

    if (questionResult.response.status !== 200) {
      console.error('❌ 질문 생성 실패');
      process.exitCode = 1;
      return;
    }

    const questionId = questionResult.data.data?.id as string | undefined;
    if (!questionId) {
      console.error('❌ question_id를 받지 못했습니다.');
      process.exitCode = 1;
      return;
    }

    console.log('\n[2] 검색');
    const searchResult = await getJson(
      `${baseUrl}/api/search?question_id=${encodeURIComponent(questionId)}&limit=3`
    );
    console.log(`상태 코드: ${searchResult.response.status}`);
    console.log(JSON.stringify(searchResult.data, null, 2));

    if (searchResult.response.status !== 200) {
      console.error('❌ 검색 실패');
      process.exitCode = 1;
      return;
    }

    const chunks = searchResult.data.chunks as Array<{ id: string }> | undefined;
    if (!chunks || chunks.length === 0) {
      console.error('❌ 검색 결과 청크가 없습니다.');
      process.exitCode = 1;
      return;
    }

    console.log('\n[3] 답변 생성');
    const answerResult = await postJson(`${baseUrl}/api/answers`, {
      question_id: questionId,
      chunk_ids: chunks.map((chunk) => chunk.id),
    });
    console.log(`상태 코드: ${answerResult.response.status}`);
    console.log(JSON.stringify(answerResult.data, null, 2));

    if (answerResult.response.status !== 200) {
      console.error('❌ 답변 생성 실패');
      process.exitCode = 1;
      return;
    }

    const answerText = answerResult.data.answer_text as string | undefined;
    console.log('\n[4] 정상 케이스 검증');
    console.log(`- 답변 길이: ${answerText?.length ?? 0}자`);
    console.log(
      `- 200단어 근사 체크: ${(answerText ?? '').split(/\s+/).filter(Boolean).length <= 200 ? '통과' : '확인 필요'}`
    );

    console.log('\n[5] 에러 케이스 검증');

    const missingQuestion = await getJson(`${baseUrl}/api/search?question_id=missing-question-id`);
    console.log(`search 404: ${missingQuestion.response.status}`);

    const invalidQuestionPayload = await postJson(`${baseUrl}/api/answers`, {
      question_id: 'missing-question-id',
      chunk_ids: chunks.map((chunk) => chunk.id),
    });
    console.log(`answers 404: ${invalidQuestionPayload.response.status}`);

    const invalidChunkPayload = await postJson(`${baseUrl}/api/answers`, {
      question_id: questionId,
      chunk_ids: ['missing-chunk-id'],
    });
    console.log(`answers 400: ${invalidChunkPayload.response.status}`);

    console.log('\n[6] 결과 요약');
    console.log(`- /api/questions: ${questionResult.response.status === 200 ? '통과' : '실패'}`);
    console.log(`- /api/search: ${searchResult.response.status === 200 ? '통과' : '실패'}`);
    console.log(`- /api/answers: ${answerResult.response.status === 200 ? '통과' : '실패'}`);
    console.log(
      `- 404 케이스: ${missingQuestion.response.status === 404 && invalidQuestionPayload.response.status === 404 ? '통과' : '실패'}`
    );
    console.log(`- 400 케이스: ${invalidChunkPayload.response.status === 400 ? '통과' : '실패'}`);
    console.log('- 429/504 케이스: 실제 API rate limit/timeout 상황이 필요해 자동 재현은 생략');
  } catch (error) {
    console.error('❌ E2E 테스트 오류:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

runE2ETest();
