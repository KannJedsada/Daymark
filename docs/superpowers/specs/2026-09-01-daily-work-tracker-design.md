# DAYMARK Daily Work Tracker — Design Specification

**Date:** 2026-09-01  
**Status:** Approved design  
**Audience:** Single user, no login in the MVP

## 1. Product goal

DAYMARK is a personal daily-work tracker that connects work items to Jira issues. It answers two questions from one dashboard:

1. What work has been done today?
2. What work remains?

The user can paste a Jira link, let the application fetch issue details when Jira is configured, and fall back to manual entry when Jira is unavailable. Every new task starts in `todo`. A task can accumulate dated work logs so one Jira issue can record progress across multiple days.

## 2. MVP scope

### Included

- A single-user application without authentication.
- Persistent PostgreSQL storage through Supabase.
- A dashboard with counts for Todo, In progress, and Done.
- A focused list of unfinished work.
- A same-day activity feed based on work logs.
- Task creation from a Jira link with automatic metadata lookup.
- Manual task entry and Jira lookup fallback.
- Task editing, status changes, deletion, search, and filtering.
- Multiple dated work logs under one task.
- Responsive desktop and mobile layouts.
- Bangkok-local date and time display.

### Excluded

- User accounts and authentication.
- Team views or shared ownership.
- Notifications and reminders.
- Attachments.
- Jira comment synchronization.
- Writing changes back to Jira.
- Time tracking reports beyond an optional estimate on each work log.

## 3. Technical approach

The application uses Nuxt for the user interface and server routes, with Supabase PostgreSQL for storage. Browser code never receives Jira credentials. A Nuxt server route performs Jira lookup and returns only normalized issue metadata.

The MVP is deployed as one Nuxt application connected to one Supabase project. It has no client-side-only storage dependency, so the same data is available from different devices that access the deployment.

## 4. Information architecture

### Dashboard

- Shows three status totals: Todo, In progress, and Done.
- Shows unfinished work, ordered with In progress first, then Todo. Within each status, the most recently updated task comes first.
- Shows today's activity, ordered newest first, using work logs whose local date is today in `Asia/Bangkok`.
- Supports project and date filters.
- Provides a prominent Add task action on desktop and mobile.

### Tasks

- Lists all tasks with search and filters for status, project, and date.
- Supports direct status changes.
- Links each row or card to task details.
- Keeps completed tasks searchable rather than hiding them globally.

### Task detail

- Displays Jira key, Jira link, summary, project, status, created date, updated date, and completed date when applicable.
- Shows a chronological work-log timeline.
- Allows editing task metadata, changing status, adding work logs, and deleting the task.

### Add task

- Accepts a Jira URL first.
- Attempts Jira lookup when the integration is configured.
- Populates Jira key, summary, and project after a successful lookup; all populated fields remain editable.
- Opens manual fields immediately after a lookup failure and explains the failure without blocking submission.
- Creates the task with `todo` status.

## 5. Visual direction

The selected direction is **Daily Focus**.

- Warm off-white background.
- Deep green as the dominant color.
- Orange as a focused accent for primary actions and status highlights.
- Friendly, highly legible Thai typography with generous spacing.
- Clear hierarchy that prioritizes today's focus over historical metrics.
- Subtle motion for page entry, status changes, and successful saves.
- No decorative imagery is required for the MVP; visual character comes from typography, shape, spacing, and color.

The interface must remain accessible with visible focus states, keyboard navigation, sufficient color contrast, semantic labels, reduced-motion support, and touch targets suitable for mobile use.

## 6. Data model

### `projects`

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | Text | Required and unique, case-insensitive |
| `jira_project_key` | Text | Optional, unique when present |
| `created_at` | Timestamptz | Defaults to current time |
| `updated_at` | Timestamptz | Updated automatically |

### `tasks`

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key |
| `project_id` | UUID | Required foreign key to `projects` |
| `jira_url` | Text | Required valid URL |
| `jira_key` | Text | Required, normalized uppercase, unique |
| `summary` | Text | Required, trimmed, 1–300 characters |
| `status` | Enum | `todo`, `in_progress`, or `done`; defaults to `todo` |
| `created_at` | Timestamptz | Defaults to current time |
| `updated_at` | Timestamptz | Updated automatically |
| `completed_at` | Timestamptz | Set when entering `done`, cleared when leaving `done` |

### `work_logs`

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key |
| `task_id` | UUID | Required foreign key; cascade delete |
| `worked_on` | Date | Required; interpreted as a Bangkok calendar date |
| `note` | Text | Required, trimmed, 1–2,000 characters |
| `minutes_spent` | Integer | Optional, 1–1,440 when present |
| `created_at` | Timestamptz | Defaults to current time |
| `updated_at` | Timestamptz | Updated automatically |

## 7. Core behavior

### Status transitions

- New tasks always start in `todo`, including tasks fetched from Jira.
- The user can move a task between all three statuses.
- Moving a task to `done` sets `completed_at` to the transition time.
- Moving a completed task back to `todo` or `in_progress` clears `completed_at`.

### Remaining work

Remaining work includes every task whose status is not `done`.

### Work completed today

Today's activity is determined from `work_logs.worked_on`, not task creation or update timestamps. This ensures progress on a long-running Jira issue appears on every day it receives a work log.

### Duplicate Jira issues

Only one task can exist for a normalized Jira key. When the user submits a duplicate, the application links to the existing task and does not create another record.

### Project creation

When Jira lookup returns a project not yet stored, the application creates the project before creating the task. During manual entry, the user can select an existing project or enter a new project name.

## 8. Jira integration

The server reads the following environment values:

- `JIRA_BASE_URL`
- `JIRA_EMAIL`
- `JIRA_API_TOKEN`

The lookup endpoint accepts a Jira issue URL, validates that its origin matches `JIRA_BASE_URL`, extracts the issue key, fetches the issue with Jira's REST API, and normalizes the response to:

```json
{
  "jiraKey": "OPS-421",
  "jiraUrl": "https://example.atlassian.net/browse/OPS-421",
  "summary": "Adjust API for order status",
  "project": {
    "name": "Commerce",
    "jiraProjectKey": "OPS"
  }
}
```

If Jira is not configured, the URL is invalid, the host does not match, access is denied, the issue is missing, or Jira times out, the server returns a safe error code and message. The client preserves the entered URL and switches to manual entry. Jira response bodies, credentials, and stack traces are never exposed to the browser.

## 9. Error and empty states

- A Jira lookup shows visible loading feedback and prevents duplicate submissions.
- Lookup failure is non-blocking and always offers manual entry.
- Form validation appears beside the relevant field and preserves other values.
- Database errors show a concise retry message without claiming the task was saved.
- An empty dashboard explains that no tasks exist and offers Add first task.
- An empty filter result offers Clear filters.
- Destructive deletion requires confirmation and explains that associated work logs will also be removed.

## 10. Security and privacy

- Jira credentials stay in server-only environment variables.
- Jira lookup rejects origins other than the configured Jira origin to reduce server-side request-forgery risk.
- Server routes validate all input independently of client validation.
- Supabase service credentials are never shipped to the browser.
- Because the MVP has no authentication, deployment access must be restricted at the hosting or network layer if the data is private. Public deployment without an access boundary is explicitly unsupported for this MVP.
- Logs omit credentials, authorization headers, and Jira response bodies.

## 11. Test strategy

### Unit tests

- Jira URL parsing, origin validation, and issue-key normalization.
- Status transition and `completed_at` behavior.
- Dashboard count and ordering logic.
- Bangkok-local date handling.
- Form validation and work-log validation.

### Integration tests

- Successful Jira lookup and normalized response.
- Jira lookup failures that enable manual entry.
- New task creation with default Todo status.
- Duplicate Jira detection.
- Project reuse and project creation.
- Work-log creation and same-day dashboard activity.
- Cascading deletion of work logs.

### End-to-end tests

- Create a task from Jira lookup, change it to In progress, add today's work log, and complete it.
- Create a task through the manual fallback path.
- Filter tasks by project and status on desktop and mobile viewports.
- Keyboard-complete the Add task form and navigate the dashboard.

## 12. Acceptance criteria

1. Pasting a valid configured Jira link can populate Jira key, summary, and project.
2. Jira lookup failure never prevents manual task creation.
3. Every created task begins in Todo.
4. A user can move tasks among Todo, In progress, and Done.
5. A task can have multiple work logs on different dates.
6. The dashboard accurately counts all three statuses.
7. Remaining work excludes Done tasks.
8. Today's activity is based on today's work logs in `Asia/Bangkok`.
9. Duplicate Jira keys do not create duplicate tasks.
10. Data persists in Supabase and is available across devices accessing the deployment.
11. The primary workflow works on desktop and mobile and is usable with a keyboard.
12. Jira credentials are not present in browser assets, requests, or responses.

