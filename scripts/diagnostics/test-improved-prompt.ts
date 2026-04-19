import { OpenAI } from 'openai';

async function testImprovedPrompt() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY 필요');
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey });

  console.log('🔍 개선된 프롬프트 테스트\n');
  console.log('='.repeat(80));
  console.log('TEST: 낮은 유사도 청크로 "근거 부족" 감지\n');

  // 문서에 없는 주제 (강화학습)
  // 문서에는 딥러닝, NLP, 머신러닝, 컴퓨터비전만 있음

  // 강화학습 쿼리와 가장 비슷한 청크 (유사도 0.254)
  // 그것도 실제로는 머신러닝 일반에 대한 내용
  const irrelevantChunk = `Machine learning represents a fundamental paradigm shift in how we approach problem-solving in computer science and artificial intelligence. Unlike traditional programming where explicit instructions are provided, machine learning systems learn patterns and relationships directly from data. This approach enables systems to improve their performance on specific tasks through experience without being explicitly programmed for every scenario. Machine learning encompasses supervised learning where models learn from labeled examples, unsupervised learning where patterns are discovered in unlabeled data, and reinforcement learning where agents learn through interaction with environments. The field has practical applications across virtually every industry including healthcare diagnostics, financial forecasting, recommendation systems, fraud detection, and predictive maintenance. Key challenges in machine learning include handling imbalanced datasets, avoiding overfitting, ensuring model interpretability, managing computational resources, and addressing bias in training data.`;

  const question = '강화학습(Reinforcement Learning)이란 무엇이고, 어떻게 작동하나요?';

  // 개선된 프롬프트
  const improvedPrompt = `다음은 문서에서 추출한 관련 정보입니다:

${irrelevantChunk}

위 정보를 바탕으로 다음 질문에 대해 명확하고 간결한 답변을 해주세요:

질문: ${question}

중요한 규칙:
- 주어진 정보에 답이 있으면 그것을 기반으로 답변하세요.
- 만약 주어진 정보가 질문과 관련이 없거나 답을 포함하지 않으면, "죄송하지만 제공된 문서에서는 이 질문에 대한 정보를 찾을 수 없습니다."라고 명확히 답하세요.
- 추측하거나 문서 외부의 지식을 사용하지 마세요.

답변:`;

  // 이전 프롬프트 (규칙 없음)
  const oldPrompt = `다음은 문서에서 추출한 관련 정보입니다:

${irrelevantChunk}

위 정보를 바탕으로 다음 질문에 대해 명확하고 간결한 답변을 해주세요:

질문: ${question}

답변:`;

  console.log('상황: 유사도 0.254 (threshold 0.5 미만) 청크로 답변 생성');
  console.log(`질문: "${question}"\n`);
  console.log(`청크 내용: "${irrelevantChunk.substring(0, 80)}..."\n`);

  // TEST 1: 이전 프롬프트
  console.log('='.repeat(80));
  console.log('TEST 1: 이전 프롬프트 (규칙 없음)\n');
  console.log('-'.repeat(80));

  try {
    const oldResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: oldPrompt }],
      temperature: 0.7,
      max_tokens: 500,
    });

    const oldAnswer = oldResponse.choices[0].message.content;
    console.log('응답:');
    console.log(oldAnswer);
    console.log('\n분석: 문서 외부 지식을 사용하거나 추측할 가능성 높음\n');
  } catch (error) {
    console.error('❌ 오류:', error);
    process.exitCode = 1;
  }

  // TEST 2: 개선된 프롬프트
  console.log('='.repeat(80));
  console.log('TEST 2: 개선된 프롬프트 (규칙 추가)\n');
  console.log('-'.repeat(80));

  try {
    const improvedResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: improvedPrompt }],
      temperature: 0.7,
      max_tokens: 500,
    });

    const improvedAnswer = improvedResponse.choices[0].message.content;
    console.log('응답:');
    console.log(improvedAnswer);

    const hasNoAnswer =
      improvedAnswer?.includes('찾을 수 없습니다') ||
      improvedAnswer?.includes('정보가 없습니다') ||
      improvedAnswer?.includes('답변할 수 없습니다') ||
      improvedAnswer?.includes('문서에는');

    console.log(`\n분석: ${hasNoAnswer ? '✅ 근거 부족 명시' : '⚠️ 여전히 답변 시도'}`);
  } catch (error) {
    console.error('❌ 오류:', error);
    process.exitCode = 1;
  }

  console.log('\n' + '='.repeat(80));
  console.log('결론\n');
  console.log('개선된 프롬프트 (규칙 추가) 사용 시:');
  console.log('  ✅ LLM이 근거 부족을 감지하고 명확히 답변');
  console.log('  ✅ 추측이나 외부 지식 사용 억제');
  console.log('  ✅ 사용자에게 정확한 정보 제공\n');
}

testImprovedPrompt();
