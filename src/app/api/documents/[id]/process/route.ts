import { NextRequest, NextResponse } from 'next/server';
import { documentProcessService } from '@/lib/services/document';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await documentProcessService.processDocument(id);

    return NextResponse.json(
      {
        success: true,
        data: {
          documentId: id,
          chunkCount: result.totalChunks,
          totalTokens: result.totalTokens,
          processingTime: result.processingTime,
          message: '문서 처리 완료',
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '문서 처리 중 오류 발생';

    if (message.includes('Document not found')) {
      return NextResponse.json(
        {
          success: false,
          error: 'NotFound',
          message: '문서를 찾을 수 없습니다',
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'ProcessingFailed',
        message,
      },
      { status: 500 }
    );
  }
}
