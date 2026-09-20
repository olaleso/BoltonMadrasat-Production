# BNMC Madrasah Management System

A local-first Version 1 management application for the Bolton Nigerian Muslim Community Madrasah, designed and delivered by NuraSpecs.

## What works

- Secure database-backed login and logout
- Administrator, teacher, finance, safeguarding and parent roles
- Public admission form with transactional student/guardian/application creation
- Students, guardians, applications, classes and enrolment data model
- Attendance registers and safe-collection fields
- Qur'an, Tajweed, Arabic and Islamic Studies progress records
- Fees, discounts, payments and parent-specific balances
- Announcements, staff compliance, dashboards, reports and audit logging
- Parent-specific filtering for learning progress, fees and dashboard information
- Responsive public site, admission form, login and management portal

## Requirements

- Node.js 24
- Docker Desktop with Docker Compose
- Git (recommended)

On Windows, Docker Desktop can use the WSL 2 backend. The application commands work in PowerShell, Command Prompt, Git Bash or WSL.

## First local setup

1. Extract the source and open a terminal in the project folder.
2. Create the local environment file:

   **PowerShell**

   ```powershell
   Copy-Item .env.example .env.local
   ```

   **Git Bash, WSL, macOS or Linux**

   ```bash
   cp .env.example .env.local
   ```

3. Install packages:

   ```bash
   npm install
   ```

4. Start PostgreSQL:

   ```bash
   docker compose up -d
   ```

5. Wait until it is healthy:

   ```bash
   docker compose ps
   ```

6. Create the database schema and demonstration records:

   ```bash
   npm run local:setup
   ```

7. Start the application:

   ```bash
   npm run dev
   ```

8. Open [http://localhost:3000](http://localhost:3000).

## Local accounts

All seeded accounts use the password `Madrasah2026!`.

| Role          | Email                               |
| ------------- | ----------------------------------- |
| Administrator | `admin@boltonmadrasat.local`        |
| Teacher       | `teacher@boltonmadrasat.local`      |
| Finance       | `finance@boltonmadrasat.local`      |
| Safeguarding  | `safeguarding@boltonmadrasat.local` |
| Parent        | `parent@boltonmadrasat.local`       |

These credentials are for local testing only and must not be used in production.

## Useful addresses

- Public website: `http://localhost:3000`
- Admission form: `http://localhost:3000/apply`
- Login: `http://localhost:3000/login`
- Portal: `http://localhost:3000/portal`
- Backend health: `http://localhost:3000/api/v1/health`

## Validation commands

```bash
npm test
npm run build
```

The automated tests execute all PostgreSQL migrations against an embedded PostgreSQL-compatible test engine and verify request/session helpers. The production build performs full TypeScript and route compilation.

## Database commands

```bash
npm run db:generate   # generate a migration after schema changes
npm run db:migrate    # apply pending migrations
npm run db:seed       # insert/update demonstration records
npm run db:studio     # open Drizzle Studio
```

To stop PostgreSQL without deleting its data:

```bash
docker compose stop
```

To start it again:

```bash
docker compose start
```

Do not use `docker compose down -v` unless you deliberately want to delete the local database volume.

## Cloudflare

Cloudflare deployment is intentionally deferred. The local application should first pass user-acceptance testing. The later deployment phase will add a managed PostgreSQL provider, Cloudflare Hyperdrive, production secrets, secure production accounts and deployment-specific build configuration without changing the application data model.
