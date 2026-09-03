# Daymark

Daymark is a personal daily-work tracker for Jira-linked tasks. It keeps Todo, In progress, and Done work together, records dated progress notes, and summarizes what is finished and what remains on a Bangkok-local dashboard.

## Current scope

- Single user, with no application login
- Jira-assisted task creation with a manual fallback
- Project, status, text, and work-date filters
- Multiple daily work logs per task
- Dashboard and weekly report views
- Supabase PostgreSQL persistence across devices

## Prerequisites

- Node.js 22.19 or newer
- npm
- A Supabase project
- Optional: a Jira Cloud account and API token for automatic issue lookup

## Install

```powershell
git clone https://github.com/KannJedsada/Daymark.git
cd Daymark
npm install
Copy-Item .env.example .env
```

Fill in `.env` with server-only values:

```dotenv
NUXT_SUPABASE_URL=https://your-project.supabase.co
NUXT_SUPABASE_SERVICE_ROLE_KEY=replace-with-service-role-key
NUXT_JIRA_BASE_URL=https://company.atlassian.net
NUXT_JIRA_EMAIL=developer@example.com
NUXT_JIRA_API_TOKEN=replace-with-jira-token
```

The Supabase service-role key and Jira token must never be exposed through a `NUXT_PUBLIC_*` variable or committed to Git. Jira lookup is optional; when it is unavailable, Daymark keeps the entered URL and opens the manual fields.

## Prepare Supabase

Apply every SQL file in [the migrations directory](supabase/migrations) to the target Supabase project in filename order. You can use the Supabase SQL editor, or the Supabase CLI after linking the repository:

```powershell
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

The migration creates `projects`, `tasks`, and `work_logs`, their constraints and indexes, cascading work-log deletion, and automatic `updated_at` triggers.

## Configure Jira lookup

Create an API token from the security settings of the Atlassian account used in `NUXT_JIRA_EMAIL`. Set `NUXT_JIRA_BASE_URL` to the Jira origin only, for example `https://company.atlassian.net`. Daymark rejects Jira links from any other origin and never sends Jira credentials to the browser.

## Run locally

```powershell
npm run dev
```

Open the local URL printed by Nuxt. New tasks always start in Todo. Use a task's detail page to edit its metadata, change status, add progress logs, or delete it together with its logs.

## Quality checks

```powershell
npm test
npm run typecheck
npm run build
npm run test:e2e
```

The end-to-end suite starts Daymark in an isolated test mode with an in-memory repository and resets it before each test. This mode is only accepted outside production; normal development and deployment always use Supabase. If Playwright has not installed Chromium on the machine yet, run `npx playwright install chromium` once.

## Deployment and privacy warning

Build with `npm run build` and deploy the generated Nuxt server using the same private environment variables. Apply the migration before the first deployment and use a separate Supabase project for staging or automated integration tests.

Daymark's MVP has **no authentication or authorization**. Do not expose it publicly when it contains private work data. Put the deployment behind a trusted network, VPN, identity-aware proxy, or another hosting-level access boundary. Public deployment without an access boundary is unsupported.

## Repository

[github.com/KannJedsada/Daymark](https://github.com/KannJedsada/Daymark)
