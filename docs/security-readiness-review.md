# Mike security and readiness review

Review date: 2026-05-26

Scope: whole-repository review of the synced `mrkairolee-crypto/mike` fork for legal-process use.

## Verification evidence

Commands run after syncing the fork with upstream:

```bash
npm install --prefix backend
npm install --prefix frontend
npm run build --prefix backend
npm run build --prefix frontend
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=dummy-anon-key \
SUPABASE_SECRET_KEY=dummy-service-key \
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001 \
  npm run build --prefix frontend
npm run lint --prefix frontend
npm audit --prefix backend --audit-level=moderate --json
npm audit --prefix frontend --audit-level=moderate --json
```

Observed results:

- Backend build: passed.
- Frontend build without env: failed because `supabaseUrl is required` during prerender.
- Frontend build with safe dummy public env: passed.
- Frontend lint: failed with 39 errors and 68 warnings.
- Backend npm audit: 11 vulnerabilities, including 3 high.
- Frontend npm audit: 12 vulnerabilities, including 1 high.
- Test scripts: none found for backend or frontend.

## P0 findings

### 1. Frontend env example included a backend service-role key

Evidence:

- `frontend/.env.local.example` previously included `SUPABASE_SECRET_KEY`.
- `docs/safe-local-testing.md` says service-role keys should stay backend-only.

Risk:

- For a legal-document SaaS, service-role key handling is critical. Even when unprefixed variables are not normally exposed to the browser by Next.js, teaching users to place service-role keys in frontend env files is a high-risk operational footgun.

Action taken in this branch:

- Removed `SUPABASE_SECRET_KEY` from `frontend/.env.local.example`.

Further fix:

- Add explicit backend startup validation for required server-only secrets.
- Keep all service-role/model-provider/storage secrets backend-only.

### 2. No automated tests for legal-critical flows

Evidence:

- `backend/package.json` has no `test` script.
- `frontend/package.json` has no `test` script.
- No `*.test.*`, `*.spec.*`, Jest, Vitest, or Playwright config was found.

Risk:

- Legal-process features require regression coverage for access control, document privacy, citations, generated DOCX validity, tabular extraction, and deletion/retention behavior.

Recommended first tests:

- `backend/src/lib/downloadTokens.ts`: sign/verify/tamper tests.
- `backend/src/lib/access.ts`: owner/shared/non-member matrix.
- Document routes: download, ZIP download, version access, delete access.
- Tabular routes: review access, document-id filtering, shared review access.
- Frontend smoke: login shell, upload page, tabular review page, citation viewer.

## P1 findings

### 3. Frontend build depends on env at prerender time

Evidence:

- `npm run build --prefix frontend` failed without `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`.
- `frontend/src/lib/supabase.ts` creates the Supabase client at module load.

Risk:

- CI and preview builds fail with opaque errors if env is missing.

Fix options:

- Document required build env clearly.
- Add a frontend env-validation module with explicit messages.
- Use safe dummy public values in CI build checks when no real Supabase project is needed.
- Avoid server prerender paths importing browser Supabase client if not needed.

### 4. Frontend lint currently fails

Evidence:

- `npm run lint --prefix frontend` failed with 39 errors and 68 warnings.
- Notable classes: React hooks/compiler rules, `any`, unescaped entities, unused vars, component creation during render, and a `DocView.tsx` function access-before-declaration issue.

Risk:

- Lint is not currently a reliable release gate.
- Some findings are correctness-related, not just style.

Recommended order:

1. Fix `react-hooks/immutability`, `react-hooks/static-components`, and refs issues.
2. Fix `react-hooks/set-state-in-effect` errors or consciously tune rules.
3. Remove `any` in legal-critical components.
4. Clean unused vars and unescaped entities.

### 5. Vulnerable dependencies

Evidence:

- Backend audit: 8 moderate, 3 high.
- Frontend audit: 11 moderate, 1 high.
- Notable packages/chains include `@xmldom/xmldom`, `fast-xml-builder`, `protobufjs`, `express`/`qs`, `@anthropic-ai/sdk`, `next`/`postcss`, `exceljs`/`uuid`, `wrangler`/`miniflare`.

Risk:

- Mike processes legal documents, including XML-heavy DOCX files and generated Excel outputs. XML/document-processing vulnerabilities deserve priority.

Recommended order:

1. Update XML/document-processing dependency chains.
2. Update backend HTTP stack vulnerabilities.
3. Update model SDKs.
4. Update frontend framework/build dependencies.
5. Re-run build/lint/audit after each group.

### 6. Download tokens are non-expiring

Evidence:

- `backend/src/lib/downloadTokens.ts` describes HMAC-signed, non-expiring download tokens.
- `backend/src/routes/downloads.ts` does re-check current document access before streaming, which is good.

Risk:

- Non-expiring links are operationally convenient but not ideal for privileged legal documents.

Recommended fix:

- Add expiry (`exp`) and purpose (`download`, `generated-doc`, etc.) to token payload.
- Add a token ID and optional DB revocation table.
- Keep current access re-check in `downloads.ts`.

### 7. Storage deletion semantics need legal-grade verification

Evidence:

- Single-document delete enumerates `document_versions` storage paths and deletes objects before deleting the DB row.
- Project delete only deletes the project DB row by owner; DB cascades likely remove child rows but may not remove object storage bytes.

Risk:

- Legal clients expect deletion/retention semantics to be explicit and verifiable. DB cascade without object cleanup can leave orphaned files in R2/S3.

Recommended fix:

- Before project delete, enumerate child document versions and delete `storage_path` / `pdf_storage_path` objects.
- Add orphan-storage detection script.
- Add tests proving delete flows remove storage objects.

## P2 findings

### 8. Workflow definitions are duplicated

Evidence:

- Frontend built-ins: `frontend/src/app/components/workflows/builtinWorkflows.ts`.
- Backend built-ins: `backend/src/lib/builtinWorkflows.ts`.

Risk:

- Legal templates can drift between UI and backend execution.

Recommended fix:

- Store built-ins in one canonical shared JSON/TS source.
- Add workflow version IDs so generated outputs can cite which template version was used.

### 9. Large route/tool files mix responsibilities

Evidence:

- `backend/src/lib/chatTools.ts` is very large and includes prompt policy, tool schemas, document reading/generation/editing, citations, workflow tools, and tabular tools.
- `backend/src/routes/tabular.ts` and `backend/src/routes/documents.ts` are large route modules.

Risk:

- High change-risk in legal-critical behavior.

Recommended fix:

- Extract service modules for document versions, document generation, tabular review, access checks, and workflow execution.
- Keep route handlers thin.

### 10. Audit trail is not yet legal-grade

Current state:

- Schema has timestamps and versioning, but no explicit audit-event table was found for legal actions.

Recommended audit events:

- upload
- view/download
- share/unshare
- delete
- workflow run
- tabular generation
- assistant-generated document
- accepted/rejected edit
- export
- model/provider used

## Pilot recommendation

Do not use real client-confidential or privileged documents until P0/P1 hardening is complete.

Safe pilot scope:

- Synthetic or public contracts only.
- One workspace flow: contract due diligence review.
- Verify upload, tabular review, citations, Excel export, generated summary/CP checklist, share, and delete cleanup.

## Immediate next hardening backlog

1. Add tests for `access.ts` and `downloadTokens.ts`.
2. Add expiring/revocable download tokens.
3. Fix project delete storage cleanup.
4. Add audit events for legal-critical actions.
5. Clean frontend lint errors enough to make lint a CI gate.
6. Add dependency update PRs for audit findings.
7. Unify workflow templates into one canonical source.
