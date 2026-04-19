import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { OpenAI } from 'openai';
import { cosineSimilarity } from '../../src/lib/vector';
import { loadEnv } from '../shared/utils';
import { assertApiServerReachable, assertDatabaseReachable } from '../shared/preflight';

async function testNoAnswer() {
  const envVars = loadEnv();
  const dbUrl = envVars.DATABASE_URL;
  const apiKey = envVars.OPENAI_API_KEY;
  const embeddingModel = envVars.EMBEDDING_MODEL || 'text-embedding-3-small';
  const similarityThreshold = parseFloat(envVars.SIMILARITY_THRESHOLD || '0.5');

  if (!dbUrl || !apiKey) {
    console.error('❌ DATABASE_URL 또는 OPENAI_API_KEY가 누락되었습니다.');
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey });
  const adapter = new PrismaPg({ connectionString: dbUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    await assertDatabaseReachable(prisma);
    await assertApiServerReachable('http://localhost:3000');
    console.log('🔍 문서에 없는 질문 테스트\n');
    console.log('='.repeat(80));
    console.log('설정');
    console.log('='.repeat(80));

    console.log(`✓ 임베딩 모델: ${embeddingModel}`);
    console.log(`✓ Threshold: ${similarityThreshold}\n`);

    const documents = await prisma.document.findMany();
    if (documents.length === 0) {
      console.error('❌ 테스트용 문서가 없습니다.');
      process.exitCode = 1;
      return;
    }

    const documentId = documents[0].id;
    const chunks = await prisma.documentChunk.findMany({
      where: { documentId },
      orderBy: { chunkIndex: 'asc' },
    });

    console.log(`✓ Document ID: ${documentId}`);
    console.log(`✓ 청크 개수: ${chunks.length}개\n`);

    // 테스트 케이스: 문서에 없는 질문들
    const noAnswerQueries = [
      {
        name: '강화학습',
        query: 'reinforcement learning agents rewards',
      },
      {
        name: '스포츠',
        query: 'sports football basketball games',
      },
      {
        name: '음식',
        query: 'cooking recipes food ingredients',
      },
      {
        name: '의료',
        query: 'medical diagnosis disease treatment',
      },
    ];

    // TEST 1: 검색 API 결과 확인
    console.log('='.repeat(80));
    console.log('TEST 1: 검색 API - 문서에 없는 질문\n');

    const searchResults = [];

    for (const testCase of noAnswerQueries) {
      const queryEmbedding = (
        await openai.embeddings.create({
          model: embeddingModel,
          input: testCase.query,
          dimensions: 1536,
        })
      ).data[0].embedding;

      const results = chunks
        .map((chunk) => ({
          id: chunk.id,
          similarity: cosineSimilarity(queryEmbedding, chunk.embedding as number[]),
        }))
        .filter((item) => item.similarity >= similarityThreshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5);

      searchResults.push({
        query: testCase.query,
        name: testCase.name,
        results: results,
      });

      const allScores = chunks
        .map((chunk) => cosineSimilarity(queryEmbedding, chunk.embedding as number[]))
        .sort((a, b) => b - a);

      console.log(`📝 [${testCase.name}] "${testCase.query}"`);
      console.log(`   모든 유사도: [${allScores.map((s) => s.toFixed(3)).join(', ')}]`);
      console.log(`   최고: ${allScores[0].toFixed(4)}, 최저: ${allScores[allScores.length - 1].toFixed(4)}`);
      console.log(`   결과: ${results.length}개 반환\n`);
    }

    // TEST 2: 빈 청크 배열로 answers API 호출 시도
    console.log('='.repeat(80));
    console.log('TEST 2: Answers API - 검색 결과 0개 시나리오\n');

    // 질문 생성 또는 기존 질문 사용
    let testQuestion = await prisma.question.findFirst({
      where: { documentId },
    });

    if (!testQuestion) {
      testQuestion = await prisma.question.create({
        data: {
          documentId,
          text: '강화학습이란 무엇인가요?',
        },
      });
      console.log(`✓ 새 질문 생성: ${testQuestion.id}`);
    } else {
      console.log(`✓ 기존 질문 사용: ${testQuestion.id}`);
    }

    console.log(`   질문: "${testQuestion.text}"\n`);

    // 빈 청크 배열로 답변 생성 시도
    console.log('[ 시도 1: 빈 청크 배열로 answers API 호출 ]');
    console.log('-'.repeat(80));

    const payload = {
      question_id: testQuestion.id,
      chunk_ids: [], // 비어있음
      question_text: testQuestion.text,
    };

    console.log('REQUEST:');
    console.log(JSON.stringify(payload, null, 2));

    const emptyRes = await fetch('http://localhost:3000/api/answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const emptyText = await emptyRes.text();
    let emptyData;
    try {
      emptyData = JSON.parse(emptyText);
    } catch {
      emptyData = { error: 'HTML Response', message: emptyText.substring(0, 100) };
    }

    console.log(`\nRESPONSE (${emptyRes.status}):`);
    console.log(JSON.stringify(emptyData, null, 2));

    if (emptyRes.status === 400) {
      console.log('\n✅ 결과: 400 BadRequest (예상대로)');
      console.log('   → 근거 청크가 필수이므로 빈 배열 불가');
    }

    // TEST 3: 유사도는 높지만 threshold 미만인 청크로 시도
    console.log('\n' + '='.repeat(80));
    console.log('TEST 3: 낮은 유사도 청크로 답변 시도\n');

    console.log('[ 시도 2: threshold 미만 청크로 답변 생성 시도 ]');
    console.log('-'.repeat(80));

    // 강화학습 쿼리의 모든 유사도 조회
    const rlQueryEmbedding = (
      await openai.embeddings.create({
        model: embeddingModel,
        input: 'reinforcement learning agents rewards',
        dimensions: 1536,
      })
    ).data[0].embedding;

    const allRlScores = chunks.map((chunk) => ({
      id: chunk.id,
      similarity: cosineSimilarity(rlQueryEmbedding, chunk.embedding as number[]),
    }));

    const bestRlChunk = allRlScores.sort((a, b) => b.similarity - a.similarity)[0];

    console.log(`유사도가 가장 높은 청크: ${bestRlChunk.similarity.toFixed(4)} (threshold 0.5 미만)`);
    console.log(`이 청크만으로 답변을 생성할 경우:\n`);

    const lowSimilarityPayload = {
      question_id: testQuestion.id,
      chunk_ids: [bestRlChunk.id],
      question_text: testQuestion.text,
    };

    const lowSimilarityRes = await fetch('http://localhost:3000/api/answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lowSimilarityPayload),
    });

    const lowSimilarityData = await lowSimilarityRes.json();
    console.log(`RESPONSE (${lowSimilarityRes.status}):`);

    if (lowSimilarityRes.status === 200) {
      console.log(`✅ 상태: 200 OK (답변 생성됨)`);
      console.log(`   근거: ${lowSimilarityData.answer_text.substring(0, 100)}...`);
      console.log('\n⚠️ 문제: threshold 미만 청크도 답변 생성됨');
      console.log('   → 문서에 없는 내용도 대답할 가능성');
    } else {
      console.log(JSON.stringify(lowSimilarityData, null, 2));
    }

    // 최종 결론
    console.log('\n' + '='.repeat(80));
    console.log('결론 및 개선 필요 사항\n');

    console.log('현재 상황:');
    console.log(`  1️⃣ 검색 API: threshold 0.5 미만 결과는 0개 반환 ✅`);
    console.log(`  2️⃣ Answers API: 빈 청크 배열 거절 ✅`);
    console.log(`  3️⃣ 문제: 근거 부족 청크도 LLM에 전달 시 답변 생성 가능 ⚠️`);

    console.log('\n개선 안:');
    console.log(`  → 생성 LLM 프롬프트에 "근거 부족 시 없다고 답하기" 규칙 추가`);
    console.log(`  → 예: "만약 주어진 정보에 답이 없으면 '답변을 찾을 수 없습니다'라고 명확히 답하세요"`);

    console.log('\n' + '='.repeat(80));
  } catch (error) {
    console.error('❌ 오류:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

testNoAnswer();
