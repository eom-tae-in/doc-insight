# DocInsight Roadmap

## 1. 현재 상태

기준일: 2026-04-19

현재 MVP 로컬 구현은 완료 상태다. 문서 업로드, 문서 처리, 청킹, 임베딩, 검색, 답변 생성, Q&A UI, fallback UI, 기본 자동 검증까지 동작한다.

배포와 운영 모니터링은 아직 범위 밖이며 미완료 상태다.

## 2. 완료된 작업

### 기반 구성

- Next.js 16.2.4 App Router 기반 프로젝트 구성
- React 19.2.4 적용
- TypeScript 5 적용
- Tailwind CSS 4 적용
- Prisma 7 + PostgreSQL 연결 구성
- OpenAI Embeddings 및 Chat Completions 연동

### 데이터 계층

- `Document`, `DocumentChunk`, `Question`, `Answer` 모델 구성
- Repository 계층 구현
- Document 상태 관리 구현
- 질문과 답변 저장 구조 구현
- 답변과 근거 청크 관계 저장 구현

### 문서 업로드 및 처리

- PDF, TXT, MD 업로드 구현
- 파일 검증 및 로컬 저장 구현
- 실제 저장 경로 `filePath` 추적 구현
- PDF 파서 worker 경로 명시 처리
- 텍스트 추출 구현
- 기본 청킹 정책 적용
- 짧은 문서 청킹 fallback 적용
- 섹션 제목 기반 청크 문맥 보강 적용
- 청크별 임베딩 생성 및 저장 구현
- 재처리 시 기존 청크 정리 구현

### 검색 및 답변

- 질문 저장 API 구현
- 질문 임베딩 생성 구현
- 질문 ID 기반 검색 API 구현
- 현재 문서 기준 검색 범위 제한 구현
- 벡터 검색 + 키워드 검색 hybrid scoring 구현
- threshold 기반 검색 결과 필터링 구현
- 결과 0개 fallback 검색 구현
- 답변 생성 API 구현
- 검색 API와 답변 API의 유사도 점수 계산 로직 통일

### UI

- 메인 페이지 구현
- 업로드 페이지 구현
- 처리 상태 페이지 구현
- Q&A 페이지 구현
- Q&A 입력창 텍스트 색상 문제 수정
- Q&A 페이지에서 메인 페이지 이동 버튼 추가
- 일반 근거 UI 구현
- fallback 근거 구분 UI 구현
- 반응형 화면 확인

### 테스트 및 검증

- 단위 테스트 및 API route 테스트 구성
- mock 기반 E2E 흐름 테스트 구성
- `npm run lint` 통과
- `npm run typecheck` 통과
- `npm test` 통과
- `npm run build` 통과

## 3. 현재 구현 기준

### 문서 처리 플로우

1. 사용자가 `/upload`에서 파일 업로드
2. `POST /api/documents/upload` 호출
3. Document 생성 및 파일 저장
4. 문서 처리 서비스 실행
5. 텍스트 추출
6. 청킹
7. 임베딩 생성
8. 기존 청크 정리 후 새 청크 저장
9. Document 상태 갱신
10. 처리 완료 후 `/qa/[id]`에서 질문 가능

### Q&A 플로우

1. 사용자가 `/qa/[id]`에서 질문 입력
2. `POST /api/questions`로 질문 저장
3. `GET /api/search?question_id=...`로 현재 문서 청크 검색
4. threshold 이상 결과가 있으면 해당 결과 사용
5. threshold 이상 결과가 없으면 fallback 상위 2개 사용
6. `POST /api/answers`로 답변 생성
7. 답변과 근거 청크 표시
8. fallback이면 일반 근거와 다른 UI로 표시

## 4. 현재 품질 기준

검색 설정:

| 항목 | 현재 값 |
|------|---------|
| `minTokens` | 150 |
| `maxTokens` | 400 |
| `overlapTokens` | 50 |
| `KEYWORD_WEIGHT` | 0.2 |
| `SIMILARITY_THRESHOLD` | 기본 0.5 |
| fallback 결과 수 | 최대 2개 |

검증 명령:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

## 5. 남은 작업

### 정리 단계

- README 최신화
- 환경변수 문서 정리
- 임시 진단 파일 정리
- 사용하지 않는 캡처 이미지와 업로드 파일 정리
- PRD, TRD, ROADMAP 유지보수 기준 정리

### 실사용 검증

- 실제 브라우저에서 업로드 → 처리 → Q&A 플로우 재확인
- PDF, TXT, MD 각각 샘플 테스트
- 짧은 문서, 긴 문서, 구조화 문서 테스트
- OpenAI rate limit 및 timeout 상황 확인

### 배포 전 준비

- 로컬 파일 저장 전략 재검토
- Vercel 배포 시 파일 저장소 대안 검토
- 환경변수 세팅 가이드 작성
- 운영 로그 정책 정리
- rate limit 정책 검토
- 오류 추적 방식 검토

### 배포

- Vercel 프로젝트 설정
- Neon DB 연결 확인
- Prisma 배포 환경 확인
- OpenAI API 환경변수 설정
- 프로덕션 빌드 및 배포
- 프로덕션에서 실제 문서 업로드 테스트

## 6. Post-MVP 개선 후보

- 여러 문서 통합 검색
- 문서 목록/삭제 UI
- 문서 재처리 UI
- 질문/답변 히스토리 UI
- 고급 reranking
- 검색어 리라이팅 고도화
- 섹션/목차 기반 청크 메타데이터 정교화
- pgvector 기반 DB 레벨 벡터 검색
- 파일 저장소를 S3/R2 등 외부 스토리지로 이전
- 사용자 인증 및 문서 권한 관리

## 7. 현재 리스크

- 로컬 파일 저장 구조는 서버리스 배포와 맞지 않을 수 있다.
- fallback 답변은 관련성이 낮은 근거로 답변을 시도할 수 있다.
- 짧거나 구조가 약한 문서는 검색 유사도가 낮게 나올 수 있다.
- 기존 문서는 청킹 정책 변경이 자동 반영되지 않는다.
- 현재 자동 E2E는 mock 기반이며 실제 브라우저 자동화는 아직 없다.

## 8. 단계별 상태

| 단계 | 상태 |
|------|------|
| Phase 1. 기반 설정 | 완료 |
| Phase 2. 데이터 계층 | 완료 |
| Phase 3. 문서 업로드 | 완료 |
| Phase 4. 문서 처리 | 완료 |
| Phase 5. 검색 및 Q&A API | 완료 |
| Phase 6. UI | 완료 |
| Phase 7. 로컬 자동 검증 | 완료 |
| Phase 8. 문서/프로젝트 정리 | 진행 중 |
| Phase 9. 배포 준비 | 대기 |
| Phase 10. 프로덕션 배포 | 대기 |
