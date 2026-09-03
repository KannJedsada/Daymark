import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import TaskDetailPage from '../../app/pages/tasks/[id].vue'

const TASK_ID = '00000000-0000-4000-8000-000000000001'
const NOW = '2026-09-01T08:00:00.000Z'

const { fetchMock, refreshNuxtDataMock, navigateToMock, taskState, projectsState } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  refreshNuxtDataMock: vi.fn(async () => undefined),
  navigateToMock: vi.fn(async () => undefined),
  taskState: { current: null as Record<string, unknown> | null },
  projectsState: { current: [] as Array<Record<string, unknown>> },
}))

mockNuxtImport('$fetch', () => fetchMock)
mockNuxtImport('refreshNuxtData', () => refreshNuxtDataMock)
mockNuxtImport('navigateTo', () => navigateToMock)
mockNuxtImport('useFetch', () => {
  const { ref, toRef } = require('vue') as typeof import('vue')
  return (url: string | (() => string)) => ({
    data: typeof url === 'string' && url === '/api/projects'
      ? toRef(projectsState, 'current')
      : toRef(taskState, 'current'),
    error: ref(null),
    status: ref('success'),
    refresh: vi.fn(async () => undefined),
  })
})

function taskDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: TASK_ID,
    projectId: '00000000-0000-4000-8000-000000000002',
    jiraUrl: 'https://acme.atlassian.net/browse/OPS-421',
    jiraKey: 'OPS-421',
    summary: 'Order status API',
    status: 'todo',
    createdAt: NOW,
    updatedAt: NOW,
    completedAt: null,
    project: {
      id: '00000000-0000-4000-8000-000000000002',
      name: 'Operations',
      jiraProjectKey: 'OPS',
      createdAt: NOW,
      updatedAt: NOW,
    },
    workLogs: [],
    ...overrides,
  }
}

async function mountDetail(overrides: Record<string, unknown> = {}) {
  taskState.current = taskDetail(overrides)
  projectsState.current = [taskDetail(overrides).project as Record<string, unknown>]
  const wrapper = await mountSuspended(TaskDetailPage, {
    route: `/tasks/${TASK_ID}`,
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

async function changeStatus(wrapper: Awaited<ReturnType<typeof mountDetail>>, status: string) {
  const select = wrapper.get('[name="status"]')
  await select.setValue(status)
  await select.trigger('change')
  await flushPromises()
}

afterEach(() => {
  fetchMock.mockReset()
  refreshNuxtDataMock.mockClear()
  navigateToMock.mockClear()
  taskState.current = null
  projectsState.current = []
})

describe('task detail workflows', () => {
  it('patches status to done when the status select changes', async () => {
    fetchMock.mockResolvedValueOnce(taskDetail({ status: 'done', completedAt: NOW }))
    const wrapper = await mountDetail()

    await changeStatus(wrapper, 'done')

    expect(fetchMock).toHaveBeenCalledWith(`/api/tasks/${TASK_ID}`, expect.objectContaining({
      method: 'PATCH',
      body: { status: 'done' },
    }))
    expect(wrapper.get('[data-testid="completed-at"]').text()).toContain('เสร็จเมื่อ')
  })

  it('reopens a done task to in progress', async () => {
    fetchMock.mockResolvedValueOnce(taskDetail({ status: 'in_progress', completedAt: null }))
    const wrapper = await mountDetail({ status: 'done', completedAt: NOW })

    await changeStatus(wrapper, 'in_progress')

    expect(fetchMock).toHaveBeenCalledWith(`/api/tasks/${TASK_ID}`, expect.objectContaining({
      method: 'PATCH',
      body: { status: 'in_progress' },
    }))
    expect(wrapper.find('[data-testid="completed-at"]').exists()).toBe(false)
  })

  it('creates a dated work log with optional minutes', async () => {
    fetchMock.mockResolvedValueOnce({
      id: 'log-1',
      taskId: TASK_ID,
      workedOn: '2026-09-01',
      note: 'Added validation',
      minutesSpent: 45,
      createdAt: NOW,
      updatedAt: NOW,
    })
    const wrapper = await mountDetail()

    await wrapper.get('[name="workedOn"]').setValue('2026-09-01')
    await wrapper.get('[name="note"]').setValue('Added validation')
    await wrapper.get('[name="minutesSpent"]').setValue('45')
    await wrapper.find('form.work-log-form').trigger('submit')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith(`/api/tasks/${TASK_ID}/work-logs`, expect.objectContaining({
      method: 'POST',
      body: {
        workedOn: '2026-09-01',
        note: 'Added validation',
        minutesSpent: 45,
      },
    }))
    expect(wrapper.text()).toContain('Added validation')
  })

  it('rejects fractional minutes with a field-specific accessible error', async () => {
    const wrapper = await mountDetail()

    await wrapper.get('[name="workedOn"]').setValue('2026-09-01')
    await wrapper.get('[name="note"]').setValue('Reviewed the API')
    await wrapper.get('[name="minutesSpent"]').setValue('12.5')
    await wrapper.find('form.work-log-form').trigger('submit')
    await flushPromises()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(wrapper.get('[name="minutesSpent"]').attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('#work-log-minutes-error').text()).toContain('จำนวนเต็ม')
  })

  it('edits Jira metadata, summary, and project', async () => {
    fetchMock.mockResolvedValueOnce(taskDetail({
      jiraUrl: 'https://acme.atlassian.net/browse/OPS-422',
      jiraKey: 'OPS-422',
      summary: 'Updated order status API',
    }))
    const wrapper = await mountDetail()

    await wrapper.get('[data-testid="edit-task"]').trigger('click')
    await wrapper.get('[name="jiraUrl"]').setValue('https://acme.atlassian.net/browse/OPS-422')
    await wrapper.get('[name="jiraKey"]').setValue('ops-422')
    await wrapper.get('[name="summary"]').setValue('Updated order status API')
    await wrapper.find('form.edit-form').trigger('submit')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith(`/api/tasks/${TASK_ID}`, expect.objectContaining({
      method: 'PATCH',
      body: {
        jiraUrl: 'https://acme.atlassian.net/browse/OPS-422',
        jiraKey: 'OPS-422',
        summary: 'Updated order status API',
        projectId: '00000000-0000-4000-8000-000000000002',
      },
    }))
    expect(wrapper.text()).toContain('Updated order status API')
  })

  it('shows created, updated, and completed timestamps', async () => {
    const wrapper = await mountDetail({ completedAt: NOW })

    expect(wrapper.text()).toContain('สร้าง')
    expect(wrapper.text()).toContain('อัปเดต')
    expect(wrapper.get('[data-testid="completed-at"]').text()).toContain('เสร็จเมื่อ')
  })

  it('shows deletion confirmation mentioning associated work logs', async () => {
    const wrapper = await mountDetail()

    await wrapper.get('[data-testid="delete-task"]').trigger('click')
    await flushPromises()

    const confirmation = wrapper.get('[data-testid="delete-confirmation"]')
    expect(confirmation.text()).toContain('บันทึกความคืบหน้า')
    expect(confirmation.text()).toContain('เชื่อมกับงาน')
  })

  it('deletes the task and redirects to the task list', async () => {
    fetchMock.mockResolvedValueOnce(undefined)
    const wrapper = await mountDetail()

    await wrapper.get('[data-testid="delete-task"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="confirm-delete"]').trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith(`/api/tasks/${TASK_ID}`, { method: 'DELETE' })
    expect(navigateToMock).toHaveBeenCalledWith('/tasks')
    expect(refreshNuxtDataMock).toHaveBeenCalledWith(['dashboard', 'tasks'])
  })
})
