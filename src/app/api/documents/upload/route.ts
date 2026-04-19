import { NextRequest, NextResponse } from 'next/server';
import { documentUploadService, documentProcessService } from '@/lib/services/document';
import type { Status } from '@/generated/prisma/enums';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'BadRequest', message: '파일이 업로드되지 않았습니다' },
        { status: 400 }
      );
    }

    // 1. 파일 업로드
    const result = await documentUploadService.uploadDocument(file);
    let finalStatus: Status = result.status;
    let message = '파일이 업로드되어 처리 중입니다.';

    // 2. 즉시 문서 처리 (동기)
    try {
      await documentProcessService.processDocument(result.id);
      finalStatus = 'completed';
      message = '파일 업로드와 문서 처리가 완료되었습니다.';
    } catch (processingError) {
      finalStatus = 'failed';
      message = '파일 업로드는 완료되었지만 문서 처리에 실패했습니다.';
      console.warn(`문서 처리 실패 (문서 저장은 완료됨): ${result.id}`, processingError);
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          id: result.id,
          fileName: result.fileName,
          status: finalStatus,
          message,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Upload error:', error);

    const message = error instanceof Error ? error.message : '파일 업로드에 실패했습니다';

    if (message.includes('지원하지 않는 파일 형식')) {
      return NextResponse.json(
        { success: false, error: 'BadRequest', message: 'PDF, TXT, MD 파일만 지원됩니다' },
        { status: 400 }
      );
    }

    if (message.includes('파일 크기가 최대 크기')) {
      return NextResponse.json(
        { success: false, error: 'PayloadTooLarge', message: '파일 크기가 100MB를 초과합니다' },
        { status: 413 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'InternalServerError',
        message: '파일 업로드에 실패했습니다',
      },
      { status: 500 }
    );
  }
}
