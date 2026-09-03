import { createError } from 'h3'
import { describe, expect, it, vi } from 'vitest'

import { createDeleteTaskHandler } from '../../server/api/tasks/[id].delete'
import { createGetTaskHandler } from '../../server/api/tasks/[id].get'
import { createPatchTaskHandler } from '../../server/api/tasks/[id].patch'
import { createWorkLogHandler } from '../../server/api/tasks/[id]/work-logs.post'
import { createListTasksHandler } from '../../server/api/tasks/index.get'
import { createCreateTaskHandler } from '../../server/api/tasks/index.post'
import { createTaskService, TaskServiceError } from '../../server/services/tasks'
import { TaskRepositoryError } from '../../server/repositories/tasks'

const TASK_ID = '00000000-0000-4000-8000-000000000001'
const NOW = '2026-09-01T08:00:00.000Z'

const project = {
  id: 'project-1',
  name: 'Operations',
  jiraProjectKey: 'OPS',
  createdAt: NOW,
  updatedAt: NOW,
}

function task(overrides: Record<string, unknown> = {}) {
  return {
    id: TASK_ID,
    projectId: project.id,
    jiraUrl: 'https://acme.atlassian.net/browse/OPS-421',
    jiraKey: 'OPS-421',
    summary: 'Order status API',
    status: 'todo' as const,
    createdAt: NOW,
    updatedAt: NOW,
    completedAt: null,
    project,
    ...overrides,
  }
}

function repository(overrides: Record<string, unknown> = {}) {
  return {
    listTasks: vi.fn(async () => []),
    findTaskById: vi.fn(async () => task()),
    findTaskByJiraKey: vi.fn(async () => null),
    upsertProject: vi.fn(async () => project),
    createTask: vi.fn(async () => task()),
    updateTask: vi.fn(async () => task()),
    deleteTask: vi.fn(async () => undefined),
    createWorkLog: vi.fn(async () => ({
      id: 'log-1', taskId: TASK_ID, workedOn: '2026-09-01', note: 'Added validation',
      minutesSpent: 45, createdAt: NOW, updatedAt: NOW,
    })),
    listWorkLogs: vi.fn(async () => []),
    listProjects: vi.fn(async () => [project]),
    findProjectById: vi.fn(async () => project),
    ...overrides,
  }
}

describe('task service workflow', () => {
  it('normalizes Jira/project keys, reuses the project, and forces the default todo state', async () => {
    const repo = repository()
    const service = createTaskService(repo as never, () => NOW)

    const result = await service.createTask({
      jiraUrl: 'https://acme.atlassian.net/browse/ops-421',
      jiraKey: 'ops-421',
      summary: 'Order status API',
      project: { name: 'Operations', jiraProjectKey: 'ops' },
    })

    expect(result).toEqual({ kind: 'created', task: task() })
    expect(repo.findTaskByJiraKey).toHaveBeenCalledWith('OPS-421')
    expect(repo.upsertProject).toHaveBeenCalledWith({ name: 'Operations', jiraProjectKey: 'OPS' })
    expect(repo.createTask).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1', jiraKey: 'OPS-421', status: 'todo', completedAt: null,
    }))
  })

  it('uses an existing project when projectId is provided', async () => {
    const repo = repository()
    const service = createTaskService(repo as never, () => NOW)

    await service.createTask({
      jiraUrl: 'https://acme.atlassian.net/browse/OPS-422',
      jiraKey: 'OPS-422',
      summary: 'Another task',
      projectId: project.id,
    })

    expect(repo.findProjectById).toHaveBeenCalledWith(project.id)
    expect(repo.upsertProject).not.toHaveBeenCalled()
    expect(repo.createTask).toHaveBeenCalledWith(expect.objectContaining({
      projectId: project.id,
      jiraKey: 'OPS-422',
    }))
  })

  it('returns a discriminated duplicate result without creating a project or task', async () => {
    const existing = task()
    const repo = repository({ findTaskByJiraKey: vi.fn(async () => existing) })
    const service = createTaskService(repo as never, () => NOW)

    await expect(service.createTask({
      jiraUrl: existing.jiraUrl,
      jiraKey: 'ops-421',
      summary: existing.summary,
      project: { name: 'Operations' },
    })).resolves.toEqual({ kind: 'duplicate', task: existing })
    expect(repo.upsertProject).not.toHaveBeenCalled()
    expect(repo.createTask).not.toHaveBeenCalled()
  })

  it('turns a concurrent unique-constraint insert into the same duplicate result', async () => {
    const existing = task()
    const findTaskByJiraKey = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing)
    const repo = repository({
      findTaskByJiraKey,
      createTask: vi.fn(async () => { throw new TaskRepositoryError('23505') }),
    })
    const service = createTaskService(repo as never, () => NOW)

    await expect(service.createTask({
      jiraUrl: existing.jiraUrl,
      jiraKey: 'ops-421',
      summary: existing.summary,
      project: { name: 'Operations' },
    })).resolves.toEqual({ kind: 'duplicate', task: existing })
    expect(findTaskByJiraKey).toHaveBeenNthCalledWith(2, 'OPS-421')
  })

  it('sets completion once, clears it when reopened, and preserves it on idempotent Done', async () => {
    const repo = repository()
    const service = createTaskService(repo as never, () => NOW)

    await service.changeStatus(TASK_ID, 'done')
    expect(repo.updateTask).toHaveBeenLastCalledWith(TASK_ID, { status: 'done', completedAt: NOW })

    repo.findTaskById.mockResolvedValue(task({ status: 'done', completedAt: NOW }) as never)
    await service.changeStatus(TASK_ID, 'done')
    expect(repo.updateTask).toHaveBeenLastCalledWith(TASK_ID, { status: 'done' })

    await service.changeStatus(TASK_ID, 'todo')
    expect(repo.updateTask).toHaveBeenLastCalledWith(TASK_ID, { status: 'todo', completedAt: null })
  })

  it('turns a duplicate Jira key during edit into a stable service error with the existing task', async () => {
    const duplicate = task({ id: '00000000-0000-4000-8000-000000000099', jiraKey: 'OPS-999' })
    const findTaskByJiraKey = vi.fn(async () => duplicate)
    const repo = repository({
      findTaskByJiraKey,
      updateTask: vi.fn(async () => { throw new TaskRepositoryError('23505') }),
    })
    const service = createTaskService(repo as never, () => NOW)

    await expect(service.updateTask(TASK_ID, { jiraKey: 'ops-999' })).rejects.toMatchObject({
      code: 'DUPLICATE_JIRA',
      task: duplicate,
    })
    expect(findTaskByJiraKey).toHaveBeenCalledWith('OPS-999')
  })

  it('requires the task and creates a work log with the supplied Bangkok work date', async () => {
    const repo = repository()
    const service = createTaskService(repo as never, () => NOW)

    await service.createWorkLog(TASK_ID, {
      workedOn: '2026-09-01', note: 'Added validation', minutesSpent: 45,
    })

    expect(repo.findTaskById).toHaveBeenCalledWith(TASK_ID)
    expect(repo.createWorkLog).toHaveBeenCalledWith(TASK_ID, {
      workedOn: '2026-09-01', note: 'Added validation', minutesSpent: 45,
    })
  })
})

describe('task route contracts', () => {
  it('validates list filters and returns tasks', async () => {
    const listTasks = vi.fn(async () => [task()])
    const handler = createListTasksHandler({
      service: () => ({ listTasks } as never),
      query: () => ({ status: 'todo', date: '2026-09-01' }),
    })
    await expect(handler({} as never)).resolves.toEqual([task()])
    expect(listTasks).toHaveBeenCalledWith({ status: 'todo', date: '2026-09-01' })
  })

  it('returns 201 for creation and 409 with the existing task for duplicate Jira', async () => {
    const setStatus = vi.fn()
    const created = createCreateTaskHandler({
      service: () => ({ createTask: vi.fn(async () => ({ kind: 'created', task: task() })) } as never),
      readBody: vi.fn(async (_event, validate) => validate({
        jiraUrl: task().jiraUrl, jiraKey: 'OPS-421', summary: 'Order status API',
        project: { name: 'Operations' },
      })),
      setStatus,
    })
    await expect(created({} as never)).resolves.toEqual(task())
    expect(setStatus).toHaveBeenCalledWith({}, 201)

    const duplicate = createCreateTaskHandler({
      service: () => ({ createTask: vi.fn(async () => ({ kind: 'duplicate', task: task() })) } as never),
      readBody: vi.fn(async (_event, validate) => validate({
        jiraUrl: task().jiraUrl, jiraKey: 'OPS-421', summary: 'Order status API',
        project: { name: 'Operations' },
      })),
      setStatus: vi.fn(),
    })
    await expect(duplicate({} as never)).rejects.toMatchObject({
      statusCode: 409,
      data: { code: 'DUPLICATE_JIRA', task: task() },
    })
  })

  it('maps validation, missing task, and storage failures to 422, 404, and generic 500', async () => {
    const invalid = createCreateTaskHandler({
      service: vi.fn(),
      readBody: vi.fn(async (_event, validate) => validate({ jiraUrl: 'not-a-url' })),
      setStatus: vi.fn(),
    })
    await expect(invalid({} as never)).rejects.toMatchObject({
      statusCode: 422, data: { code: 'VALIDATION_ERROR', message: 'The request is invalid.' },
    })

    const missing = createGetTaskHandler({
      service: () => ({ getTask: vi.fn(async () => { throw new TaskServiceError('TASK_NOT_FOUND') }) } as never),
      id: () => TASK_ID,
    })
    await expect(missing({} as never)).rejects.toMatchObject({
      statusCode: 404, data: { code: 'TASK_NOT_FOUND', message: 'Task not found.' },
    })

    const failed = createGetTaskHandler({
      service: () => ({ getTask: vi.fn(async () => { throw new Error('database secret') }) } as never),
      id: () => TASK_ID,
    })
    await expect(failed({} as never)).rejects.toMatchObject({
      statusCode: 500, data: { code: 'STORAGE_ERROR', message: 'Unable to complete the request.' },
    })
  })

  it('validates patches and work logs, and emits 201/204 success statuses', async () => {
    const patch = createPatchTaskHandler({
      service: () => ({ updateTask: vi.fn(async () => task({ status: 'done', completedAt: NOW })) } as never),
      id: () => TASK_ID,
      readBody: vi.fn(async (_event, validate) => validate({ status: 'done' })),
    })
    await expect(patch({} as never)).resolves.toMatchObject({ status: 'done', completedAt: NOW })

    const deleteStatus = vi.fn()
    const remove = createDeleteTaskHandler({
      service: () => ({ deleteTask: vi.fn(async () => undefined) } as never),
      id: () => TASK_ID,
      setStatus: deleteStatus,
    })
    await expect(remove({} as never)).resolves.toBeNull()
    expect(deleteStatus).toHaveBeenCalledWith({}, 204)

    const logStatus = vi.fn()
    const createLog = createWorkLogHandler({
      service: () => ({ createWorkLog: vi.fn(async (_id, body) => ({ id: 'log-1', taskId: TASK_ID, ...body })) } as never),
      id: () => TASK_ID,
      readBody: vi.fn(async (_event, validate) => validate({
        workedOn: '2026-09-01', note: 'Added validation', minutesSpent: 45,
      })),
      setStatus: logStatus,
    })
    await expect(createLog({} as never)).resolves.toMatchObject({ workedOn: '2026-09-01', minutesSpent: 45 })
    expect(logStatus).toHaveBeenCalledWith({}, 201)

    const invalidLog = createWorkLogHandler({
      service: vi.fn(), id: () => TASK_ID,
      readBody: vi.fn(async (_event, validate) => validate({
        workedOn: '2026-09-01', note: '', minutesSpent: 1_441,
      })),
      setStatus: vi.fn(),
    })
    await expect(invalidLog({} as never)).rejects.toMatchObject({ statusCode: 422 })
  })

  it('maps H3 body validation wrappers to 422', async () => {
    const handler = createCreateTaskHandler({
      service: vi.fn(),
      readBody: vi.fn(async () => { throw createError({ statusCode: 400, message: 'validator details' }) }),
      setStatus: vi.fn(),
    })
    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 422, data: { code: 'VALIDATION_ERROR' },
    })
  })

  it('maps a duplicate Jira key during edit to 409 with the existing task', async () => {
    const duplicate = task({ id: '00000000-0000-4000-8000-000000000099', jiraKey: 'OPS-999' })
    const handler = createPatchTaskHandler({
      service: () => ({
        updateTask: vi.fn(async () => { throw new TaskServiceError('DUPLICATE_JIRA', duplicate) }),
      } as never),
      id: () => TASK_ID,
      readBody: vi.fn(async (_event, validate) => validate({ jiraKey: 'OPS-999' })),
    })

    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 409,
      data: { code: 'DUPLICATE_JIRA', task: duplicate },
    })
  })
})
