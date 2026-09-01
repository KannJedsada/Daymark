import { describe, expect, it } from 'vitest'

import { createTaskSchema, createWorkLogSchema, jiraLookupSchema, patchTaskSchema } from '../../shared/schemas/task'
import { applyStatus, orderFocusedTasks } from '../../shared/utils/task-rules'

describe('task rules', () => {
  it('sets and clears completedAt during status transitions', () => {
    const now = '2026-09-01T08:00:00.000Z'

    expect(applyStatus('in_progress', 'done', now)).toEqual({ status: 'done', completedAt: now })
    expect(applyStatus('done', 'todo', now)).toEqual({ status: 'todo', completedAt: null })
  })

  it('leaves completedAt unchanged for transitions between unfinished statuses', () => {
    expect(applyStatus('todo', 'in_progress', '2026-09-01T08:00:00.000Z')).toEqual({
      status: 'in_progress',
      completedAt: undefined,
    })
  })

  it('orders in-progress work before todo work and newest updates first', () => {
    const tasks = [
      { id: 'a', status: 'todo', updatedAt: '2026-09-01T09:00:00Z' },
      { id: 'b', status: 'in_progress', updatedAt: '2026-09-01T08:00:00Z' },
      { id: 'c', status: 'in_progress', updatedAt: '2026-09-01T10:00:00Z' },
    ] as const

    expect(orderFocusedTasks(tasks).map(task => task.id)).toEqual(['c', 'b', 'a'])
    expect(tasks.map(task => task.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('task schemas', () => {
  const validTask = {
    jiraUrl: 'https://acme.atlassian.net/browse/OPS-421',
    jiraKey: 'OPS-421',
    summary: 'Order status API',
    project: { name: 'Commerce', jiraProjectKey: 'OPS' },
  }

  it('accepts valid Jira lookup and task creation input', () => {
    expect(jiraLookupSchema.parse({ jiraUrl: validTask.jiraUrl })).toEqual({ jiraUrl: validTask.jiraUrl })
    expect(createTaskSchema.parse(validTask)).toEqual(validTask)
  })

  it('rejects invalid URLs, empty or oversized summaries, and invalid statuses', () => {
    expect(jiraLookupSchema.safeParse({ jiraUrl: 'not-a-url' }).success).toBe(false)
    expect(createTaskSchema.safeParse({ ...validTask, summary: '   ' }).success).toBe(false)
    expect(createTaskSchema.safeParse({ ...validTask, summary: 'x'.repeat(301) }).success).toBe(false)
    expect(patchTaskSchema.safeParse({ status: 'blocked' }).success).toBe(false)
  })

  it('requires a non-empty patch', () => {
    expect(patchTaskSchema.safeParse({}).success).toBe(false)
  })

  it('validates work-log notes and optional minute bounds', () => {
    const base = { workedOn: '2026-09-01', note: 'Added validation' }

    expect(createWorkLogSchema.parse(base)).toEqual(base)
    expect(createWorkLogSchema.parse({ ...base, minutesSpent: 1 }).minutesSpent).toBe(1)
    expect(createWorkLogSchema.safeParse({ ...base, note: '   ' }).success).toBe(false)
    expect(createWorkLogSchema.safeParse({ ...base, note: 'x'.repeat(2001) }).success).toBe(false)
    expect(createWorkLogSchema.safeParse({ ...base, minutesSpent: 0 }).success).toBe(false)
    expect(createWorkLogSchema.safeParse({ ...base, minutesSpent: 1441 }).success).toBe(false)
    expect(createWorkLogSchema.safeParse({ ...base, minutesSpent: 1.5 }).success).toBe(false)
  })
})
