# BNMC Madrasah Management System

Production management platform for **Bolton Nigerian Muslim Community (BNMC) Madrasah**, designed and maintained by **NuraSpecs**.

The system supports admissions, students, guardians, attendance, learning records, fees and payments, parent access, communications, reporting, media, staff workflows, and operational administration from a single portal.

## Production

- **Website:** https://bnmcmadrasah.org.uk
- **Production repository:** https://github.com/olaleso/BoltonMadrasat-Production
- **Stable recovery tag:** `production-stable-2026-09-20`

The production application is deployed to **Cloudflare Workers** and uses **Cloudflare D1** for relational data and **Cloudflare R2** for media storage.

## Current Architecture

### Application

- Next.js 16
- React 19
- TypeScript
- Vinext
- Vite
- Cloudflare Workers
- Wrangler

### Data and storage

- Cloudflare D1
- Drizzle ORM
- Cloudflare R2

### Payments

- Stripe
- GoCardless
- Manual payment recording and reconciliation

### Email and communications

- Resend-compatible email delivery
- In-app communication records
- Failed-email recovery and retry workflow
- Parent and guardian notifications

## Main Features

### Public website

- Responsive BNMC Madrasah website
- Public admissions journey
- Media gallery and homepage carousel
- Admission-related public information

### Admissions

- Online application form
- Admissions desk
- Admission review workflow
- Admission letters
- Student and guardian creation
- Class/category assignment
- Parent access setup

### Student management

- Student profiles
- Guardian linking
- Re-use of an existing guardian for siblings
- Manual registration
- Bulk student import
- Class categories
- Student timeline
- Student deletion workflow with linked operational data handling

### Parent and guardian access

- Parent portal
- Password setup and password recovery
- Parent profile
- Linked children
- Student-specific learning, fee and communication views

### Attendance and learning

- Attendance register
- Student attendance history
- Teacher-facing student access
- Learning and progress records

### Fees and payments

- Fee rules
- Student fee agreements
- Monthly invoices
- Outstanding balances
- Manual payments
- Stripe payment flows
- GoCardless direct debit flows
- Fee reconciliation
- Payment status reporting
- Parent-facing fees and payment view

### Communications

- Communication Centre
- Announcements and direct messages
- Parent/guardian messaging
- Email delivery tracking
- Failed-email retry tools

### Administration and operations

- Admin overview
- Admin attention queue
- Global search
- Automation Centre
- Portal settings
- System health
- Reports
- Audit logging
- Multi-role permissions

### Media

- Media Gallery
- R2-backed media storage
- Public gallery/carousel endpoints

## Repository Structure

```text
app/
  api/                  Application and integration API routes
  apply/                Public application workflow
  portal/               Authenticated portal
  gallery/              Public gallery
  login/                Login
  forgot-password/      Password recovery request
  reset-password/       Password reset

components/
  home/                 Public-site components
  portal/               Portal components

db/                     Database access, schema and seed helpers
lib/                    Shared backend, permissions, email and payment helpers
migrations/             D1 schema migrations
public/                 Public assets and import templates
scripts/                Cloudflare/Vinext build helpers
```

## Requirements

Use a recent Node.js 22+ release compatible with the project `package.json`.

You will also need:

- npm
- Git
- Wrangler / Cloudflare access for deployment
- Access to the correct Cloudflare D1 database and R2 bucket for production operations

## Install

```powershell
git clone https://github.com/olaleso/BoltonMadrasat-Production.git
cd BoltonMadrasat-Production
npm install
```

## Environment Configuration

Do not commit production secrets.

Use `.env.example` as a reference for local environment configuration. Local secret values should be kept in ignored environment files such as `.env.local` or `.dev.vars`, depending on the workflow being used.

Cloudflare production secrets should be configured through Cloudflare/Wrangler rather than stored in Git.

## Local Development

Standard Next.js development:

```powershell
npm run dev
```

Vinext development:

```powershell
npm run dev:vinext
```

## TypeScript Validation

Run a full active-source type check with:

```powershell
npx tsc --noEmit --pretty false --incremental false
```

This repository intentionally excludes backup, patch, diagnostic and historical source copies from TypeScript validation.

## Cloudflare Build

For the production Cloudflare target, use:

```powershell
npm run build:cloudflare
```

This performs the Vinext build and then applies the project-specific generated Wrangler configuration fixes.

Do not use plain `npm run build` as the final Cloudflare production build validation. The standard Next.js build runs in a Node-oriented environment and may not resolve Cloudflare virtual modules such as `cloudflare:workers` during page-data collection.

## Cloudflare Deployment

The normal production deployment command is:

```powershell
npm run deploy:cloudflare
```

Equivalent manual deployment after a successful Cloudflare build:

```powershell
npx wrangler deploy --config ".\dist\server\wrangler.json"
```

The generated deployment configuration under `dist/server` is build output and should not be edited as the primary source configuration.

## Cloudflare Resources

The current production deployment uses:

- **D1 database:** `bolton-madrasat`
- **R2 bucket:** `bnmc-media`
- **Worker:** `bolton-madrasat`

Resource identifiers, account IDs, tokens and secrets should not be documented in this README or committed to source control.

## Database Migrations

Schema changes must be represented by migration files under:

```text
migrations/
```

Before applying a production migration:

1. Review the migration SQL.
2. Take or confirm an appropriate production backup/recovery point.
3. Verify the target D1 database.
4. Apply the migration using the configured Wrangler project.
5. Validate the affected workflow immediately after migration.

Example production migration command:

```powershell
npx wrangler d1 migrations apply bolton-madrasat --remote --config ".\wrangler.jsonc"
```

Do not run migrations simply because application code was deployed. Only run them when the release contains a migration that has not already been applied.

## Production Verification

After deployment, validate at minimum:

- Login and logout
- Admin portal
- Student profiles
- Guardian links
- Admissions
- Attendance
- Fees & Payments
- Payment status/report generation
- Communications
- Parent portal
- Password recovery
- Media Gallery
- Automation Centre
- Fee reconciliation
- Failed-email recovery
- Portal settings

For production Worker logs:

```powershell
npx wrangler tail --config ".\dist\server\wrangler.json"
```

## Security Notes

- Never commit `.dev.vars`, `.env.local`, API keys, payment secrets, webhook secrets or production credentials.
- Keep the GitHub repository private unless all production-sensitive assets and implementation details have been reviewed for public release.
- Do not place real user data, database exports or diagnostic snapshots in source control.
- Review public assets carefully before making the repository public.
- Rotate credentials immediately if a secret is accidentally committed.

## Import Templates

Production import templates are stored under:

```text
public/templates/
```

Current templates include student and guardian/bulk-import workflows used by the portal.

## Recovery and Release Reference

A known-good production recovery point is tagged:

```text
production-stable-2026-09-20
```

To inspect it:

```powershell
git show production-stable-2026-09-20
```

To create a temporary recovery branch from it:

```powershell
git switch -c recovery/production-stable-2026-09-20 production-stable-2026-09-20
```

Avoid resetting the active production branch to an older tag without first reviewing database/schema compatibility.

## Git Workflow

Before starting a new change:

```powershell
git status
git pull
```

After implementation and validation:

```powershell
npx tsc --noEmit --pretty false --incremental false
npm run build:cloudflare
git status
```

Stage only intended source files. Avoid using `git add .` when local diagnostic, backup or data files are present.

Then commit and push:

```powershell
git add <intended-files>
git commit -m "Describe the change"
git push
```

## Ownership

Developed for **Bolton Nigerian Muslim Community Madrasah** by **NuraSpecs**.

This repository contains production application code and should be handled as an operational system, not as a demonstration project.
