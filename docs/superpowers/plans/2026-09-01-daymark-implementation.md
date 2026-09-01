# DAYMARK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-user daily work tracker that imports Jira issue metadata, stores tasks and daily work logs in Supabase, and summarizes completed and remaining work on a responsive dashboard.

**Architecture:** Nuxt provides the UI and server API in one application. Server routes validate input, isolate Jira credentials, and call small repository/service modules; Supabase PostgreSQL is the source of truth. Pure domain functions hold status, date, parsing, and dashboard rules so they can be unit-tested without Nuxt or a live database.

**Tech Stack:** Nuxt, Vue 3, TypeScript, Nuxt UI, Zod, Supabase PostgreSQL, Vitest, Nuxt Test Utils, Playwright, npm

---

## File map

| Area | Files | Responsibility |
|---|---|---|
| App foundation | `package.json`, `nuxt.config.ts`, `app/app.vue`, `app/assets/css/main.css`, `.env.example` | Runtime, modules, global shell, Daily Focus tokens |
| Domain | `shared/types/domain.ts`, `shared/schemas/task.ts`, `shared/utils/task-rules.ts`, `shared/utils/date.ts` | Types, validation, status transitions, Bangkok dates |
| Database | `supabase/migrations/202609010001_init_daymark.sql`, `server/utils/supabase.ts`, `server/repositories/tasks.ts` | Schema and persistence boundary |
| Jira | `server/utils/jira.ts`, `server/api/jira/lookup.post.ts` | Safe Jira URL parsing and metadata lookup |
| Task API | `server/services/tasks.ts`, `server/api/tasks/index.get.ts`, `server/api/tasks/index.post.ts`, `server/api/tasks/[id].get.ts`, `server/api/tasks/[id].patch.ts`, `server/api/tasks/[id].delete.ts`, `server/api/tasks/[id]/work-logs.post.ts` | CRUD, duplicate handling, status updates, work logs |
| Dashboard API | `server/services/dashboard.ts`, `server/api/dashboard.get.ts` | Counts, focused work, daily activity |
| UI | `app/layouts/default.vue`, `app/pages/index.vue`, `app/pages/tasks/index.vue`, `app/pages/tasks/[id].vue`, `app/components/**`, `app/composables/**` | Responsive workflows and states |
| Verification | `tests/unit/**`, `tests/integration/**`, `tests/e2e/daymark.spec.ts`, `playwright.config.ts`, `README.md` | Behavior, integration, E2E, setup |

### Task 1: Scaffold Nuxt and the test foundation

**Files:**
- Create: `package.json`
- Create: `nuxt.config.ts`
- Create: `app/app.vue`
- Create: `app/assets/css/main.css`
- Create: `.env.example`
- Create: `vitest.config.ts`
- Create: `tests/unit/smoke.test.ts`

- [ ] **Step 1: Scaffold the application and install runtime/test dependencies**

Run:

```powershell
npm create nuxt@latest . -- --force --packageManager npm --no-git
npm install @nuxt/ui @supabase/supabase-js zod
npm install -D vitest @vitest/coverage-v8 @nuxt/test-utils happy-dom @playwright/test
```

Expected: Nuxt files exist and npm completes without dependency errors.

- [ ] **Step 2: Add scripts and configuration**

Set these scripts in `package.json` while retaining the scaffolded dependency versions:

```json
{
  "scripts": {
    "build": "nuxt build",
    "dev": "nuxt dev",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "typecheck": "nuxt typecheck"
  }
}
```

Use this `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  devtools: { enabled: true },
  runtimeConfig: {
    supabaseUrl: '',
    supabaseServiceRoleKey: '',
    jiraBaseUrl: '',
    jiraEmail: '',
    jiraApiToken: '',
  },
  typescript: { typeCheck: true, strict: true },
})
```

Use this `vitest.config.ts`:

```ts
import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: { environment: 'happy-dom', coverage: { reporter: ['text', 'html'] } },
})
```

Use this `.env.example`:

```dotenv
NUXT_SUPABASE_URL=https://project-ref.supabase.co
NUXT_SUPABASE_SERVICE_ROLE_KEY=replace-with-server-only-key
NUXT_JIRA_BASE_URL=https://company.atlassian.net
NUXT_JIRA_EMAIL=developer@example.com
NUXT_JIRA_API_TOKEN=replace-with-jira-token
```

- [ ] **Step 3: Write and run the smoke test**

```ts
import { describe, expect, it } from 'vitest'

describe('DAYMARK test environment', () => {
  it('runs TypeScript tests', () => expect('todo'.toUpperCase()).toBe('TODO'))
})
```

Run: `npm test`

Expected: one passing test.

- [ ] **Step 4: Commit the foundation**

```powershell
git add package.json package-lock.json nuxt.config.ts vitest.config.ts app .env.example tests/unit/smoke.test.ts
git commit -m "chore: scaffold DAYMARK Nuxt application"
```

### Task 2: Define domain types, validation, and date/status rules

**Files:**
- Create: `shared/types/domain.ts`
- Create: `shared/schemas/task.ts`
- Create: `shared/utils/task-rules.ts`
- Create: `shared/utils/date.ts`
- Create: `tests/unit/task-rules.test.ts`
- Create: `tests/unit/date.test.ts`

- [ ] **Step 1: Write failing rule tests**

```ts
import { describe, expect, it } from 'vitest'
import { applyStatus, orderFocusedTasks } from '../../shared/utils/task-rules'

describe('task rules', () => {
  it('sets and clears completedAt during status transitions', () => {
    const now = '2026-09-01T08:00:00.000Z'
    expect(applyStatus('in_progress', 'done', now)).toEqual({ status: 'done', completedAt: now })
    expect(applyStatus('done', 'todo', now)).toEqual({ status: 'todo', completedAt: null })
  })

  it('orders in-progress work before todo work', () => {
    const tasks = [
      { id: 'a', status: 'todo', updatedAt: '2026-09-01T09:00:00Z' },
      { id: 'b', status: 'in_progress', updatedAt: '2026-09-01T08:00:00Z' },
    ] as const
    expect(orderFocusedTasks(tasks).map(task => task.id)).toEqual(['b', 'a'])
  })
})
```

```ts
import { describe, expect, it } from 'vitest'
import { bangkokDate } from '../../shared/utils/date'

describe('bangkokDate', () => {
  it('uses the Bangkok calendar day across UTC midnight', () => {
    expect(bangkokDate('2026-08-31T18:30:00.000Z')).toBe('2026-09-01')
  })
})
```

Run: `npm test -- tests/unit/task-rules.test.ts tests/unit/date.test.ts`

Expected: FAIL because the modules do not exist.

- [ ] **Step 2: Implement the types and pure rules**

Define `shared/types/domain.ts` with `TaskStatus = 'todo' | 'in_progress' | 'done'`, `Project`, `Task`, `WorkLog`, `TaskWithProject`, and `DashboardSummary`. Use camelCase at the service/UI boundary.

Implement `applyStatus` and `orderFocusedTasks` exactly as follows:

```ts
import type { TaskStatus } from '../types/domain'

export function applyStatus(previous: TaskStatus, next: TaskStatus, now: string) {
  return { status: next, completedAt: next === 'done' ? now : previous === 'done' ? null : undefined }
}

export function orderFocusedTasks<T extends { status: TaskStatus; updatedAt: string }>(tasks: readonly T[]) {
  const weight: Record<TaskStatus, number> = { in_progress: 0, todo: 1, done: 2 }
  return [...tasks].sort((a, b) => weight[a.status] - weight[b.status]
    || Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}
```

Implement `bangkokDate`:

```ts
export function bangkokDate(value: string | Date = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
```

In `shared/schemas/task.ts`, export Zod schemas for Jira lookup, task creation, task patching, and work-log creation. Enforce valid URL, summary length 1–300, status enum, note length 1–2,000, and optional integer minutes 1–1,440.

- [ ] **Step 3: Verify the rules**

Run: `npm test -- tests/unit/task-rules.test.ts tests/unit/date.test.ts`

Expected: all rule tests pass.

- [ ] **Step 4: Commit the domain layer**

```powershell
git add shared tests/unit/task-rules.test.ts tests/unit/date.test.ts
git commit -m "feat: add task domain rules and validation"
```

### Task 3: Create the database schema and repository boundary

**Files:**
- Create: `supabase/migrations/202609010001_init_daymark.sql`
- Create: `server/utils/supabase.ts`
- Create: `server/repositories/tasks.ts`
- Create: `tests/integration/repository-contract.test.ts`

- [ ] **Step 1: Write a repository contract test with a fake Supabase client**

The test must assert that `findTaskByJiraKey('ops-421')` queries uppercase `OPS-421`, and that `deleteTask(id)` calls the `tasks` table once. Inject the client into `createTaskRepository(client)` so the repository is testable without network access.

```ts
const client = { from: vi.fn(() => query) }
const repository = createTaskRepository(client as never)
await repository.findTaskByJiraKey('ops-421')
expect(query.eq).toHaveBeenCalledWith('jira_key', 'OPS-421')
```

Run: `npm test -- tests/integration/repository-contract.test.ts`

Expected: FAIL because the repository does not exist.

- [ ] **Step 2: Add the SQL migration**

Create enums/tables matching the approved spec. Include `citext`, UUID defaults, a unique case-insensitive project name, a unique uppercase `jira_key`, checks for text lengths and minutes, `ON DELETE CASCADE` for work logs, indexes on task status/project/update time and work-log task/date, plus an `updated_at` trigger for all three tables.

The migration must include these invariant checks:

```sql
create type task_status as enum ('todo', 'in_progress', 'done');

alter table tasks add constraint tasks_completion_consistent check (
  (status = 'done' and completed_at is not null)
  or (status <> 'done' and completed_at is null)
);

alter table work_logs add constraint work_logs_minutes_range check (
  minutes_spent is null or minutes_spent between 1 and 1440
);
```

- [ ] **Step 3: Implement server-only Supabase access and repository methods**

`server/utils/supabase.ts` must call `createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabaseServiceRoleKey, { auth: { persistSession: false } })` and throw a startup-safe configuration error when either value is absent.

`createTaskRepository(client)` must expose typed methods: `listTasks(filters)`, `findTaskById(id)`, `findTaskByJiraKey(key)`, `upsertProject(input)`, `createTask(input)`, `updateTask(id, patch)`, `deleteTask(id)`, `createWorkLog(taskId, input)`, and `listWorkLogs(taskId)`. Map snake_case database rows to camelCase domain objects in this file only.

- [ ] **Step 4: Run contract tests and commit**

Run: `npm test -- tests/integration/repository-contract.test.ts`

Expected: repository contract tests pass.

```powershell
git add supabase server/utils/supabase.ts server/repositories/tasks.ts tests/integration/repository-contract.test.ts
git commit -m "feat: add Supabase schema and task repository"
```

### Task 4: Implement safe Jira lookup

**Files:**
- Create: `server/utils/jira.ts`
- Create: `server/api/jira/lookup.post.ts`
- Create: `tests/unit/jira.test.ts`
- Create: `tests/integration/jira-lookup.test.ts`

- [ ] **Step 1: Write failing Jira parsing tests**

```ts
import { describe, expect, it } from 'vitest'
import { parseJiraIssueUrl } from '../../server/utils/jira'

describe('parseJiraIssueUrl', () => {
  it('extracts and normalizes a key from the configured Jira origin', () => {
    expect(parseJiraIssueUrl('https://acme.atlassian.net/browse/ops-421', 'https://acme.atlassian.net'))
      .toEqual({ jiraKey: 'OPS-421', jiraUrl: 'https://acme.atlassian.net/browse/OPS-421' })
  })

  it('rejects another origin', () => {
    expect(() => parseJiraIssueUrl('https://evil.example/browse/OPS-421', 'https://acme.atlassian.net'))
      .toThrow('JIRA_ORIGIN_MISMATCH')
  })
})
```

Run: `npm test -- tests/unit/jira.test.ts`

Expected: FAIL because the Jira utility does not exist.

- [ ] **Step 2: Implement Jira parsing and client normalization**

`parseJiraIssueUrl` must compare `URL.origin`, accept only `/browse/{KEY}`, validate the key with `/^[A-Z][A-Z0-9_]+-\d+$/`, and return the canonical URL. `createJiraClient(config, fetcher)` must use Basic auth, request `/rest/api/3/issue/{key}?fields=summary,project`, apply a 10-second abort timeout, and return only:

```ts
{
  jiraKey,
  jiraUrl,
  summary: response.fields.summary,
  project: {
    name: response.fields.project.name,
    jiraProjectKey: response.fields.project.key.toUpperCase(),
  },
}
```

Map configuration, validation, 401/403, 404, timeout, and upstream errors to stable codes without including upstream response bodies.

- [ ] **Step 3: Implement the server route and integration test**

The route must use `readValidatedBody(event, jiraLookupSchema.parse)`, runtime configuration, and `createError` with safe status/message mappings. The integration test must mock the Jira client and verify both a normalized 200 response and a non-blocking 422 response body `{ code, message }` for an invalid URL.

- [ ] **Step 4: Verify and commit Jira lookup**

Run: `npm test -- tests/unit/jira.test.ts tests/integration/jira-lookup.test.ts`

Expected: all Jira tests pass.

```powershell
git add server/utils/jira.ts server/api/jira/lookup.post.ts tests/unit/jira.test.ts tests/integration/jira-lookup.test.ts
git commit -m "feat: add secure Jira issue lookup"
```

### Task 5: Implement task, status, and work-log APIs

**Files:**
- Create: `server/services/tasks.ts`
- Create: `server/api/tasks/index.get.ts`
- Create: `server/api/tasks/index.post.ts`
- Create: `server/api/tasks/[id].get.ts`
- Create: `server/api/tasks/[id].patch.ts`
- Create: `server/api/tasks/[id].delete.ts`
- Create: `server/api/tasks/[id]/work-logs.post.ts`
- Create: `tests/integration/tasks-api.test.ts`

- [ ] **Step 1: Write failing service tests for the critical workflow**

Use an injected repository and fixed clock. Assert that creating a task uppercases the Jira key, reuses/creates the project, forces `todo`, returns `{ kind: 'duplicate', task }` for an existing Jira key, sets `completedAt` on Done, clears it when reopened, and creates a work log with the supplied Bangkok work date.

```ts
const service = createTaskService(repository, () => '2026-09-01T08:00:00.000Z')
const result = await service.changeStatus('task-1', 'done')
expect(repository.updateTask).toHaveBeenCalledWith('task-1', {
  status: 'done', completedAt: '2026-09-01T08:00:00.000Z',
})
```

Run: `npm test -- tests/integration/tasks-api.test.ts`

Expected: FAIL because the task service does not exist.

- [ ] **Step 2: Implement the task service**

Keep duplicate detection, project upsert, forced default status, transition timestamps, and work-log creation in `server/services/tasks.ts`. Return domain objects and typed service results; never return raw Supabase responses.

- [ ] **Step 3: Add thin validated API routes**

Implement the routes with these contracts:

```text
GET    /api/tasks?status=&projectId=&query=&date=
POST   /api/tasks                         -> 201 created, 409 duplicate with existing task
GET    /api/tasks/:id                     -> task plus workLogs
PATCH  /api/tasks/:id                     -> updated task
DELETE /api/tasks/:id                     -> 204
POST   /api/tasks/:id/work-logs           -> 201 work log
```

Use Zod schemas for body/query validation. Return 404 for missing tasks, 409 for duplicate Jira, 422 for validation, and 500 with a generic message for storage failures.

- [ ] **Step 4: Verify and commit task APIs**

Run: `npm test -- tests/integration/tasks-api.test.ts`

Expected: all task workflow tests pass.

```powershell
git add server/services/tasks.ts server/api/tasks tests/integration/tasks-api.test.ts
git commit -m "feat: add task and daily work log APIs"
```

### Task 6: Implement dashboard aggregation

**Files:**
- Create: `server/services/dashboard.ts`
- Create: `server/api/dashboard.get.ts`
- Create: `tests/unit/dashboard.test.ts`

- [ ] **Step 1: Write failing aggregation tests**

Construct fixtures covering all statuses, multiple projects, out-of-order updates, and work logs on both sides of Bangkok midnight. Assert exact counts, exclusion of Done from focused work, In progress before Todo, newest-first within a status, and activity selected by `workedOn === bangkokDate(now)`.

```ts
expect(summary.counts).toEqual({ todo: 2, inProgress: 1, done: 3 })
expect(summary.focusedTasks.map(task => task.status)).toEqual(['in_progress', 'todo', 'todo'])
expect(summary.todayActivity.every(log => log.workedOn === '2026-09-01')).toBe(true)
```

Run: `npm test -- tests/unit/dashboard.test.ts`

Expected: FAIL because the dashboard service does not exist.

- [ ] **Step 2: Implement aggregation and route filters**

`buildDashboardSummary(tasks, workLogs, today)` must return `{ counts, focusedTasks, todayActivity }`. The route accepts optional `projectId` and `date`, validates `date` as `YYYY-MM-DD`, loads matching data through the repository, and defaults the date with `bangkokDate()`.

- [ ] **Step 3: Verify and commit dashboard behavior**

Run: `npm test -- tests/unit/dashboard.test.ts`

Expected: all dashboard aggregation tests pass.

```powershell
git add server/services/dashboard.ts server/api/dashboard.get.ts tests/unit/dashboard.test.ts
git commit -m "feat: add dashboard summary service"
```

### Task 7: Build the Daily Focus shell and dashboard UI

**Files:**
- Modify: `app/app.vue`
- Modify: `app/assets/css/main.css`
- Create: `app/layouts/default.vue`
- Create: `app/pages/index.vue`
- Create: `app/components/dashboard/StatusCards.vue`
- Create: `app/components/dashboard/FocusList.vue`
- Create: `app/components/dashboard/TodayActivity.vue`
- Create: `app/components/shared/AppEmptyState.vue`
- Create: `app/components/shared/AppErrorState.vue`
- Create: `app/composables/useDashboard.ts`
- Create: `tests/unit/status-cards.nuxt.test.ts`

- [ ] **Step 1: Write a failing component test**

Mount `StatusCards` with `{ todo: 12, inProgress: 5, done: 28 }`; assert the three labels and values are visible, and that no color-only status information is used.

```ts
const wrapper = await mountSuspended(StatusCards, {
  props: { counts: { todo: 12, inProgress: 5, done: 28 } },
})
expect(wrapper.text()).toContain('Todo')
expect(wrapper.text()).toContain('In progress')
expect(wrapper.text()).toContain('Done')
```

Run: `npm test -- tests/unit/status-cards.nuxt.test.ts`

Expected: FAIL because the component does not exist.

- [ ] **Step 2: Implement the visual foundation**

Define CSS custom properties for warm canvas `#F4F0E7`, paper `#FFFCF6`, deep green `#183D32`, ink `#17211E`, orange `#E86135`, muted ink `#68736F`, focus ring, radii, spacing, and shadows. Use a Thai-capable display/body font loaded through CSS with a resilient sans-serif fallback. Add `prefers-reduced-motion` rules and visible `:focus-visible` outlines.

The default layout must provide a skip link, semantic header/nav, Dashboard and Tasks links, and an Add task button that remains reachable on mobile.

- [ ] **Step 3: Implement the dashboard states**

`useDashboard` wraps `useFetch('/api/dashboard')` and exposes pending, refresh, error, and data. The page renders a Thai date heading, `StatusCards`, `FocusList`, and `TodayActivity`. It must render skeletons while pending, retry on error, Add first task when empty, and Clear filters when filters remove all results.

- [ ] **Step 4: Verify responsive/accessibility behavior and commit**

Run:

```powershell
npm test -- tests/unit/status-cards.nuxt.test.ts
npm run typecheck
npm run build
```

Expected: test, typecheck, and production build all pass.

```powershell
git add app tests/unit/status-cards.nuxt.test.ts
git commit -m "feat: build Daily Focus dashboard"
```

### Task 8: Build Add task with Jira fallback

**Files:**
- Create: `app/components/tasks/AddTaskModal.vue`
- Create: `app/components/tasks/TaskFields.vue`
- Create: `app/composables/useTaskCreation.ts`
- Create: `tests/unit/add-task-modal.nuxt.test.ts`

- [ ] **Step 1: Write failing interaction tests**

Mock `$fetch`. Test a successful lookup that fills Jira key, summary, and project; a failed lookup that preserves the URL and reveals manual fields; a disabled submit during lookup; and successful creation that closes the modal and refreshes dashboard data.

```ts
await wrapper.get('[name="jiraUrl"]').setValue('https://acme.atlassian.net/browse/OPS-421')
await wrapper.get('[data-testid="jira-lookup"]').trigger('click')
await flushPromises()
expect(wrapper.get('[name="summary"]').element.value).toBe('Order status API')
```

Run: `npm test -- tests/unit/add-task-modal.nuxt.test.ts`

Expected: FAIL because the modal does not exist.

- [ ] **Step 2: Implement the two-stage form**

Stage one accepts the Jira URL and runs lookup. Stage two always shows editable Jira key, summary, and project after success or failure. Default status is displayed as Todo and is not editable during creation. Inline errors use `aria-describedby`; lookup progress uses `aria-live="polite"`; submit is guarded against repeated requests.

On a 409 response, show “งานนี้มีอยู่แล้ว” with a link to `/tasks/{existingTask.id}`. On success, emit `created`, close, clear the form, and refresh Nuxt data keys `dashboard` and `tasks`.

- [ ] **Step 3: Verify and commit Add task**

Run: `npm test -- tests/unit/add-task-modal.nuxt.test.ts`

Expected: all lookup and fallback tests pass.

```powershell
git add app/components/tasks app/composables/useTaskCreation.ts tests/unit/add-task-modal.nuxt.test.ts
git commit -m "feat: add Jira-assisted task creation"
```

### Task 9: Build task list, detail, status, and work-log workflows

**Files:**
- Create: `app/pages/tasks/index.vue`
- Create: `app/pages/tasks/[id].vue`
- Create: `app/components/tasks/TaskFilters.vue`
- Create: `app/components/tasks/TaskList.vue`
- Create: `app/components/tasks/StatusSelect.vue`
- Create: `app/components/tasks/WorkLogForm.vue`
- Create: `app/components/tasks/WorkLogTimeline.vue`
- Create: `tests/unit/task-detail.nuxt.test.ts`

- [ ] **Step 1: Write failing task-detail tests**

Test status movement to Done, `completedAt` display, reopening to In progress, adding a dated note with optional minutes, and deletion confirmation text that mentions associated work logs.

```ts
await wrapper.get('[name="status"]').setValue('done')
await flushPromises()
expect($fetch).toHaveBeenCalledWith('/api/tasks/task-1', expect.objectContaining({
  method: 'PATCH', body: { status: 'done' },
}))
```

Run: `npm test -- tests/unit/task-detail.nuxt.test.ts`

Expected: FAIL because the task-detail components do not exist.

- [ ] **Step 2: Implement task list and filters**

Synchronize status, project, query, and date filters to URL query parameters. Debounce text search by 250 ms, retain filters across navigation, show status text with every status color, and provide keyboard-accessible rows/cards.

- [ ] **Step 3: Implement task details and work-log timeline**

Show Jira metadata, status, timestamps, external Jira link, and newest-first logs. The WorkLog form defaults `workedOn` to `bangkokDate()`, requires a 1–2,000 character note, accepts optional minutes, preserves input on error, and resets only after success. Deletion uses an explicit confirmation dialog and redirects to `/tasks` after a 204 response.

- [ ] **Step 4: Verify and commit task workflows**

Run:

```powershell
npm test -- tests/unit/task-detail.nuxt.test.ts
npm run typecheck
```

Expected: component tests and typecheck pass.

```powershell
git add app/pages/tasks app/components/tasks tests/unit/task-detail.nuxt.test.ts
git commit -m "feat: add task management and daily logs"
```

### Task 10: Add end-to-end coverage, documentation, and final verification

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/daymark.spec.ts`
- Modify: `README.md`
- Modify: `.gitignore`

- [ ] **Step 1: Configure deterministic E2E data**

Configure Playwright to run `npm run dev -- --host 127.0.0.1`, use desktop Chromium plus a mobile viewport, and start each test from a clean test database or a documented Supabase test project. Route Jira requests in the browser test to deterministic success and failure fixtures.

- [ ] **Step 2: Write the primary E2E journeys**

Cover these complete journeys in `tests/e2e/daymark.spec.ts`:

```ts
test('imports Jira work and records daily progress', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'เพิ่มงาน' }).click()
  await page.getByLabel('Jira link').fill('https://acme.atlassian.net/browse/OPS-421')
  await page.getByRole('button', { name: 'ดึงข้อมูลจาก Jira' }).click()
  await expect(page.getByLabel('ชื่องาน')).toHaveValue('Order status API')
  await page.getByRole('button', { name: 'บันทึกงาน' }).click()
  await page.getByText('Order status API').click()
  await page.getByLabel('สถานะ').selectOption('in_progress')
  await page.getByLabel('วันนี้ทำอะไร').fill('เพิ่ม validation และส่ง PR แล้ว')
  await page.getByRole('button', { name: 'เพิ่มบันทึก' }).click()
  await expect(page.getByText('เพิ่ม validation และส่ง PR แล้ว')).toBeVisible()
})
```

Add a second journey for Jira failure/manual fallback, a third for duplicate Jira navigation, and a keyboard-only journey. Run the same primary journey at mobile viewport.

- [ ] **Step 3: Write the operator README**

Document prerequisites, install command, environment variables, Supabase migration application, local development, Jira token creation location, all test commands, build command, deployment privacy warning, and the no-auth MVP limitation. Do not include real credentials or production URLs.

- [ ] **Step 4: Run the complete quality gate**

Run:

```powershell
npm test
npm run typecheck
npm run build
npm run test:e2e
```

Expected: unit/integration tests, typecheck, production build, desktop E2E, and mobile E2E all pass.

- [ ] **Step 5: Confirm secret hygiene and commit**

Run:

```powershell
git grep -n -E "service_role|api_token|Authorization: Basic" -- ':!package-lock.json' ':!.env.example'
git status --short
```

Expected: no real secret values appear; only intentional implementation references are listed. The working tree contains only the planned verification/documentation changes.

```powershell
git add playwright.config.ts tests/e2e README.md .gitignore
git commit -m "test: verify DAYMARK workflows end to end"
```

## Final acceptance check

- [ ] Jira success and manual fallback both create Todo tasks.
- [ ] Duplicate Jira issues route to the existing task.
- [ ] Todo, In progress, and Done transitions preserve completion invariants.
- [ ] Multiple dated work logs appear correctly on task detail and today's dashboard.
- [ ] Dashboard counts, remaining work, project filters, and Bangkok dates match the design specification.
- [ ] Desktop, mobile, keyboard, loading, empty, validation, and retry states are verified.
- [ ] Jira and Supabase server secrets are absent from browser bundles and tracked files.
- [ ] `npm test`, `npm run typecheck`, `npm run build`, and `npm run test:e2e` all pass.

