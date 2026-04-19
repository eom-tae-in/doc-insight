import { OpenAI } from 'openai';
import { PrismaClient, Prisma } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { loadEnv } from '../shared/utils';

async function regenerateEmbeddings() {
  const envVars = loadEnv();
  const dbUrl = envVars.DATABASE_URL;
  const apiKey = envVars.OPENAI_API_KEY;
  const embeddingModel = envVars.EMBEDDING_MODEL || 'text-embedding-3-small';

  if (!dbUrl || !apiKey) {
    console.error('❌ DATABASE_URL 또는 OPENAI_API_KEY가 누락되었습니다.');
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey });
  const adapter = new PrismaPg({ connectionString: dbUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    console.log('📊 기존 청크 조회 중...');
    const chunks = await prisma.documentChunk.findMany();
    console.log(`✓ 총 ${chunks.length}개 청크 발견`);
    console.log(`✓ 임베딩 모델: ${embeddingModel}`);

    if (chunks.length === 0) {
      console.log('⚠️ 재생성할 청크가 없습니다.');
      process.exitCode = 1;
      return;
    }

    console.log('\n🔄 임베딩 재생성 시작...');
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        console.log(`[${i + 1}/${chunks.length}] "${chunk.text.substring(0, 50)}..."의 임베딩 생성 중...`);
        const response = await openai.embeddings.create({
          model: embeddingModel,
          input: chunk.text,
          dimensions: 1536,
        });

        const embedding = response.data[0].embedding;
        await prisma.documentChunk.update({
          where: { id: chunk.id },
          data: { embedding: embedding as Prisma.InputJsonValue },
        });
        console.log(`✓ 완료 (차원: ${embedding.length})`);
      } catch (error) {
        console.error(`❌ 실패: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log('\n✅ 모든 청크의 임베딩 재생성 완료!');
  } catch (error) {
    console.error('❌ 오류:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

regenerateEmbeddings();
