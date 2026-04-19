import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parseDocumentCreate,
  parseQuestionCreate,
  parseAnswerCreate,
  parseDocumentUpdate,
  validateEnv,
} from './validation';

describe('validation', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('validates required environment variables', () => {
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('OPENAI_API_KEY', '');

    expect(() => validateEnv()).toThrow(/DATABASE_URL, OPENAI_API_KEY/);
  });

  it('parses valid document create payload', () => {
    const parsed = parseDocumentCreate({
      fileName: 'sample.pdf',
      fileType: 'PDF',
      filePath: '/tmp/sample.pdf',
    });

    expect(parsed.fileName).toBe('sample.pdf');
    expect(parsed.filePath).toBe('/tmp/sample.pdf');
  });

  it('rejects invalid question payload', () => {
    expect(() =>
      parseQuestionCreate({
        documentId: '',
        text: '',
      })
    ).toThrow(/Question 검증 실패/);
  });

  it('rejects invalid answer payload', () => {
    expect(() =>
      parseAnswerCreate({
        questionId: '',
        text: '',
      })
    ).toThrow(/Answer 검증 실패/);
  });

  it('rejects empty document update payload', () => {
    expect(() => parseDocumentUpdate({})).toThrow(/최소 하나 이상의 필드를 업데이트해야 합니다/);
  });
});
