# Scripts Guide

`scripts/`는 목적에 따라 아래처럼 분리되어 있다.

- `scripts/ops`: 데이터 재생성/수정 등 운영성 작업
- `scripts/diagnostics`: API/검색/프롬프트 동작 진단
- `scripts/shared`: 공통 유틸 (`loadEnv`)
  - preflight 유틸 포함 (`assertDatabaseReachable`, `assertApiServerReachable`)

## 실행 방법

TypeScript 스크립트는 아래 방식으로 실행한다.

```bash
node --import tsx <script-path>
```

예시:

```bash
node --import tsx scripts/diagnostics/e2e-test.ts
```

## ops

- `scripts/ops/regenerate-embeddings.ts`
  - 기존 `document_chunk` 임베딩 재생성
- `scripts/ops/regenerate-all-embeddings.ts`
  - `question` 임베딩 재생성 및 차원 검증
- `scripts/ops/update-chunks.ts`
  - 테스트용 청크 텍스트/임베딩 갱신

## diagnostics

- `scripts/diagnostics/preflight.ts`
  - DB/API 사전 연결 점검
- `scripts/diagnostics/e2e-test.ts`
  - `questions -> search -> answers` 흐름 점검
- `scripts/diagnostics/test-search.ts`
  - 기본 검색 유사도 분포 점검
- `scripts/diagnostics/test-search-v2.ts`
  - 다양한 쿼리로 threshold 분석
- `scripts/diagnostics/test-no-answer.ts`
  - 문서 외 질문 시나리오 점검
- `scripts/diagnostics/test-process-status.ts`
  - 문서 처리 상태/에러 흐름 점검
- `scripts/diagnostics/test-improved-prompt.ts`
  - 프롬프트 개선 효과 비교 실험

## 주의사항

- 운영 데이터에 영향을 줄 수 있는 스크립트는 `ops`에 있다.
- `diagnostics`도 DB 레코드를 생성/변경할 수 있으므로 로컬/스테이징에서 실행한다.
- 모든 스크립트는 `.env`의 `DATABASE_URL`, `OPENAI_API_KEY`에 의존한다.
- 운영 실행 전 체크리스트는 `docs/OPS_CHECKLIST.md` 참고.
- 권장 실행 순서: `npm run diag:preflight` 후 개별 `diag:*` 실행.
