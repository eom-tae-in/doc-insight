import { NextRequest, NextResponse } from 'next/server';
import { DocumentRepository } from '@/lib/database';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const documentRepository = new DocumentRepository();

  try {
    const { id } = await params;
    const document = await documentRepository.findById(id);

    if (!document) {
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
        success: true,
        data: {
          id: document.id,
          fileName: document.fileName,
          fileType: document.fileType,
          status: document.status,
          createdAt: document.createdAt,
          updatedAt: document.updatedAt,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '상태 조회에 실패했습니다';
    console.error('Status check error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'InternalServerError',
        message: message,
      },
      { status: 500 }
    );
  }
}
