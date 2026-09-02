import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { createTaskRepository } from '../../server/repositories/tasks'
import { createDatabase } from '../../server/utils/database'

function createRepository() {
  const db = createDatabase(':memory:')
  return { db, repository: createTaskRepository(db) }
}

describe('task repository contract', () => {
  afterEach(() => {
    // in-memory databases are discarded with each test instance
  })

  it('normalizes Jira keys and maps database rows to domain objects', async () => {
    const { repository } = createRepository()
    const project = await repository.upsertProject({ name: 'Operations', jiraProjectKey: 'OPS' })
    await repository.createTask({
      projectId: project.id,
      jiraUrl: 'https://acme.atlassian.net/browse/OPS-421',
      jiraKey: 'ops-421',
      summary: 'Order status API',
      status: 'todo',
      completedAt: null,
    })

    const task = await repository.findTaskByJiraKey('ops-421')

    expect(task).toMatchObject({
      jiraKey: 'OPS-421',
      projectId: project.id,
      project: { jiraProjectKey: 'OPS' },
    })
    expect(task).not.toHaveProperty('jira_key')
  })

  it('deletes from the tasks table exactly once', async () => {
    const { repository } = createRepository()
    const project = await repository.upsertProject({ name: 'Operations' })
    const created = await repository.createTask({
      projectId: project.id,
      jiraUrl: 'https://acme.atlassian.net/browse/OPS-1',
      jiraKey: 'OPS-1',
      summary: 'Task one',
      status: 'todo',
      completedAt: null,
    })

    await repository.deleteTask(created.id)

    expect(await repository.findTaskById(created.id)).toBeNull()
  })

  it('writes camelCase inputs as snake_case database fields', async () => {
    const { repository } = createRepository()
    const project = await repository.upsertProject({ name: 'Operations' })
    const task = await repository.createTask({
      projectId: project.id,
      jiraUrl: 'https://acme.atlassian.net/browse/OPS-421',
      jiraKey: 'OPS-421',
      summary: 'Order status API',
      status: 'todo',
      completedAt: null,
    })

    const log = await repository.createWorkLog(task.id, {
      workedOn: '2026-09-01',
      note: 'Added validation',
      minutesSpent: 45,
    })

    expect(log).toMatchObject({ taskId: task.id, minutesSpent: 45 })
  })

  it('loads one day of work logs with task and project context in one query', async () => {
    const { repository } = createRepository()
    const project = await repository.upsertProject({ name: 'Operations', jiraProjectKey: 'OPS' })
    const task = await repository.createTask({
      projectId: project.id,
      jiraUrl: 'https://acme.atlassian.net/browse/OPS-421',
      jiraKey: 'OPS-421',
      summary: 'Order status API',
      status: 'in_progress',
      completedAt: null,
    })
    await repository.createWorkLog(task.id, {
      workedOn: '2026-09-01',
      note: 'Added validation',
      minutesSpent: 45,
    })

    const logs = await repository.listWorkLogsForDate({
      workedOn: '2026-09-01',
      projectId: project.id,
    })

    expect(logs).toEqual([expect.objectContaining({
      taskId: task.id,
      minutesSpent: 45,
      task: expect.objectContaining({
        jiraKey: 'OPS-421',
        project: expect.objectContaining({ name: 'Operations', jiraProjectKey: 'OPS' }),
      }),
    })])
    expect(logs[0]).not.toHaveProperty('task_id')
  })

  it('paginates dashboard tasks deterministically when capped rows share timestamps', async () => {
    const { repository } = createRepository()
    const project = await repository.upsertProject({ name: 'Operations', jiraProjectKey: 'OPS' })

    await repository.createTask({
      projectId: project.id,
      jiraUrl: 'https://acme.atlassian.net/browse/OPS-1',
      jiraKey: 'OPS-1',
      summary: 'OPS-1',
      status: 'todo',
      completedAt: null,
    })
    await repository.createTask({
      projectId: project.id,
      jiraUrl: 'https://acme.atlassian.net/browse/OPS-2',
      jiraKey: 'OPS-2',
      summary: 'OPS-2',
      status: 'todo',
      completedAt: null,
    })

    const tasks = await repository.listDashboardTasks({ projectId: project.id })

    expect(tasks.map(item => item.jiraKey).sort()).toEqual(['OPS-1', 'OPS-2'])
  })

  it('reuses Jira projects by normalized Jira project key', async () => {
    const { repository } = createRepository()
    await repository.upsertProject({ name: 'Operations', jiraProjectKey: 'OPS' })
    const renamed = await repository.upsertProject({ name: 'Renamed Operations', jiraProjectKey: 'ops' })

    expect(renamed).toMatchObject({
      name: 'Renamed Operations',
      jiraProjectKey: 'OPS',
    })
  })

  it('reuses manual projects by case-insensitive name', async () => {
    const { repository } = createRepository()
    const first = await repository.upsertProject({ name: 'Operations' })
    const second = await repository.upsertProject({ name: 'operations' })

    expect(second.id).toBe(first.id)
    expect(second.jiraProjectKey).toBeNull()
  })

  it('keeps the migration invariants in the schema', () => {
    const migrationPath = resolve('database/init.sql')
    const migration = readFileSync(migrationPath, 'utf8')

    expect(migration).toContain('CHECK (status IN (\'todo\', \'in_progress\', \'done\'))')
    expect(migration).toContain('completed_at IS NULL')
    expect(migration).toContain('minutes_spent IS NULL OR minutes_spent BETWEEN 1 AND 1440')
    expect(migration).toContain('ON DELETE CASCADE')
  })
})
