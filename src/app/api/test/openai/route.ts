import { NextResponse } from 'next/server';
import { testOpenAIConnection } from '@/lib/openai';

/**
 * GET /api/test/openai
 * OpenAI API 연결을 테스트합니다.
 */
export async function GET() {
  try {
    await testOpenAIConnection();

    return NextResponse.json(
      {
        status: 'success',
        message: 'OpenAI API connection test passed',
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      {
        status: 'error',
        message: 'OpenAI API connection test failed',
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
