import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateLLMResponseMock = vi.fn();

vi.mock('./openai', () => ({
  generateLLMResponse: generateLLMResponseMock,
}));

describe('generateAnswer', () => {
  beforeEach(() => {
    generateLLMResponseMock.mockReset();
  });

  it('builds an answer prompt and returns the llm response', async () => {
    generateLLMResponseMock.mockResolvedValue('문서 기반 답변');

    const { generateAnswer } = await import('./llm');
    const result = await generateAnswer('질문', '문서 내용');

    expect(result).toBe('문서 기반 답변');
    expect(generateLLMResponseMock).toHaveBeenCalledTimes(1);
    expect(generateLLMResponseMock.mock.calls[0]?.[0]).toContain('문서 내용');
    expect(generateLLMResponseMock.mock.calls[0]?.[0]).toContain('질문: 질문');
  });

  it('maps timeout errors to status 504', async () => {
    generateLLMResponseMock.mockRejectedValue(new Error('timeout while requesting llm'));

    const { generateAnswer } = await import('./llm');

    await expect(generateAnswer('질문', '문서 내용')).rejects.toMatchObject({
      message: 'LLM API timeout - 요청 처리 시간 초과',
      status: 504,
    });
  });

  it('maps rate limit errors to status 429', async () => {
    generateLLMResponseMock.mockRejectedValue(new Error('Rate limit exceeded'));

    const { generateAnswer } = await import('./llm');

    await expect(generateAnswer('질문', '문서 내용')).rejects.toMatchObject({
      message: 'LLM API rate limit - 요청 한도 초과',
      status: 429,
    });
  });
});
