# DocInsight

DocInsight는 사용자가 업로드한 PDF/TXT/MD 문서를 처리한 뒤, 해당 문서 기준으로 질문하고 근거 기반 답변을 받을 수 있는 문서 Q&A MVP입니다.

현재 구현은 로컬 실행 기준 MVP입니다. 프로덕션 배포와 운영 모니터링은 아직 포함하지 않습니다.

## 주요 기능

- PDF, TXT, MD 문서 업로드
- 업로드 문서 텍스트 추출
- 문장 기반 청킹 및 overlap 적용
- 짧은 문서 청킹 fallback
- 섹션 제목 기반 청크 문맥 보강
- OpenAI 임베딩 생성 및 PostgreSQL 저장
- 질문 저장 및 질문 임베딩 생성
- 벡터 유사도 + 키워드 점수 기반 hybrid search
- 검색 결과 0개 시 fallback 근거 제공
- LLM 답변 생성 및 근거 청크 표시
- fallback 근거 UI 구분 표시

## 기술 스택

| 영역 | 기술 |
|------|------|
| Framework | Next.js 16.2.4 App Router |
| UI | React 19.2.4, Tailwind CSS 4 |
| Language | TypeScript 5 |
| Database | PostgreSQL, Prisma 7 |
| PDF Parser | pdf-parse |
| AI | OpenAI Embeddings, OpenAI Chat Completions |
| Test | Vitest |

## 실행 방법

```bash
npm install
cp .env.example .env
npm run db:generate
npm run dev
```

`.env`에는 실제 `DATABASE_URL`과 `OPENAI_API_KEY`를 설정해야 합니다.

## 환경 변수

| 변수 | 설명 |
|------|------|
| `DATABASE_URL` | PostgreSQL 연결 문자열 |
| `OPENAI_API_KEY` | OpenAI API 키 |
| `MAX_FILE_SIZE` | 최대 업로드 크기 |
| `UPLOAD_DIR` | 로컬 업로드 디렉터리 |
| `EMBEDDING_MODEL` | 임베딩 모델 |
| `EMBEDDING_DIMENSION` | 임베딩 차원 |
| `SEARCH_RESULT_LIMIT` | 기본 검색 결과 수 |
| `SIMILARITY_THRESHOLD` | 검색 통과 기준 |
| `DOCUMENT_PROCESSING_TIMEOUT` | 문서 처리 타임아웃 |
| `LLM_TIMEOUT` | LLM 호출 타임아웃 |

## 주요 페이지

| 경로 | 설명 |
|------|------|
| `/` | 메인 페이지 |
| `/upload` | 문서 업로드 |
| `/processing/[id]` | 문서 처리 상태 |
| `/qa/[id]` | 특정 문서 Q&A |

## 주요 API

| Method | Path | 설명 |
|--------|------|------|
| `POST` | `/api/documents/upload` | 파일 업로드 및 문서 처리 |
| `GET` | `/api/documents/[id]/status` | 문서 상태 조회 |
| `POST` | `/api/documents/[id]/process` | 문서 재처리 |
| `POST` | `/api/questions` | 질문 저장 |
| `GET` | `/api/search?question_id=...` | 질문 기준 검색 |
| `POST` | `/api/answers` | 답변 생성 |

## 검색 정책

현재 검색 점수는 벡터 유사도와 키워드 점수를 함께 사용합니다.

```text
finalScore = vectorSimilarity + keywordScore * 0.2
```

기본 threshold는 `SIMILARITY_THRESHOLD=0.5`입니다. threshold 이상 결과가 없으면 상위 2개 청크를 fallback 근거로 반환합니다.

## 검증

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

2026-04-19 기준 위 명령은 통과 상태입니다.

## 문서

- [PRD](docs/PRD.md)
- [TRD](docs/TRD.md)
- [Roadmap](ROADMAP.md)
- [Scripts Guide](docs/SCRIPTS.md)
- [Ops Checklist](docs/OPS_CHECKLIST.md)

## 현재 한계

- Q&A 검색 대상은 현재 문서 1개입니다.
- 업로드 파일 저장은 로컬 파일 시스템 기준입니다.
- Vercel 같은 서버리스 배포 전에는 파일 저장 전략을 재검토해야 합니다.
- fallback 근거는 답변 생성을 돕지만 정답 근거를 보장하지 않습니다.
- 기존 처리 문서는 청킹 정책 변경이 자동 반영되지 않으므로 재처리 또는 재업로드가 필요합니다.
