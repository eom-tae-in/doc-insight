import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { OpenAI } from 'openai';
import { cosineSimilarity } from '../../src/lib/vector';
import { loadEnv } from '../shared/utils';
import { assertDatabaseReachable } from '../shared/preflight';

async function testSearch() {
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
    console.log('🔍 검색 테스트 시작');
    console.log(`   임베딩 모델: ${embeddingModel}`);
    console.log(`   SIMILARITY_THRESHOLD: ${similarityThreshold}\n`);

    const documents = await prisma.document.findMany();
    if (documents.length === 0) {
      console.error('❌ 데이터베이스에 문서가 없습니다.');
      process.exitCode = 1;
      return;
    }

    const documentId = documents[0].id;
    console.log(`✓ Document ID: ${documentId}\n`);

    const chunks = await prisma.documentChunk.findMany({
      where: { documentId },
      orderBy: { chunkIndex: 'asc' },
    });
    console.log(`✓ 총 ${chunks.length}개 청크 발견\n`);

    const testQueries = [
      'deep learning neural networks',
      'natural language processing',
      'machine learning algorithms',
      'computer vision image recognition',
    ];

    for (const query of testQueries) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📝 쿼리: "${query}"`);
      console.log('='.repeat(60));

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
          text: chunk.text.substring(0, 80) + '...',
          chunkIndex: chunk.chunkIndex,
          similarity: cosineSimilarity(queryEmbedding, chunk.embedding as number[]),
        }))
        .sort((a, b) => b.similarity - a.similarity);

      console.log('\n📊 모든 청크의 유사도:');
      results.forEach((result, idx) => {
        const passed = result.similarity >= similarityThreshold ? '✓' : '✗';
        console.log(
          `  ${idx + 1}. [${passed}] 청크${result.chunkIndex}: ${result.similarity.toFixed(4)} → "${result.text}"`
        );
      });

      const filtered = results.filter((r) => r.similarity >= similarityThreshold);
      console.log(`\n결과: ${filtered.length}/${chunks.length} 청크 통과 (threshold: ${similarityThreshold})`);
      if (filtered.length > 0) {
        console.log('통과한 청크:');
        filtered.forEach((r) => {
          console.log(`  - ${r.similarity.toFixed(4)}: 청크${r.chunkIndex}`);
        });
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ 검색 테스트 완료');
  } catch (error) {
    console.error('❌ 오류:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

testSearch();
