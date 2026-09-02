import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import AddTaskModal from '../../app/components/tasks/AddTaskModal.vue'

const { fetchMock, refreshNuxtDataMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  refreshNuxtDataMock: vi.fn(async () => undefined),
}))

mockNuxtImport('refreshNuxtData', () => refreshNuxtDataMock)
mockNuxtImport('$fetch', () => fetchMock)

const issue = {
  jiraKey: 'OPS-421',
  jiraUrl: 'https://acme.atlassian.net/browse/OPS-421',
  summary: 'Order status API',
  project: { name: 'Operations', jiraProjectKey: 'OPS' },
}

const createdTask = {
  id: '00000000-0000-4000-8000-000000000001',
  projectId: 'project-1',
  jiraUrl: issue.jiraUrl,
  jiraKey: issue.jiraKey,
  summary: issue.summary,
  status: 'todo' as const,
  createdAt: '2026-09-02T08:00:00.000Z',
  updatedAt: '2026-09-02T08:00:00.000Z',
  completedAt: null,
  project: {
    id: 'project-1',
    name: 'Operations',
    jiraProjectKey: 'OPS',
    createdAt: '2026-09-02T08:00:00.000Z',
    updatedAt: '2026-09-02T08:00:00.000Z',
  },
}

async function mountModal() {
  return await mountSuspended(AddTaskModal, {
    props: { open: true, portal: false },
    attachTo: document.body,
  })
}

async function lookup(wrapper: Awaited<ReturnType<typeof mountModal>>) {
  await wrapper.get('[name="jiraUrl"]').setValue(issue.jiraUrl)
  await flushPromises()
  await wrapper.get('[data-testid="jira-lookup"]').trigger('click')
  await flushPromises()
}

async function submitForm(wrapper: Awaited<ReturnType<typeof mountModal>>) {
  await wrapper.get('[data-testid="create-task"]').trigger('click')
  await flushPromises()
}

afterEach(() => {
  fetchMock.mockReset()
  refreshNuxtDataMock.mockClear()
})

describe('AddTaskModal', () => {
  it('hides manual fields until lookup finishes', async () => {
    const wrapper = await mountModal()

    expect(wrapper.find('[name="summary"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="create-task"]').exists()).toBe(false)
  })

  it('fills editable Jira fields after a successful lookup', async () => {
    fetchMock.mockResolvedValueOnce(issue)
    const wrapper = await mountModal()

    await lookup(wrapper)

    expect((wrapper.get('[name="jiraKey"]').element as HTMLInputElement).value).toBe('OPS-421')
    expect((wrapper.get('[name="summary"]').element as HTMLInputElement).value).toBe('Order status API')
    expect((wrapper.get('[name="projectName"]').element as HTMLInputElement).value).toBe('Operations')
    expect(wrapper.get('[data-testid="default-status"]').text()).toContain('Todo')
  }, 15_000)

  it('preserves the Jira URL and reveals manual fields after a safe lookup failure', async () => {
    fetchMock.mockRejectedValueOnce({
      statusCode: 422,
      data: { code: 'JIRA_INVALID_URL', message: 'Enter a valid Jira issue URL.' },
    })
    const wrapper = await mountModal()

    await lookup(wrapper)

    expect((wrapper.get('[name="jiraUrl"]').element as HTMLInputElement).value).toBe(issue.jiraUrl)
    expect(wrapper.find('[name="jiraKey"]').exists()).toBe(true)
    expect(wrapper.get('[role="alert"]').text()).toContain('กรอกข้อมูลเองได้')
  })

  it('guards lookup and creation against repeated submissions', async () => {
    let resolveLookup!: (value: typeof issue) => void
    fetchMock.mockImplementationOnce(() => new Promise(resolve => { resolveLookup = resolve }))
    const wrapper = await mountModal()

    await wrapper.get('[name="jiraUrl"]').setValue(issue.jiraUrl)
    await wrapper.get('[data-testid="jira-lookup"]').trigger('click')

    expect(wrapper.get('[data-testid="jira-lookup"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="create-task"]').exists()).toBe(false)
    await wrapper.get('[data-testid="jira-lookup"]').trigger('click')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    resolveLookup(issue)
    await flushPromises()

    let resolveCreate!: (value: typeof createdTask) => void
    fetchMock.mockImplementationOnce(() => new Promise(resolve => { resolveCreate = resolve }))
    await submitForm(wrapper)
    await submitForm(wrapper)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(wrapper.get('[data-testid="create-task"]').attributes('disabled')).toBeDefined()
    resolveCreate(createdTask)
    await flushPromises()
  })

  it('shows a link to an existing task on duplicate 409', async () => {
    fetchMock
      .mockResolvedValueOnce(issue)
      .mockRejectedValueOnce({
        statusCode: 409,
        data: { code: 'DUPLICATE_JIRA', task: { id: createdTask.id } },
      })
    const wrapper = await mountModal()

    await lookup(wrapper)
    await submitForm(wrapper)

    const duplicate = wrapper.get('[data-testid="duplicate-task"]')
    expect(duplicate.text()).toContain('งานนี้มีอยู่แล้ว')
    expect(duplicate.get('a').attributes('href')).toBe(`/tasks/${createdTask.id}`)
  })

  it('closes, resets, emits, and refreshes dashboard/task data after creation', async () => {
    fetchMock.mockResolvedValueOnce(issue).mockResolvedValueOnce(createdTask)
    const wrapper = await mountModal()

    await lookup(wrapper)
    await submitForm(wrapper)

    expect(wrapper.emitted('created')?.[0]).toEqual([createdTask])
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
    expect(refreshNuxtDataMock).toHaveBeenCalledWith(['dashboard', 'tasks'])

    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })
    await flushPromises()
    expect((wrapper.get('[name="jiraUrl"]').element as HTMLInputElement).value).toBe('')
    expect(wrapper.find('[name="jiraKey"]').exists()).toBe(false)
  })
})
