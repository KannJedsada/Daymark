import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createTaskRepository } from '../../server/repositories/tasks'

function createQuery(result: unknown = { data: null, error: null }) {
  const query = {
    delete: vi.fn(),
    eq: vi.fn(),
    insert: vi.fn(),
    maybeSingle: vi.fn(),
    select: vi.fn(),
    single: vi.fn(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
    update: vi.fn(),
    upsert: vi.fn(),
  }

  for (const method of ['delete', 'eq', 'insert', 'maybeSingle', 'select', 'single', 'update', 'upsert'] as const) {
    query[method].mockReturnValue(query)
  }

  return query
}

describe('task repository contract', () => {
  it('normalizes Jira keys and maps database rows to domain objects', async () => {
    const query = createQuery({
      data: {
        id: 'task-1',
        project_id: 'project-1',
        jira_url: 'https://acme.atlassian.net/browse/OPS-421',
        jira_key: 'OPS-421',
        summary: 'Order status API',
        status: 'todo',
        created_at: '2026-09-01T08:00:00.000Z',
        updated_at: '2026-09-01T08:00:00.000Z',
        completed_at: null,
        project: {
          id: 'project-1',
          name: 'Operations',
          jira_project_key: 'OPS',
          created_at: '2026-09-01T08:00:00.000Z',
          updated_at: '2026-09-01T08:00:00.000Z',
        },
      },
      error: null,
    })
    const client = { from: vi.fn(() => query) }
    const repository = createTaskRepository(client as never)

    const task = await repository.findTaskByJiraKey('ops-421')

    expect(client.from).toHaveBeenCalledWith('tasks')
    expect(query.eq).toHaveBeenCalledWith('jira_key', 'OPS-421')
    expect(task).toMatchObject({
      jiraKey: 'OPS-421',
      projectId: 'project-1',
      project: { jiraProjectKey: 'OPS' },
    })
    expect(task).not.toHaveProperty('jira_key')
  })

  it('deletes from the tasks table exactly once', async () => {
    const query = createQuery()
    const client = { from: vi.fn(() => query) }
    const repository = createTaskRepository(client as never)

    await repository.deleteTask('task-1')

    expect(client.from).toHaveBeenCalledTimes(1)
    expect(client.from).toHaveBeenCalledWith('tasks')
    expect(query.delete).toHaveBeenCalledTimes(1)
    expect(query.eq).toHaveBeenCalledWith('id', 'task-1')
  })

  it('writes camelCase inputs as snake_case database fields', async () => {
    const query = createQuery({
      data: {
        id: 'log-1',
        task_id: 'task-1',
        worked_on: '2026-09-01',
        note: 'Added validation',
        minutes_spent: 45,
        created_at: '2026-09-01T08:00:00.000Z',
        updated_at: '2026-09-01T08:00:00.000Z',
      },
      error: null,
    })
    const client = { from: vi.fn(() => query) }
    const repository = createTaskRepository(client as never)

    const log = await repository.createWorkLog('task-1', {
      workedOn: '2026-09-01',
      note: 'Added validation',
      minutesSpent: 45,
    })

    expect(query.insert).toHaveBeenCalledWith({
      task_id: 'task-1',
      worked_on: '2026-09-01',
      note: 'Added validation',
      minutes_spent: 45,
    })
    expect(log).toMatchObject({ taskId: 'task-1', minutesSpent: 45 })
  })

  it('keeps the migration invariants in the schema', () => {
    const migrationPath = resolve('supabase/migrations/202609010001_init_daymark.sql')
    const migration = readFileSync(migrationPath, 'utf8')

    expect(migration).toContain("create type task_status as enum ('todo', 'in_progress', 'done')")
    expect(migration).toContain('tasks_completion_consistent')
    expect(migration).toContain('work_logs_minutes_range')
    expect(migration).toContain('on delete cascade')
  })
})
