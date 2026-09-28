# OMS: Authentication and Member Management

Login/session module plus member management for the Organization Management System. Other OMS modules (finance, documents, announcements, attendance, events) will plug into this foundation.

## Stack

- **Frontend**: Next.js 16 (App Router, TypeScript, Tailwind CSS v4)
- **Backend**: Node.js + Express 5 (TypeScript)
- **Database**: PostgreSQL via Prisma
- **Auth**: Session-based, httpOnly cookies (see "Why sessions, not JWT" below)

## Project structure

```
backend/    Express API: auth, members, database, sessions
frontend/   Next.js app: login/reset UI, dashboard, member management UI
```

## Setup

### 1. Database

```bash
docker run --name oms-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=oms -p 5432:5432 -d postgres:16
```

### 2. Backend

```bash
cd backend
cp .env.example .env       # edit DATABASE_URL and SEED_ADMIN_* if needed
npm install
npx prisma generate
npx prisma migrate dev     # applies init + add_member_management migrations
npm run seed                # creates the first admin account from .env
npm run dev                 # http://localhost:4000
```

Upgrading from Phase 1: just run `npx prisma migrate dev`. Existing users get `status = ACTIVE`.

### 3. Frontend

```bash
cd frontend
cp .env.example .env        # NEXT_PUBLIC_API_URL, defaults to http://localhost:4000
npm install
npm run dev                  # http://localhost:3000
```

Sign in with the `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from your backend `.env`.

## Authentication flow

1. **Login**: credentials verified with Argon2id, a `Session` row created, its id set as an httpOnly cookie (`SameSite=Lax`, `Secure` in production). Inactive accounts are rejected after the password check (403), so account status is never revealed to someone who does not know the password.
2. **Protected endpoints**: `requireAuth` looks up the session by cookie and rejects if missing, expired, or belonging to an inactive user. This is the security boundary.
3. **Frontend route guard** (`frontend/proxy.ts`): only checks the cookie exists (UX, not security). Guards `/dashboard` and `/members`.
4. **Protected pages** call `/api/auth/me` server-side before rendering. Member pages also redirect plain `MEMBER` users to `/dashboard`.
5. **Logout**: deletes the `Session` row and clears the cookie.
6. **Forgot/reset password**: random token emailed (or logged in dev); only its SHA-256 hash is stored. Reset revokes all sessions for that user.

### Why sessions, not JWT

Revocation. Deactivating a member, forcing logout after a password reset, or role changes all take effect instantly by deleting rows. A JWT would need a denylist, which is a session store with extra steps.

## Member management

### Architecture

`routes/member.routes.ts` -> `controllers/member.controller.ts` -> `services/member.service.ts` -> Prisma. Validation lives in `validators/member.validators.ts` (zod). `requireRole(...)` in `auth.middleware.ts` is the reusable role guard. The `User` model remains the single identity model.

Creating a member does not use an admin-chosen password. A random, never-revealed password is stored, then the existing password-reset token mechanism issues a "set your password" link (`sendMemberInviteEmail`). Without SMTP configured, the link is logged to the backend console.

### API

All endpoints require an authenticated ADMIN or OFFICER. State-changing requests also need the `X-Requested-With: oms-frontend` header.

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/api/members` | ADMIN, OFFICER | Query: `search`, `role`, `status`, `page`, `pageSize` (max 100) |
| GET | `/api/members/:id` | ADMIN, OFFICER | 404 if not found |
| POST | `/api/members` | ADMIN, OFFICER | Body: `fullName`, `email`, `role`. 409 on duplicate email |
| PATCH | `/api/members/:id` | ADMIN, OFFICER | Partial: `fullName`, `email`, `role` |
| PATCH | `/api/members/:id/status` | ADMIN only | Body: `status` (`ACTIVE`/`INACTIVE`) |

Responses never include password hashes, session ids, or reset tokens. There is no DELETE endpoint.

### Permissions

| Action | ADMIN | OFFICER | MEMBER |
|---|---|---|---|
| View list / details | yes | yes | no |
| Create member | any role | MEMBER/OFFICER only | no |
| Edit name/email | yes | yes, except ADMIN accounts | no |
| Change role | yes (not own) | MEMBER<->OFFICER only, never ADMIN accounts, never own | no |
| Deactivate/reactivate | yes (not self) | no | no |

Assumptions: officers may create and edit non-admin accounts; deactivation is admin-only; nobody can change their own role or deactivate themselves (prevents escalation and lockout).

### Database changes

Migration `20260928010000_add_member_management`: adds enum `AccountStatus` (`ACTIVE`, `INACTIVE`), `User.status` (default `ACTIVE`), and indexes on `User.status` and `User.role`. Deactivation sets `INACTIVE` and deletes all of the user's sessions in one transaction.

## Testing

```bash
cd backend
npm test              # 66 tests
```

```bash
cd frontend
npx tsc --noEmit      # only error is LayoutProps, a global that `next build` generates
npx eslint .
npm run build
```

Backend tests mock Prisma (and the Prisma error class in `member.service.test.ts`), so they need no database or generated client. They do not cover a real Postgres round trip, including the `insensitive` search, the unique-email constraint, and the deactivation transaction. Verify those against a real database.

## Known limitations

- **Untested against a real database.** See above.
- **In-memory rate limiter** (login/forgot-password) resets on restart; swap for Redis before running multiple instances.
- **Email delivery is a console stub** until `nodemailer` is wired into `email.service.ts` (reset and invite emails).
- **Invite links are not resendable** from the UI. An admin can ask the member to use "Forgot password".
- **Last-admin protection is not implemented.** An admin can demote another admin, so a team could end up with no admins. Add a check when this matters.
- **Duplicated fetch helper** in `lib/api/members.ts` and `lib/api/auth.ts`; consolidate later.
- **CSRF protection is header-based**; revisit if frontend and backend end up on different eTLD+1 domains.
- **Only `requireAuth` and `requireRole` exist** for authorization; no permission framework by design.
