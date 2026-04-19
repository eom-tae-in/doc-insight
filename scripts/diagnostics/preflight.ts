import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { loadEnv } from '../shared/utils';
import { assertApiServerReachable, assertDatabaseReachable } from '../shared/preflight';

async function runPreflight() {
  const envVars = loadEnv();
  const dbUrl = envVars.DATABASE_URL;
  const baseUrl = envVars.APP_BASE_URL || 'http://localhost:3000';
  const skipServer = process.argv.includes('--skip-server');

  if (!dbUrl) {
    console.error('❌ DATABASE_URL이 누락되었습니다.');
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: dbUrl }),
  });

  try {
    console.log('Preflight 시작');

    await assertDatabaseReachable(prisma);
    console.log('✅ Database 연결 확인');

    if (!skipServer) {
      await assertApiServerReachable(baseUrl);
      console.log(`✅ API 서버 연결 확인 (${baseUrl})`);
    } else {
      console.log('ℹ️ API 서버 점검은 --skip-server 옵션으로 생략됨');
    }

    console.log('✅ Preflight 통과');
  } catch (error) {
    console.error('❌ Preflight 실패:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

runPreflight();
