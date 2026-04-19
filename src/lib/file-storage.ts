import { promises as fs } from 'fs';
import { join, resolve, dirname, basename, extname } from 'path';

export class FileStorage {
  private uploadDir: string;

  constructor(uploadDir?: string) {
    this.uploadDir = uploadDir || resolve(process.cwd(), 'uploads');
  }

  async save(documentId: string, fileName: string, buffer: Buffer): Promise<string> {
    try {
      const docDir = join(this.uploadDir, documentId);
      const filePath = join(docDir, fileName);

      this.validatePath(filePath);

      // 디렉토리 재귀 생성
      await fs.mkdir(docDir, { recursive: true });

      // 파일명 중복 처리 (파일이 이미 존재하면 타임스탐프 추가)
      const finalPath = await this.getUniqueFilePath(filePath);

      // 파일 쓰기 (binary mode)
      await fs.writeFile(finalPath, buffer);

      return finalPath;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`파일 저장 실패: ${message}`);
    }
  }

  getPath(documentId: string, fileName: string): string {
    return join(this.uploadDir, documentId, fileName);
  }

  private validatePath(filePath: string): void {
    const normalizedFilePath = resolve(filePath);
    const normalizedUploadDir = resolve(this.uploadDir);

    if (
      !normalizedFilePath.startsWith(normalizedUploadDir + '/') &&
      normalizedFilePath !== normalizedUploadDir
    ) {
      throw new Error('잘못된 경로입니다');
    }
  }

  async read(documentId: string, fileName: string): Promise<Buffer> {
    try {
      const filePath = this.getPath(documentId, fileName);
      return await this.readByPath(filePath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`파일 읽기 실패 (${documentId}/${fileName}): ${message}`);
    }
  }

  async readByPath(filePath: string): Promise<Buffer> {
    this.validatePath(filePath);
    return await fs.readFile(filePath);
  }

  async delete(documentId: string, fileName: string): Promise<void> {
    try {
      const filePath = this.getPath(documentId, fileName);
      await this.deleteByPath(filePath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`파일 삭제 실패 (${documentId}/${fileName}): ${message}`);
    }
  }

  async deleteByPath(filePath: string): Promise<void> {
    this.validatePath(filePath);
    await fs.unlink(filePath);
  }

  private async getUniqueFilePath(filePath: string): Promise<string> {
    try {
      // 파일이 없으면 그대로 반환
      await fs.access(filePath);
      // 파일이 존재하면 타임스탐프 추가
      const dir = dirname(filePath);
      const ext = this.getFileExtension(filePath);
      const nameWithoutExt = this.getFileNameWithoutExtension(filePath);
      const timestamp = Date.now();
      const uniquePath = join(dir, `${nameWithoutExt}_${timestamp}${ext}`);
      return uniquePath;
    } catch {
      // 파일이 없으므로 원본 경로 반환
      return filePath;
    }
  }

  private getFileExtension(filePath: string): string {
    return extname(filePath);
  }

  private getFileNameWithoutExtension(filePath: string): string {
    const fileName = basename(filePath);
    const ext = extname(fileName);
    return ext ? fileName.slice(0, -ext.length) : fileName;
  }
}

export const fileStorage = new FileStorage();
