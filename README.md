# OMS Authentication Module

Login and session-management module for the Organization Management System. Built as a foundation other OMS modules (member management, finance, documents, announcements, attendance, events) will plug into.

## Stack

- **Frontend**: Next.js 16 (App Router, TypeScript, Tailwind CSS v4)
- **Backend**: Node.js + Express 5 (TypeScript)
- **Database**: PostgreSQL via Prisma
- **Auth**: Session-based, httpOnly cookies (see "Why sessions, not JWT" below)

## Project structure

```
backend/    Express API — auth logic, database, sessions
frontend/   Next.js app — login/reset UI, protected dashboard placeholder
```

## Setup

### 1. Database

You need a running PostgreSQL instance. Locally, the simplest option is Docker:

```bash
docker run --name oms-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=oms -p 5432:5432 -d postgres:16
```

### 2. Backend

```bash
cd backend
cp .env.example .env       # edit DATABASE_URL and SEED_ADMIN_* if needed
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed                # creates the first admin account from .env
npm run dev                 # http://localhost:4000
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env        # NEXT_PUBLIC_API_URL, defaults to http://localhost:4000
npm install
npm run dev                  # http://localhost:3000
```

Visit `http://localhost:3000` — you'll land on `/login`. Sign in with the `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from your backend `.env`.

## Environment variables

See `backend/.env.example` and `frontend/.env.example` for the full list, each with an inline comment explaining what it's for. Nothing needs a value beyond what's already documented there except `DATABASE_URL` and, if you want real password-reset emails, the `SMTP_*` vars — without them the reset link is logged to the backend console instead (clearly marked as a dev stub, not a silent no-op).

## Authentication flow

1. **Login**: credentials verified with Argon2id, a `Session` row created in Postgres, its id set as an httpOnly cookie (`SameSite=Lax`, `Secure` in production).
2. **Every request to a protected endpoint**: the backend looks up the session by cookie value and rejects if missing or expired. This is the actual security boundary.
3. **Frontend route guard** (`frontend/proxy.ts`, Next 16's renamed `middleware.ts`): checks only that the cookie *exists*, and redirects to `/login` if not — pure UX, not security, since it can't validate against the database at the edge.
4. **Protected pages** (e.g. `/dashboard`) independently call the backend's `/api/auth/me` server-side before rendering, so a forged or expired cookie is caught even if the edge check is bypassed.
5. **Logout**: deletes the `Session` row and clears the cookie.
6. **Forgot/reset password**: a random token is emailed (or logged, in dev); only its SHA-256 hash is stored. Reset invalidates the token and logs out every existing session for that user.

### Why sessions, not JWT

Revocation. If you kick a member, force a logout after a password reset, or add role-based permissions later, a JWT needs a denylist to enforce that — which just reimplements a session store, worse. DB-backed sessions revoke instantly by deleting a row, and never put anything beyond a random ID in the browser. The cost is a DB lookup per request, which is a non-issue at OMS scale and much easier for a student team to reason about than token expiry/refresh logic.

## Database schema

Three tables: `User`, `Session`, `PasswordResetToken`. See `backend/prisma/schema.prisma` for the full definitions and inline comments on the security reasoning (e.g. why `PasswordResetToken.tokenHash` and not the raw token).

`User.role` is an enum (`ADMIN` / `OFFICER` / `MEMBER`) already in place so role-based access control can be added to `requireAuth` later without a schema migration.

## Registration

No public `/register` endpoint, per project scope. The first admin account is created via `backend/prisma/seed.ts` from `SEED_ADMIN_*` env vars. Subsequent accounts are expected to come from a future member-management module's admin-only user-creation flow — `requireAuth` plus a role check is all that flow will need to reuse.

## Testing

```bash
cd backend
npm test              # 30 tests: password hashing, session/token logic, HTTP-level route behavior
npm run typecheck
```

```bash
cd frontend
npx tsc --noEmit
npx eslint .
npm run build          # full production build
```

Backend tests mock Prisma directly, so they don't require a running database — they test business logic (credential verification, session creation/expiry, token hashing/expiry/single-use, CSRF header enforcement, generic error messages) and HTTP behavior (status codes, cookie handling, response shape) in isolation. They do **not** cover a real Postgres round trip; run `npx prisma migrate dev` against a real database and exercise the endpoints with something like `curl` or Postman for that layer once your environment can reach Prisma's binary host and a database.

## Known limitations / next steps

- **No rate-limit persistence.** The login/forgot-password limiter is in-memory and resets on server restart. Fine for a single-instance student deployment; swap for a Redis-backed limiter (`rate-limiter-flexible`) before running multiple backend instances behind a load balancer.
- **No email verification on account creation.** Since accounts are admin-created, this wasn't in scope — add it if self-registration is introduced later.
- **CSRF protection is header-based, not token-based.** Sufficient given `SameSite=Lax` cookies and a custom header requirement, but if the frontend and backend end up on different eTLD+1 domains in production, revisit this (`SameSite=None` would need real CSRF tokens).
- **RBAC middleware doesn't exist yet** — only `requireAuth` (authenticated or not). The `role` field is in the schema so adding a `requireRole("ADMIN")` middleware is additive, not a rewrite.
- **No database-backed integration tests were run in this build environment** — see the Testing section above. Everything else (typecheck, lint, unit tests, production build) was actually executed and passed; this is the one layer that genuinely needs your own machine or CI.
