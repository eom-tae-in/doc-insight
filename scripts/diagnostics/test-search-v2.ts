import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { OpenAI } from 'openai';
import { cosineSimilarity } from '../../src/lib/vector';
import { loadEnv } from '../shared/utils';
import { assertDatabaseReachable } from '../shared/preflight';

async function testSearchV2() {
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
    console.log('🔍 재임베딩 후 검색 API 테스트\n');
    console.log('='.repeat(80));
    console.log('설정 확인');
    console.log('='.repeat(80));

    console.log(`✓ 임베딩 모델: ${embeddingModel}`);
    console.log(`✓ SIMILARITY_THRESHOLD: ${similarityThreshold}`);
    console.log(`✓ 테스트 청크 길이: 1004-1135글자 (실제 문서 길이)\n`);

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

    console.log(`✓ Document: ${documentId}`);
    console.log(`✓ 청크 개수: ${chunks.length}개`);
    console.log(`✓ 청크 길이 범위: ${Math.min(...chunks.map((c) => c.text.length))}-${Math.max(...chunks.map((c) => c.text.length))}글자\n`);

    // 다양한 쿼리 테스트
    const testQueries = [
      {
        query: 'deep learning neural networks',
        category: '딥러닝 관련',
      },
      {
        query: 'natural language processing transformer models',
        category: 'NLP 관련',
      },
      {
        query: 'machine learning data algorithms',
        category: '머신러닝 일반',
      },
      {
        query: 'computer vision image recognition',
        category: '컴퓨터 비전',
      },
      {
        query: 'reinforcement learning rewards agents',
        category: '강화학습',
      },
      {
        query: 'cooking recipes food',
        category: '비관련 (음식)',
      },
      {
        query: 'sports football basketball',
        category: '비관련 (스포츠)',
      },
    ];

    // 전체 결과 수집
    let totalQueries = 0;
    let totalMatches = 0;
    let totalNoMatches = 0;
    const allSimilarities: number[] = [];
    const matchedSimilarities: number[] = [];
    const unmatchedSimilarities: number[] = [];

    console.log('='.repeat(80));
    console.log('검색 테스트 결과\n');

    for (const testCase of testQueries) {
      const query = testCase.query;
      const queryEmbedding = (
        await openai.embeddings.create({
          model: embeddingModel,
          input: query,
          dimensions: 1536,
        })
      ).data[0].embedding;

      const results = chunks
        .map((chunk) => ({
          id: chunk.id,
          text: chunk.text.substring(0, 60) + '...',
          chunkIndex: chunk.chunkIndex,
          similarity: cosineSimilarity(queryEmbedding, chunk.embedding as number[]),
        }))
        .sort((a, b) => b.similarity - a.similarity);

      const matched = results.filter((r) => r.similarity >= similarityThreshold);

      // 통계 수집
      totalQueries++;
      if (matched.length > 0) {
        totalMatches++;
        matched.forEach((m) => {
          allSimilarities.push(m.similarity);
          matchedSimilarities.push(m.similarity);
        });
      } else {
        totalNoMatches++;
      }
      results.forEach((r) => {
        allSimilarities.push(r.similarity);
        if (r.similarity < similarityThreshold) {
          unmatchedSimilarities.push(r.similarity);
        }
      });

      console.log(`📝 [${testCase.category}] "${query}"`);
      console.log(`   유사도: [${results.map((r) => r.similarity.toFixed(3)).join(', ')}]`);
      console.log(`   결과: ${matched.length}/${chunks.length} 청크 통과\n`);
    }

    // 통계 분석
    console.log('='.repeat(80));
    console.log('통계 분석\n');

    const stats = {
      totalQueries,
      totalMatches,
      totalNoMatches,
      matchRate: ((totalMatches / totalQueries) * 100).toFixed(1),
      avgSimilarity: (allSimilarities.reduce((a, b) => a + b, 0) / allSimilarities.length).toFixed(4),
      matchedMin: matchedSimilarities.length > 0 ? Math.min(...matchedSimilarities).toFixed(4) : 'N/A',
      matchedMax: matchedSimilarities.length > 0 ? Math.max(...matchedSimilarities).toFixed(4) : 'N/A',
      matchedAvg:
        matchedSimilarities.length > 0
          ? (matchedSimilarities.reduce((a, b) => a + b, 0) / matchedSimilarities.length).toFixed(4)
          : 'N/A',
      unmatchedMax: unmatchedSimilarities.length > 0 ? Math.max(...unmatchedSimilarities).toFixed(4) : 'N/A',
      unmatchedAvg:
        unmatchedSimilarities.length > 0
          ? (unmatchedSimilarities.reduce((a, b) => a + b, 0) / unmatchedSimilarities.length).toFixed(4)
          : 'N/A',
    };

    console.log(`쿼리 통계:`);
    console.log(`  • 총 테스트 쿼리: ${stats.totalQueries}개`);
    console.log(`  • 결과 반환 (threshold ${similarityThreshold}): ${stats.totalMatches}개 (${stats.matchRate}%)`);
    console.log(`  • 결과 없음: ${stats.totalNoMatches}개`);

    console.log(`\n유사도 분포:`);
    console.log(`  • 전체 평균: ${stats.avgSimilarity}`);
    console.log(`  • 통과한 유사도 범위: ${stats.matchedMin} ~ ${stats.matchedMax} (평균: ${stats.matchedAvg})`);
    console.log(`  • 미통과한 유사도 최대: ${stats.unmatchedMax} (평균: ${stats.unmatchedAvg})`);

    // Threshold 분석
    console.log(`\nThreshold 분석:`);
    const gap = parseFloat(stats.matchedMin as string) - parseFloat(stats.unmatchedMax as string);
    console.log(`  • 통과/미통과 경계: ${gap.toFixed(4)}`);

    // Threshold 제안
    console.log('\n' + '='.repeat(80));
    console.log('Threshold 평가 및 제안\n');

    if (gap > 0.1) {
      console.log('✅ Threshold 0.5 유지 가능');
      console.log(`\n근거:`);
      console.log(`  1️⃣ 경계 여유: ${gap.toFixed(4)} (통과 최소값 - 미통과 최대값)`);
      console.log(`     → 0.1 이상의 여유가 있어 안정적`);
      console.log(`  2️⃣ 결과율: ${stats.matchRate}%`);
      console.log(`     → 관련 쿼리의 대부분이 결과 반환`);
      console.log(`  3️⃣ 비관련 쿼리 필터링: ${stats.unmatchedMax}`);
      console.log(`     → threshold 0.5로 비관련 쿼리 효과적으로 제거`);
      console.log(`\n결론: 현재 설정 유지 권장`);
    } else if (gap > 0) {
      console.log('⚠️ Threshold 0.5 유지는 가능하지만 조정 검토 필요');
      console.log(`\n근거:`);
      console.log(`  • 경계 여유가 ${gap.toFixed(4)}로 작음`);
      console.log(`  • 임계값 조정 시 더 안정적인 분리 가능`);
      console.log(`\n대안:`);
      console.log(`  • 현재 유지: 0.5 (기존 설정)`);
      console.log(`  • 보수적 조정: ${(parseFloat(stats.unmatchedMax as string) + 0.02).toFixed(2)} 추천`);
    } else {
      console.log('❌ Threshold 0.5는 과도하게 엄격함');
      console.log(`\n근거:`);
      console.log(`  • 통과 최소값(${stats.matchedMin}) < 미통과 최대값(${stats.unmatchedMax})`);
      console.log(`  • 경계가 겹침 → 임계값 조정 필요`);
      console.log(`\n권장 조정:`);
      const suggestedThreshold = (parseFloat(stats.matchedMin as string) + parseFloat(stats.unmatchedMax as string)) / 2;
      console.log(`  • 권장값: ${suggestedThreshold.toFixed(2)} (통과/미통과 중점)`);
      console.log(`  • 보수값: ${Math.max(0.3, suggestedThreshold - 0.05).toFixed(2)}`);
    }

    console.log('\n' + '='.repeat(80));
  } catch (error) {
    console.error('❌ 오류:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

testSearchV2();
