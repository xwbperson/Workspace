# Workspace agent guide

## Product boundary

- This repository is a single-user personal workbench with one fixed `owner` account.
- Do not add registration, multi-user roles, tenants, plugin installation, or feature-level permissions.
- The system is a modular monolith: features ship together but keep their code and tests in feature slices.

## Required commands

Run from the repository root:

```powershell
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
```

For local development:

```powershell
npm run workspace:init
npm run db:migrate
npm run auth:init
npm run dev
```

## Adding a feature

1. Add the feature under `apps/web/src/features/<feature-id>` and `apps/api/src/features/<feature-id>`.
2. Export only the stable public surface from each feature's `index.ts`.
3. Append one entry to each fixed registration point:
   - `apps/web/src/app/feature-catalog.ts`
   - `apps/web/src/app/feature-routes.tsx`
   - `apps/api/src/app/feature-registry.ts`
4. Add a new migration; never edit a migration that has been released.
5. Add feature tests and registration-contract tests.

Do not rewrite the shell, feature grid, overview renderer, search aggregator, authentication platform, or another completed feature merely to add an ordinary feature. If a shared change is genuinely required, explain the multi-feature need and run the full regression suite.

## Security invariants

- Never commit passwords, session tokens, database credentials, backup keys, or real `.env` files.
- Store only password hashes and hashes of high-entropy session tokens.
- Session cookies are `HttpOnly`; authentication tokens never enter Web Storage.
- Every state-changing API request requires both a CSRF token and same-origin validation.
- Except for health, login, and CSRF bootstrap routes, every API route requires an authenticated session.
- Never log cookies, passwords, tokens, secrets, or complete request bodies.
- PWA caching is limited to versioned static assets; never cache authenticated API responses.

## Status language

- Generated or unexecuted work is `PREPARED`.
- Mark a check `VERIFIED` only after the relevant command or workflow actually passed.
- User acceptance is separate from implementation and automated verification.
