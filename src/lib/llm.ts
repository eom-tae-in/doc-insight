import { generateLLMResponse } from './openai';
import { ANSWER_PROMPT_TEMPLATE } from './prompts';

type ErrorWithStatus = Error & { status?: number };

export async function generateAnswer(
  question: string,
  context: string
): Promise<string> {
  try {
    const systemPrompt = ANSWER_PROMPT_TEMPLATE(context);
    const userMessage = `${systemPrompt}\n\n질문: ${question}\n\n답변:`;
    return await generateLLMResponse(userMessage);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    if (errorMsg.includes('timeout') || errorMsg.includes('Timeout')) {
      const timeoutErr: ErrorWithStatus = new Error(
        'LLM API timeout - 요청 처리 시간 초과'
      );
      timeoutErr.status = 504;
      throw timeoutErr;
    }

    if (
      errorMsg.includes('Rate limit') ||
      errorMsg.includes('rate limit') ||
      errorMsg.includes('429')
    ) {
      const rateLimitErr: ErrorWithStatus = new Error(
        'LLM API rate limit - 요청 한도 초과'
      );
      rateLimitErr.status = 429;
      throw rateLimitErr;
    }

    throw error;
  }
}
