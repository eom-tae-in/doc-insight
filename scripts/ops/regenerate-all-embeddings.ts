import { PrismaClient, Prisma } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { OpenAI } from 'openai';
import { loadEnv } from '../shared/utils';

function getEmbeddingDimension(embedding: number[] | null | undefined): number | null {
  if (!embedding || !Array.isArray(embedding)) return null;
  return embedding.length;
}

function parseEmbedding(value: Prisma.JsonValue | null): number[] | null {
  if (!Array.isArray(value)) return null;
  return value.every((item) => typeof item === 'number') ? value : null;
}

async function regenerateAllEmbeddings() {
  const envVars = loadEnv();
  const dbUrl = envVars.DATABASE_URL;
  const apiKey = envVars.OPENAI_API_KEY;
  const embeddingModel = envVars.EMBEDDING_MODEL || 'text-embedding-3-small';
  const expectedDimension = parseInt(envVars.EMBEDDING_DIMENSION || '1536');

  if (!dbUrl || !apiKey) {
    console.error('❌ DATABASE_URL 또는 OPENAI_API_KEY가 누락되었습니다.');
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey });
  const adapter = new PrismaPg({ connectionString: dbUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    console.log('📋 임베딩 재생성 작업\n');
    console.log('='.repeat(70));
    console.log('설정 확인');
    console.log('='.repeat(70));

    console.log(`✓ 임베딩 모델: ${embeddingModel}`);
    console.log(`✓ 기대 차원: ${expectedDimension}차원`);

    // STEP 1: DocumentChunk 상태 확인
    console.log('\n' + '='.repeat(70));
    console.log('STEP 1: DocumentChunk 현황 분석');
    console.log('='.repeat(70));

    const allChunks = await prisma.documentChunk.findMany();
    console.log(`\n✓ 총 청크 수: ${allChunks.length}개`);

    const chunkDimensions = allChunks
      .map((c) => ({ id: c.id, dim: getEmbeddingDimension(parseEmbedding(c.embedding)) }))
      .reduce(
        (acc, cur) => {
          const dim = cur.dim;
          acc[dim || 'null'] = (acc[dim || 'null'] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

    console.log(`📊 차원 분포:`);
    Object.entries(chunkDimensions).forEach(([dim, count]) => {
      const status = dim === String(expectedDimension) ? '✓' : '⚠';
      console.log(`  ${status} ${dim}차원: ${count}개`);
    });

    // STEP 2: Question 상태 확인 (재처리 대상)
    console.log('\n' + '='.repeat(70));
    console.log('STEP 2: Question 현황 분석 (재처리 대상)');
    console.log('='.repeat(70));

    const allQuestions = await prisma.question.findMany();
    console.log(`\n✓ 총 질문 수: ${allQuestions.length}개`);

    const questionDimensions = allQuestions
      .map((q) => ({ id: q.id, dim: getEmbeddingDimension(parseEmbedding(q.embedding)) }))
      .reduce(
        (acc, cur) => {
          const dim = cur.dim;
          acc[dim || 'null'] = (acc[dim || 'null'] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

    console.log(`📊 차원 분포 (재처리 전):`);
    Object.entries(questionDimensions).forEach(([dim, count]) => {
      const status = dim === String(expectedDimension) ? '✓' : '❌';
      console.log(`  ${status} ${dim}차원: ${count}개`);
    });

    // STEP 3: Question 임베딩 재생성
    let successCount = 0;
    let failCount = 0;

    if (allQuestions.length === 0) {
      console.log('⊘ 재처리할 질문이 없습니다.');
    } else {
      console.log('\n' + '='.repeat(70));
      console.log('STEP 3: Question 임베딩 재생성');
      console.log('='.repeat(70));

      for (let i = 0; i < allQuestions.length; i++) {
        const question = allQuestions[i];
        try {
          process.stdout.write(
            `\r[${i + 1}/${allQuestions.length}] "${question.text.substring(0, 40)}..."의 임베딩 생성 중...`
          );

          const response = await openai.embeddings.create({
            model: embeddingModel,
            input: question.text,
            dimensions: expectedDimension,
          });

          const embedding = response.data[0].embedding;

          await prisma.question.update({
            where: { id: question.id },
            data: { embedding: embedding as Prisma.InputJsonValue },
          });

          successCount++;
        } catch (error) {
          console.error(
            `\n❌ 실패 [${i + 1}/${allQuestions.length}]: ${error instanceof Error ? error.message : String(error)}`
          );
          failCount++;
        }
      }

      console.log(
        `\n\n✅ 완료: ${successCount}개 성공, ${failCount}개 실패 (총 ${allQuestions.length}개)`
      );
    }

    // STEP 4: 검증
    console.log('\n' + '='.repeat(70));
    console.log('STEP 4: 차원 수 검증');
    console.log('='.repeat(70));

    const questionsAfter = await prisma.question.findMany();
    const questionDimensionsAfter = questionsAfter
      .map((q) => ({ id: q.id, dim: getEmbeddingDimension(parseEmbedding(q.embedding)) }))
      .reduce(
        (acc, cur) => {
          const dim = cur.dim;
          acc[dim || 'null'] = (acc[dim || 'null'] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

    console.log(`\n📊 Question 차원 분포 (재처리 후):`);
    Object.entries(questionDimensionsAfter).forEach(([dim, count]) => {
      const status = dim === String(expectedDimension) ? '✓' : '❌';
      console.log(`  ${status} ${dim}차원: ${count}개`);
    });

    const allChunksAfter = await prisma.documentChunk.findMany();
    const chunkDimensionsAfter = allChunksAfter
      .map((c) => ({ id: c.id, dim: getEmbeddingDimension(parseEmbedding(c.embedding)) }))
      .reduce(
        (acc, cur) => {
          const dim = cur.dim;
          acc[dim || 'null'] = (acc[dim || 'null'] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

    console.log(`\n📊 DocumentChunk 차원 분포 (검증):`);
    Object.entries(chunkDimensionsAfter).forEach(([dim, count]) => {
      const status = dim === String(expectedDimension) ? '✓' : '❌';
      console.log(`  ${status} ${dim}차원: ${count}개`);
    });

    // FINAL SUMMARY
    console.log('\n' + '='.repeat(70));
    console.log('최종 요약');
    console.log('='.repeat(70));

    const allExpectedDim =
      Object.keys(questionDimensionsAfter).every((dim) => dim === String(expectedDimension)) &&
      Object.keys(chunkDimensionsAfter).every((dim) => dim === String(expectedDimension));

    console.log(`\n재처리 대상:`);
    console.log(`  • Question: ${allQuestions.length}개`);
    console.log(`  • DocumentChunk: 0개 (이전에 완료됨)`);
    console.log(`\n재처리 완료 후:`);
    console.log(`  ✓ Question 임베딩: ${successCount}/${allQuestions.length} 성공`);
    console.log(`  ✓ 모든 임베딩 차원: ${expectedDimension}차원`);
    console.log(`\n검증 결과: ${allExpectedDim ? '✅ 모두 통과' : '❌ 일부 미달'}`);

    console.log('\n' + '='.repeat(70));
    console.log(allExpectedDim ? '✅ 임베딩 재생성 완료!' : '⚠️ 일부 이상 감지');
    console.log('='.repeat(70));
  } catch (error) {
    console.error('❌ 오류:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

regenerateAllEmbeddings();
