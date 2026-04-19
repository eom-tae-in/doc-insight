import { OpenAI } from 'openai';
import { env } from './validation';

let openaiClient: OpenAI | null = null;

/**
 * OpenAI 클라이언트를 초기화합니다.
 */
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!env.openai.apiKey) {
      throw new Error(
        'OpenAI API key is not configured. ' +
        'Please set OPENAI_API_KEY in your .env file.'
      );
    }
    openaiClient = new OpenAI({
      apiKey: env.openai.apiKey,
    });
  }
  return openaiClient;
}

/**
 * OpenAI API 연결을 테스트합니다.
 */
export async function testOpenAIConnection(): Promise<boolean> {
  try {
    const client = getOpenAIClient();

    const response = await client.chat.completions.create({
      model: env.llm.model,
      messages: [
        {
          role: 'user',
          content: 'What is 1 + 1? Answer with just the number.',
        },
      ],
      max_tokens: 10,
    });

    const result = response.choices[0]?.message?.content;
    console.log('✅ OpenAI API test successful:', result);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ OpenAI API test failed:', errorMessage);
    throw error;
  }
}

/**
 * 텍스트를 임베딩으로 변환합니다.
 * @param text 임베딩할 텍스트
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const client = getOpenAIClient();

    const response = await client.embeddings.create({
      model: env.embedding.model,
      input: text,
      dimensions: env.embedding.dimension,
    });

    return response.data[0].embedding;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Embedding generation failed:', errorMessage);
    throw error;
  }
}

/**
 * LLM으로 답변을 생성합니다.
 * @param prompt 프롬프트
 */
export async function generateLLMResponse(prompt: string): Promise<string> {
  try {
    const client = getOpenAIClient();

    const response = await client.chat.completions.create({
      model: env.llm.model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const result = response.choices[0]?.message?.content;
    if (!result) {
      throw new Error('No response from OpenAI API');
    }
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ LLM response generation failed:', errorMessage);
    throw error;
  }
}
