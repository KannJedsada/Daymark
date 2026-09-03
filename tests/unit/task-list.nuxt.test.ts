import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import TaskList from '../../app/components/tasks/TaskList.vue'

const TASK_ID = '00000000-0000-4000-8000-000000000011'
const PROJECT_ID = '00000000-0000-4000-8000-000000000012'
const NOW = '2026-09-01T08:00:00.000Z'

const { fetchMock, refreshNuxtDataMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  refreshNuxtDataMock: vi.fn(async () => undefined),
}))

mockNuxtImport('$fetch', () => fetchMock)
mockNuxtImport('refreshNuxtData', () => refreshNuxtDataMock)

const task = {
  id: TASK_ID,
  projectId: PROJECT_ID,
  jiraUrl: 'https://acme.atlassian.net/browse/OPS-421',
  jiraKey: 'OPS-421',
  summary: 'Order status API',
  status: 'todo' as const,
  createdAt: NOW,
  updatedAt: NOW,
  completedAt: null,
  project: {
    id: PROJECT_ID,
    name: 'Operations',
    jiraProjectKey: 'OPS',
    createdAt: NOW,
    updatedAt: NOW,
  },
}

afterEach(() => {
  fetchMock.mockReset()
  refreshNuxtDataMock.mockClear()
})

describe('task list status controls', () => {
  it('changes a task status without opening its detail page', async () => {
    fetchMock.mockResolvedValueOnce({ ...task, status: 'in_progress' })
    const wrapper = await mountSuspended(TaskList, { props: { tasks: [task] } })

    const select = wrapper.get(`[id="task-status-${TASK_ID}"]`)
    await select.setValue('in_progress')
    await select.trigger('change')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith(`/api/tasks/${TASK_ID}`, expect.objectContaining({
      method: 'PATCH',
      body: { status: 'in_progress' },
    }))
    expect(wrapper.emitted('updated')?.[0]?.[0]).toMatchObject({ status: 'in_progress' })
  })
})
