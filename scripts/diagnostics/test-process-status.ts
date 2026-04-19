import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { loadEnv } from '../shared/utils';
import { assertApiServerReachable, assertDatabaseReachable } from '../shared/preflight';

async function testProcessStatus() {
  const envVars = loadEnv();
  const dbUrl = envVars.DATABASE_URL;

  const adapter = new PrismaPg({ connectionString: dbUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    await assertDatabaseReachable(prisma);
    await assertApiServerReachable('http://localhost:3000');
    console.log('📋 Process Status 변경 테스트\n');

    // 1. 테스트 문서 생성 (status = processing)
    console.log('='.repeat(70));
    console.log('STEP 1: 새 문서 생성 (status = processing)');
    console.log('='.repeat(70));

    const newDoc = await prisma.document.create({
      data: {
        fileName: 'test-document.txt',
        fileType: 'TXT',
        content: 'Test content',
        status: 'processing',
      },
    });

    console.log(`\n✓ 새 문서 생성:`);
    console.log(`  Document ID: ${newDoc.id}`);
    console.log(`  상태: ${newDoc.status} (생성 시 기본값)`);

    // 2. process API 호출
    console.log('\n' + '='.repeat(70));
    console.log('STEP 2: process API 호출');
    console.log('='.repeat(70));

    const processUrl = `http://localhost:3000/api/documents/${newDoc.id}/process`;
    console.log(`\nREQUEST: POST ${processUrl}`);

    const processRes = await fetch(processUrl, { method: 'POST' });
    const responseText = await processRes.text();

    console.log(`\nRESPONSE (${processRes.status}):`);
    try {
      const processData = JSON.parse(responseText);
      console.log(JSON.stringify(processData, null, 2));
    } catch {
      console.log(`[JSON 파싱 실패 - HTML 응답]`);
      console.log(responseText.substring(0, 200) + '...');
    }

    // 3. 문서 상태 확인
    console.log('\n' + '='.repeat(70));
    console.log('STEP 3: 데이터베이스에서 최종 상태 확인');
    console.log('='.repeat(70));

    const updatedDoc = await prisma.document.findUnique({
      where: { id: newDoc.id },
    });

    console.log(`\n✓ 최종 상태:`);
    console.log(`  상태: ${updatedDoc?.status}`);

    const isSuccess =
      (processRes.status === 200 || processRes.status === 500) &&
      (updatedDoc?.status === 'completed' || updatedDoc?.status === 'failed');

    console.log(`\n${isSuccess ? '✓' : '❌'} 상태 변경 검증:`);
    console.log(`  processing → ${updatedDoc?.status}: ${isSuccess ? '성공' : '실패'}`);
    console.log(`  schema enum과 일치 (lowercase): ${['processing', 'completed', 'failed'].includes(updatedDoc?.status || '') ? '✓' : '❌'}`);

    // 4. 이제 2개 문서가 있으므로 다른 문서 chunk 테스트 가능
    console.log('\n' + '='.repeat(70));
    console.log('STEP 4: 다른 문서의 chunk_id로 answer 생성 시도');
    console.log('='.repeat(70));

    const docs = await prisma.document.findMany({
      where: { status: 'completed' },
      take: 2,
    });

    if (docs.length < 2) {
      console.log('⊘ 테스트 조건 부족 (완료된 문서 2개 필요)');
    } else {
      const doc1 = docs[0];
      const doc2 = docs[1];

      console.log(`\n✓ 문서 2개 확인:`);
      console.log(`  Document 1: ${doc1.id}`);
      console.log(`  Document 2: ${doc2.id}`);

      // doc1의 질문과 doc2의 청크로 테스트
      const question = await prisma.question.findFirst({
        where: { documentId: doc1.id },
      });

      const otherDocChunk = await prisma.documentChunk.findFirst({
        where: { documentId: doc2.id },
      });

      if (question && otherDocChunk) {
        console.log('\n[ answers API 호출: 다른 문서의 청크 ]');
        console.log('-'.repeat(70));

        const payload = {
          question_id: question.id,
          chunk_ids: [otherDocChunk.id],
          question_text: question.text,
        };

        console.log('REQUEST:');
        console.log(JSON.stringify(payload, null, 2));

        const answerRes = await fetch('http://localhost:3000/api/answers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const answerData = await answerRes.json();
        console.log(`\nRESPONSE (${answerRes.status}):`);
        console.log(JSON.stringify(answerData, null, 2));

        const isCorrect =
          answerRes.status === 400 &&
          answerData.message.includes('다른 문서 소속');

        console.log(`\n${isCorrect ? '✓' : '❌'} 검증:`);
        console.log(`  상태: 400 (예상: 400, 실제: ${answerRes.status})`);
        console.log(`  메시지: "다른 문서 소속" 포함: ${isCorrect ? '✓' : '❌'}`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ 테스트 완료');
    console.log('='.repeat(70));
  } catch (error) {
    console.error('❌ 오류:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

testProcessStatus();
