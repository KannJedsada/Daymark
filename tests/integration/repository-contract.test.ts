import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { createTaskRepository } from '../../server/repositories/tasks'

function createQuery(result: unknown = { data: null, error: null }) {
  const query = {
    delete: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    ilike: vi.fn(),
    insert: vi.fn(),
    lte: vi.fn(),
    maybeSingle: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    select: vi.fn(),
    single: vi.fn(),
    then: (resolveResult: (value: unknown) => unknown) => Promise.resolve(result).then(resolveResult),
    update: vi.fn(),
  }
  for (const method of ['delete', 'eq', 'gte', 'ilike', 'insert', 'lte', 'maybeSingle', 'order', 'range', 'select', 'single', 'update'] as const) {
    query[method].mockReturnValue(query)
  }
  return query
}

const projectRow = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Operations',
  jira_project_key: 'OPS',
  created_at: '2026-09-01T08:00:00.000Z',
  updated_at: '2026-09-01T08:00:00.000Z',
}

function taskRow(id = '00000000-0000-4000-8000-000000000002') {
  return {
    id,
    project_id: projectRow.id,
    jira_url: 'https://acme.atlassian.net/browse/OPS-421',
    jira_key: 'OPS-421',
    summary: 'Order status API',
    status: 'todo',
    created_at: '2026-09-01T08:00:00.000Z',
    updated_at: '2026-09-01T08:00:00.000Z',
    completed_at: null,
    project: projectRow,
  }
}

describe('Supabase task repository contract', () => {
  it('normalizes Jira keys and maps snake_case rows to domain objects', async () => {
    const query = createQuery({ data: taskRow(), error: null })
    const client = { from: vi.fn(() => query) }

    const task = await createTaskRepository(client as never).findTaskByJiraKey('ops-421')

    expect(query.eq).toHaveBeenCalledWith('jira_key', 'OPS-421')
    expect(task).toMatchObject({ jiraKey: 'OPS-421', projectId: projectRow.id, project: { jiraProjectKey: 'OPS' } })
    expect(task).not.toHaveProperty('jira_key')
  })

  it('writes work-log camelCase input as snake_case fields', async () => {
    const query = createQuery({
      data: {
        id: 'log-1', task_id: 'task-1', worked_on: '2026-09-01', note: 'Added validation', minutes_spent: 45,
        created_at: '2026-09-01T08:00:00.000Z', updated_at: '2026-09-01T08:00:00.000Z',
      },
      error: null,
    })
    const repository = createTaskRepository({ from: vi.fn(() => query) } as never)

    const log = await repository.createWorkLog('task-1', { workedOn: '2026-09-01', note: 'Added validation', minutesSpent: 45 })

    expect(query.insert).toHaveBeenCalledWith({ task_id: 'task-1', worked_on: '2026-09-01', note: 'Added validation', minutes_spent: 45 })
    expect(log).toMatchObject({ taskId: 'task-1', minutesSpent: 45 })
  })

  it('loads one day of activity with task and project context', async () => {
    const query = createQuery({
      data: [{
        id: 'log-1', task_id: taskRow().id, worked_on: '2026-09-01', note: 'Added validation', minutes_spent: 45,
        created_at: '2026-09-01T09:00:00.000Z', updated_at: '2026-09-01T09:00:00.000Z', task: taskRow(),
      }],
      error: null,
      count: 1,
    })
    const client = { from: vi.fn(() => query) }

    const logs = await createTaskRepository(client as never).listWorkLogsForDate({ workedOn: '2026-09-01', projectId: projectRow.id })

    expect(query.select).toHaveBeenCalledWith(expect.stringContaining('task:tasks!inner'), { count: 'exact' })
    expect(query.eq).toHaveBeenCalledWith('worked_on', '2026-09-01')
    expect(query.eq).toHaveBeenCalledWith('task.project_id', projectRow.id)
    expect(logs[0]).toMatchObject({ taskId: taskRow().id, task: { project: { name: 'Operations' } } })
  })

  it('applies inclusive date range and project filters for weekly reports', async () => {
    const query = createQuery({ data: [], error: null, count: 0 })
    const repository = createTaskRepository({ from: vi.fn(() => query) } as never)

    await repository.listWorkLogsForRange({ from: '2026-09-01', to: '2026-09-07', projectId: projectRow.id })

    expect(query.gte).toHaveBeenCalledWith('worked_on', '2026-09-01')
    expect(query.lte).toHaveBeenCalledWith('worked_on', '2026-09-07')
    expect(query.eq).toHaveBeenCalledWith('task.project_id', projectRow.id)
  })

  it('paginates dashboard tasks with a deterministic tie-breaker', async () => {
    const results = [
      { data: [taskRow('task-1')], error: null, count: 2 },
      { data: [taskRow('task-2')], error: null, count: 2 },
    ]
    const query = createQuery()
    query.then = resolveResult => Promise.resolve(results.shift()).then(resolveResult)
    const client = { from: vi.fn(() => query) }

    const tasks = await createTaskRepository(client as never).listDashboardTasks({ projectId: projectRow.id })

    expect(tasks.map(task => task.id)).toEqual(['task-1', 'task-2'])
    expect(query.range).toHaveBeenNthCalledWith(1, 0, 999)
    expect(query.range).toHaveBeenNthCalledWith(2, 1, 1000)
    expect(query.order).toHaveBeenCalledWith('id', { ascending: false })
  })

  it('reuses Jira projects by normalized key and updates their name', async () => {
    const find = createQuery({ data: projectRow, error: null })
    const update = createQuery({ data: { ...projectRow, name: 'Renamed Operations' }, error: null })
    const client = { from: vi.fn().mockReturnValueOnce(find).mockReturnValueOnce(update) }

    const project = await createTaskRepository(client as never).upsertProject({ name: 'Renamed Operations', jiraProjectKey: 'ops' })

    expect(find.eq).toHaveBeenCalledWith('jira_project_key', 'OPS')
    expect(update.update).toHaveBeenCalledWith({ name: 'Renamed Operations' })
    expect(project).toMatchObject({ name: 'Renamed Operations', jiraProjectKey: 'OPS' })
  })

  it('links an existing manual project to a Jira project key', async () => {
    const missingKey = createQuery({ data: null, error: null })
    const byName = createQuery({ data: { ...projectRow, jira_project_key: null }, error: null })
    const update = createQuery({ data: projectRow, error: null })
    const client = { from: vi.fn().mockReturnValueOnce(missingKey).mockReturnValueOnce(byName).mockReturnValueOnce(update) }

    const project = await createTaskRepository(client as never).upsertProject({ name: 'operations', jiraProjectKey: 'ops' })

    expect(byName.eq).toHaveBeenCalledWith('name', 'operations')
    expect(update.update).toHaveBeenCalledWith({ jira_project_key: 'OPS' })
    expect(project.jiraProjectKey).toBe('OPS')
  })

  it('recovers the project when a concurrent insert wins the unique-key race', async () => {
    const missingKey = createQuery({ data: null, error: null })
    const missingName = createQuery({ data: null, error: null })
    const conflict = createQuery({ data: null, error: { code: '23505' } })
    const concurrent = createQuery({ data: projectRow, error: null })
    const client = {
      from: vi.fn()
        .mockReturnValueOnce(missingKey)
        .mockReturnValueOnce(missingName)
        .mockReturnValueOnce(conflict)
        .mockReturnValueOnce(concurrent),
    }

    const project = await createTaskRepository(client as never).upsertProject({ name: 'Operations', jiraProjectKey: 'ops' })

    expect(conflict.insert).toHaveBeenCalledWith({ name: 'Operations', jira_project_key: 'OPS' })
    expect(concurrent.eq).toHaveBeenCalledWith('jira_project_key', 'OPS')
    expect(project).toMatchObject({ id: projectRow.id, jiraProjectKey: 'OPS' })
  })

  it('lists projects and finds them by id', async () => {
    const list = createQuery({ data: [projectRow], error: null })
    const find = createQuery({ data: projectRow, error: null })
    const client = { from: vi.fn().mockReturnValueOnce(list).mockReturnValueOnce(find) }
    const repository = createTaskRepository(client as never)

    await expect(repository.listProjects()).resolves.toEqual([expect.objectContaining({ name: 'Operations' })])
    await expect(repository.findProjectById(projectRow.id)).resolves.toMatchObject({ id: projectRow.id })
    expect(list.order).toHaveBeenCalledWith('name', { ascending: true })
  })

  it('deletes from the task table exactly once', async () => {
    const query = createQuery()
    const client = { from: vi.fn(() => query) }
    await createTaskRepository(client as never).deleteTask('task-1')
    expect(client.from).toHaveBeenCalledTimes(1)
    expect(query.delete).toHaveBeenCalledTimes(1)
    expect(query.eq).toHaveBeenCalledWith('id', 'task-1')
  })

  it('keeps the PostgreSQL migration invariants', () => {
    const migration = readFileSync(resolve('supabase/migrations/202609010001_init_daymark.sql'), 'utf8')
    expect(migration).toContain("create type task_status as enum ('todo', 'in_progress', 'done')")
    expect(migration).toContain('tasks_completion_consistent')
    expect(migration).toContain('work_logs_minutes_range')
    expect(migration).toContain('on delete cascade')
    expect(migration).toContain('alter table projects enable row level security')
    expect(migration).toContain('alter table tasks enable row level security')
    expect(migration).toContain('alter table work_logs enable row level security')
    expect(migration).toContain('revoke all on table tasks from anon, authenticated')
  })
})
