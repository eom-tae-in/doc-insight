# Ops Execution Checklist

`ops` and `diagnostics` scripts can modify data or depend on external services.
Run this checklist before execution.

## 1) Environment preflight

- Confirm target environment (`local`, `staging`, `prod`) before running.
- Verify `.env` contains:
  - `DATABASE_URL`
  - `OPENAI_API_KEY` (required for embedding/LLM scripts)
- For API diagnostics (`diag:e2e`, `diag:process-status`, `diag:no-answer`), start app server:
  - `npm run dev` (default `http://localhost:3000`)

## 2) Database safety checks

- Confirm database host in `DATABASE_URL` is intended target.
- If running `ops:*` on shared DB, create backup/snapshot first.
- Ensure migration state is up to date (`npx prisma migrate status` when needed).

## 3) Script scope checks

- `diag:*`: read-heavy, but some scripts can create temporary records.
- `ops:*`: write operations expected (re-embedding/chunk overwrite).
- `ops:update-chunks` is destructive to chunk content for selected records.

## 4) Execution

- Diagnostics:
  - `npm run diag:e2e`
  - `npm run diag:search`
  - `npm run diag:search:v2`
  - `npm run diag:no-answer`
  - `npm run diag:process-status`
  - `npm run diag:prompt`
- Ops:
  - `npm run ops:regen-embeddings`
  - `npm run ops:regen-all-embeddings`
  - `npm run ops:update-chunks`

## 5) Failure handling

- `P1001` (DB unreachable): check network, DB host allowlist, and `DATABASE_URL`.
- `429`/`504`: re-run with reduced batch size or delayed retries.
- Abort immediately if script targets wrong DB.
