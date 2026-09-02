import { describe, expect, it, vi } from 'vitest'

import { createDashboardHandler } from '../../server/api/dashboard.get'
import { createDashboardService, buildDashboardSummary } from '../../server/services/dashboard'
import type { DashboardActivity, TaskWithProject } from '../../shared/types/domain'

const PROJECT_ID = '00000000-0000-4000-8000-000000000001'
const OTHER_PROJECT_ID = '00000000-0000-4000-8000-000000000002'

const projects = {
  primary: {
    id: PROJECT_ID,
    name: 'Operations',
    jiraProjectKey: 'OPS',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
  other: {
    id: OTHER_PROJECT_ID,
    name: 'Platform',
    jiraProjectKey: 'PLAT',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
}

function task(
  id: string,
  status: TaskWithProject['status'],
  updatedAt: string,
  project = projects.primary,
): TaskWithProject {
  return {
    id,
    projectId: project.id,
    jiraUrl: `https://acme.atlassian.net/browse/${id.toUpperCase()}`,
    jiraKey: id.toUpperCase(),
    summary: `Task ${id}`,
    status,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt,
    completedAt: status === 'done' ? updatedAt : null,
    project,
  }
}

function activity(
  id: string,
  taskContext: TaskWithProject,
  workedOn: string,
  createdAt: string,
): DashboardActivity {
  return {
    id,
    taskId: taskContext.id,
    workedOn,
    note: `Log ${id}`,
    minutesSpent: null,
    createdAt,
    updatedAt: createdAt,
    task: taskContext,
  }
}

describe('buildDashboardSummary', () => {
  it('counts every status and orders only unfinished tasks by status then newest update', () => {
    const tasks = [
      task('todo-old', 'todo', '2026-09-01T01:00:00.000Z'),
      task('done-old', 'done', '2026-08-30T01:00:00.000Z'),
      task('progress-old', 'in_progress', '2026-09-01T02:00:00.000Z'),
      task('done-new', 'done', '2026-09-01T07:00:00.000Z'),
      task('todo-new', 'todo', '2026-09-01T06:00:00.000Z'),
      task('done-middle', 'done', '2026-09-01T04:00:00.000Z', projects.other),
    ]

    const summary = buildDashboardSummary(tasks, [], '2026-09-01')

    expect(summary.counts).toEqual({ todo: 2, inProgress: 1, done: 3 })
    expect(summary.focusedTasks.map(item => item.id)).toEqual([
      'progress-old',
      'todo-new',
      'todo-old',
    ])
    expect(summary.focusedTasks.every(item => item.status !== 'done')).toBe(true)
  })

  it('selects activity by Bangkok work date and orders the newest entries first', () => {
    const currentTask = task('ops-421', 'in_progress', '2026-09-01T07:00:00.000Z')
    const logs = [
      activity('after-midnight-old', currentTask, '2026-09-01', '2026-08-31T17:05:00.000Z'),
      activity('previous-day', currentTask, '2026-08-31', '2026-08-31T16:59:59.000Z'),
      activity('after-midnight-new', currentTask, '2026-09-01', '2026-09-01T08:00:00.000Z'),
      activity('next-day', currentTask, '2026-09-02', '2026-09-01T17:00:00.000Z'),
    ]

    const summary = buildDashboardSummary([currentTask], logs, '2026-09-01')

    expect(summary.todayActivity.map(log => log.id)).toEqual([
      'after-midnight-new',
      'after-midnight-old',
    ])
    expect(summary.todayActivity.every(log => log.workedOn === '2026-09-01')).toBe(true)
    expect(summary.todayActivity[0]?.task.project.name).toBe('Operations')
  })
})

describe('dashboard service', () => {
  it('uses the Bangkok date and performs one task query plus one contextual work-log query', async () => {
    const listDashboardTasks = vi.fn(async () => [task('ops-421', 'todo', '2026-09-01T08:00:00.000Z')])
    const listWorkLogsForDate = vi.fn(async () => [])
    const service = createDashboardService(
      { listDashboardTasks, listWorkLogsForDate } as never,
      () => new Date('2026-08-31T18:30:00.000Z'),
    )

    await service.getSummary({ projectId: PROJECT_ID })

    expect(listDashboardTasks).toHaveBeenCalledOnce()
    expect(listDashboardTasks).toHaveBeenCalledWith({ projectId: PROJECT_ID })
    expect(listWorkLogsForDate).toHaveBeenCalledOnce()
    expect(listWorkLogsForDate).toHaveBeenCalledWith({
      workedOn: '2026-09-01',
      projectId: PROJECT_ID,
    })
  })
})

describe('dashboard route contract', () => {
  it('validates optional filters and forwards them to the service', async () => {
    const getSummary = vi.fn(async () => ({
      counts: { todo: 0, inProgress: 0, done: 0 },
      focusedTasks: [],
      todayActivity: [],
    }))
    const handler = createDashboardHandler({
      service: () => ({ getSummary } as never),
      query: () => ({ projectId: PROJECT_ID, date: '2026-09-01' }),
    })

    await expect(handler({} as never)).resolves.toMatchObject({ counts: { todo: 0 } })
    expect(getSummary).toHaveBeenCalledWith({ projectId: PROJECT_ID, date: '2026-09-01' })
  })

  it.each([
    { date: '2026-9-1' },
    { date: '2026-02-30' },
    { projectId: 'not-a-uuid' },
  ])('returns a safe 422 response for invalid filters: %j', async (query) => {
    const handler = createDashboardHandler({
      service: vi.fn(),
      query: () => query,
    })

    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 422,
      data: { code: 'VALIDATION_ERROR', message: 'The request is invalid.' },
    })
  })
})
