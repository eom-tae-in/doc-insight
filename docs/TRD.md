# DocInsight TRD

## 1. 문서 개요

- 기준 PRD: `docs/PRD.md`
- 기준일: 2026-04-19
- 범위: MVP 로컬 구현 기준
- 배포: 아직 미완료

이 문서는 현재 코드 구현을 기준으로 작성한다.

## 2. 시스템 개요

DocInsight는 문서 업로드, 문서 처리, 질문 저장, 검색, 답변 생성을 수행하는 Next.js 기반 문서 Q&A 시스템이다.

현재 실제 동작 흐름:

1. 사용자가 파일을 업로드한다.
2. 서버가 원본 파일을 로컬 파일 시스템에 저장한다.
3. 서버가 Document 레코드를 생성한다.
4. 서버가 문서를 즉시 동기 처리한다.
5. 텍스트 추출, 청킹, 임베딩 생성, 청크 저장을 수행한다.
6. 사용자가 특정 문서 Q&A 페이지에서 질문한다.
7. 서버가 질문과 질문 임베딩을 저장한다.
8. 서버가 해당 문서의 청크만 대상으로 hybrid search를 수행한다.
9. 서버가 검색된 청크를 기반으로 LLM 답변을 생성한다.
10. UI가 답변과 근거 청크를 표시한다.

## 3. 기술 스택

| 항목 | 선택 | 상태 |
|------|------|------|
| 프레임워크 | Next.js 16.2.4 App Router | 사용 중 |
| React | React 19.2.4 | 사용 중 |
| 언어 | TypeScript 5 | 사용 중 |
| DB | PostgreSQL + Prisma 7 | 사용 중 |
| DB 어댑터 | `@prisma/adapter-pg` | 사용 중 |
| 파일 저장 | 로컬 파일 시스템 | 사용 중 |
| PDF 파싱 | `pdf-parse` 2.4.5 | 사용 중 |
| 임베딩 | OpenAI Embeddings | 사용 중 |
| 답변 생성 | OpenAI Chat Completions | 사용 중 |
| 스타일 | Tailwind CSS 4 | 사용 중 |
| 테스트 | Vitest | 사용 중 |

비고:

- 프로덕션 빌드는 `next build --webpack`을 사용한다.
- 독립 타입 검사는 `tsconfig.typecheck.json` 기준이다.
- Next.js 16 관련 구현은 `node_modules/next/dist/docs/`의 현재 버전 문서를 기준으로 확인해야 한다.

## 4. 아키텍처

```text
UI Page
  ↓
Next.js API Route
  ↓
Service / Domain Logic
  ↓
Repository / Prisma
  ↓
PostgreSQL + Local File Storage
```

주요 도메인:

| 도메인 | 책임 |
|--------|------|
| Document Management | 파일 검증, 파일 저장, Document 메타데이터 생성 |
| Document Processing | 텍스트 추출, 청킹, 임베딩 생성, 청크 저장, 상태 갱신 |
| Search & QA | 질문 저장, 검색 점수 계산, 답변 생성, 근거 반환 |
| UI Flow | 업로드, 처리 상태, Q&A, fallback 근거 표시 |

## 5. 페이지 구조

| 경로 | 역할 | 상태 |
|------|------|------|
| `/` | 메인 페이지 | 완료 |
| `/upload` | 문서 업로드 페이지 | 완료 |
| `/processing/[id]` | 문서 처리 상태 페이지 | 완료 |
| `/qa/[id]` | 특정 문서 Q&A 페이지 | 완료 |

Q&A는 URL의 `id`에 해당하는 문서만 대상으로 동작한다.

## 6. API 설계

### `POST /api/documents/upload`

목적: 파일 업로드, Document 생성, 문서 처리 실행

요청:

- `multipart/form-data`
- `file`

처리:

1. 파일 존재 여부 확인
2. 파일 형식 및 크기 검증
3. Document 생성
4. 로컬 파일 저장
5. `filePath` 기록
6. `documentProcessService.processDocument(id)` 동기 실행
7. 성공 시 `completed`, 실패 시 `failed`

응답:

- 성공 status: `201`
- `success`
- `data.id`
- `data.fileName`
- `data.status`
- `data.message`

주의:

- 문서 처리 실패 시에도 파일 저장과 Document 생성은 완료될 수 있다.
- 처리 실패는 응답의 `data.status = failed`로 표현된다.

### `GET /api/documents/[id]/status`

목적: 문서 처리 상태 조회

응답:

- `id`
- `fileName`
- `fileType`
- `status`
- `createdAt`
- `updatedAt`

### `POST /api/documents/[id]/process`

목적: 특정 문서 재처리

처리:

1. Document 조회
2. 저장된 `filePath` 기준 파일 읽기
3. 기존 청크 삭제
4. 텍스트 추출, 청킹, 임베딩 생성
5. 새 청크 저장
6. 상태 갱신

### `POST /api/questions`

목적: 질문 저장 및 질문 임베딩 생성

요청:

- `document_id`
- `question_text`

검증:

- 질문은 1자 이상 1000자 이하
- `document_id`는 필수
- 문서가 존재해야 함
- 문서 상태가 `completed`여야 함

응답:

- 성공 status: `200`
- `success`
- `data.id`
- `data.created_at`

### `GET /api/search?question_id=...&limit=...`

목적: 저장된 질문 기준으로 관련 청크 검색

요청:

- `question_id` 필수
- `limit` 선택, 기본 5, 최대 10

처리:

1. Question 조회
2. Question의 `documentId`로 Document 조회
3. 문서 상태 확인
4. 저장된 question embedding 사용
5. embedding이 없으면 질문 텍스트로 임베딩 생성
6. 해당 문서의 청크 조회
7. `scoreChunks`로 hybrid score 계산
8. threshold 이상 결과 반환
9. 결과가 0개면 fallback 상위 2개 반환

응답:

- `chunks[]`
- `chunks[].id`
- `chunks[].text`
- `chunks[].order`
- `chunks[].similarity`
- `fallback`

### `POST /api/answers`

목적: 검색된 청크를 근거로 답변 생성

요청:

- `question_id`
- `chunk_ids[]`

처리:

1. Question 조회
2. 요청 청크 조회
3. 청크가 질문의 문서와 같은 문서 소속인지 검증
4. 저장된 `question.text` 기준 프롬프트 구성
5. LLM 답변 생성
6. Answer 저장
7. 근거 청크를 동일 scoring 로직으로 다시 점수화해 반환

응답:

- `id`
- `answer_text`
- `chunks[]`
- `created_at`

### `GET /api/test/openai`

목적: OpenAI 연결 점검

## 7. 데이터 모델

### Document

| 필드 | 설명 |
|------|------|
| `id` | 문서 ID |
| `fileName` | 원본 파일명 |
| `fileType` | `PDF`, `TXT`, `MD` |
| `filePath` | 실제 저장 파일 경로 |
| `status` | `processing`, `completed`, `failed` |
| `content` | 추출된 텍스트 |
| `createdAt` | 생성 시간 |
| `updatedAt` | 수정 시간 |

### DocumentChunk

| 필드 | 설명 |
|------|------|
| `id` | 청크 ID |
| `documentId` | 소속 문서 ID |
| `chunkIndex` | 문서 내 순서 |
| `text` | 청크 텍스트 |
| `embedding` | 청크 임베딩 JSON |
| `createdAt` | 생성 시간 |

### Question

| 필드 | 설명 |
|------|------|
| `id` | 질문 ID |
| `documentId` | 대상 문서 ID |
| `text` | 질문 텍스트 |
| `embedding` | 질문 임베딩 JSON |
| `createdAt` | 생성 시간 |

### Answer

| 필드 | 설명 |
|------|------|
| `id` | 답변 ID |
| `questionId` | 질문 ID |
| `text` | 답변 텍스트 |
| `chunks` | 근거 청크 N:M 관계 |
| `createdAt` | 생성 시간 |

## 8. 문서 처리 설계

### 파싱

지원 형식:

- PDF
- TXT
- MD

PDF 파싱:

- `pdf-parse`를 사용한다.
- Next.js dev/server 번들에서 worker 경로가 깨지는 문제를 방지하기 위해 `PDFParse.setWorker()`로 `pdf.worker.mjs` 위치를 명시한다.
- worker는 추출 데이터를 저장하는 파일이 아니라, PDF 텍스트 추출을 수행하기 위한 라이브러리 실행 보조 파일이다.

### 청킹

기본 설정:

| 항목 | 값 |
|------|----|
| `minTokens` | 150 |
| `maxTokens` | 400 |
| `overlapTokens` | 50 |

정책:

- 문장 단위로 텍스트를 나눈 뒤 최대 토큰 수에 맞춰 청크를 구성한다.
- 청크 사이에는 50 토큰 수준의 overlap을 둔다.
- 청크가 너무 짧으면 기본적으로 제외한다.
- 단, 전체 문서가 짧아 청크가 0개가 되면 `minTokens: 1`로 완화해 재청킹한다.
- 섹션 제목이 감지되면 이후 청크에 제목을 prefix로 보강해 검색 문맥을 높인다.

### 임베딩

- 청크별 텍스트 임베딩을 생성한다.
- 생성된 임베딩은 `DocumentChunk.embedding`에 JSON으로 저장한다.
- 질문도 별도 임베딩을 생성해 `Question.embedding`에 저장한다.

## 9. 검색 설계

현재 검색은 hybrid scoring 방식이다.

```text
finalScore = vectorSimilarity + keywordScore * 0.2
```

점수는 최대 1로 제한한다.

| 항목 | 설명 |
|------|------|
| `vectorSimilarity` | 질문 임베딩과 청크 임베딩의 cosine similarity |
| `keywordScore` | 질문 키워드가 청크에 포함된 비율 |
| `KEYWORD_WEIGHT` | 0.2 |
| `SIMILARITY_THRESHOLD` | 환경변수, 기본 0.5 |

fallback:

- threshold 이상 결과가 0개이면 전체 score 기준 상위 2개를 반환한다.
- fallback 결과도 답변 생성에 사용할 수 있다.
- 단, UI에서 “관련성 낮을 수 있음” 상태로 구분한다.

중요:

- 검색 API와 답변 API는 같은 `scoreChunks` 로직을 사용한다.
- UI에 표시되는 유사도는 벡터 단독 점수가 아니라 hybrid score다.

## 10. Q&A 시퀀스

1. 사용자가 `/qa/[id]`에서 질문 입력
2. 클라이언트가 `POST /api/questions` 호출
3. 서버가 질문 임베딩 생성 및 Question 저장
4. 클라이언트가 `GET /api/search?question_id=...` 호출
5. 서버가 현재 문서 청크만 대상으로 검색 수행
6. 클라이언트가 검색 결과의 `chunk_ids`로 `POST /api/answers` 호출
7. 서버가 LLM 답변 생성 및 Answer 저장
8. 클라이언트가 답변, 근거, fallback 상태 표시

## 11. UI 동작

Q&A 페이지:

- 질문 입력창은 흰 배경과 어두운 텍스트를 사용한다.
- 일반 검색 결과는 “근거” 섹션으로 표시한다.
- fallback 검색 결과는 amber 계열 카드와 “관련성 낮을 수 있음” 배지로 구분한다.
- 메인 페이지로 돌아가는 링크를 제공한다.

처리 페이지:

- 문서 상태를 조회한다.
- 완료되면 Q&A 페이지로 이동한다.
- 실패 상태면 에러를 표시한다.

## 12. 예외 처리

| 상황 | 처리 |
|------|------|
| 파일 없음 | 400 |
| 지원하지 않는 파일 형식 | 400 |
| 파일 크기 초과 | 413 |
| 문서 없음 | 404 |
| 질문 없음 | 404 |
| 문서 처리 미완료 상태에서 질문 | 400 |
| 유효하지 않은 청크 | 400 |
| 다른 문서 소속 청크 | 400 |
| OpenAI rate limit | 429 |
| OpenAI timeout | 504 |
| 문서 처리 실패 | `Document.status = failed` |

## 13. 검증 상태

2026-04-19 기준 통과:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

현재 테스트 구성:

- 파싱/청킹 단위 테스트
- 문서 처리 서비스 테스트
- 검색 API 테스트
- 답변 API 테스트
- 질문 API 테스트
- mock 기반 E2E 흐름 테스트

아직 남은 검증:

- 브라우저 기반 실제 E2E 자동화
- 프로덕션 배포 환경 검증
- 운영 환경 rate limit, timeout, 로그 정책 검증

## 14. 운영/진단 스크립트

진단 shortcut:

- `npm run diag:preflight`
- `npm run diag:e2e`
- `npm run diag:search`
- `npm run diag:search:v2`
- `npm run diag:no-answer`
- `npm run diag:process-status`
- `npm run diag:prompt`

운영 shortcut:

- `npm run ops:regen-embeddings`
- `npm run ops:regen-all-embeddings`
- `npm run ops:update-chunks`

스크립트 구조:

| 경로 | 역할 |
|------|------|
| `scripts/diagnostics` | 진단용 스크립트 |
| `scripts/ops` | 운영성 데이터 작업 |
| `scripts/shared` | 공통 유틸 |

## 15. 현재 기술 한계

- 파일 저장은 로컬 파일 시스템 기준이라 Vercel 같은 서버리스 배포 환경에서는 저장소 전략 재검토가 필요하다.
- 여러 문서 통합 검색은 아직 지원하지 않는다.
- 검색 품질은 청킹 품질, 문서 구조, 질문 표현에 영향을 받는다.
- fallback은 답변 생성을 시도하게 해주지만 정답 근거를 보장하지 않는다.
- 기존 문서는 청킹 정책 변경이 자동 반영되지 않으므로 재처리나 재업로드가 필요하다.
