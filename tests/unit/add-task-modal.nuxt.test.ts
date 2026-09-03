import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

function installDefaultFetchMock() {
  fetchMock.mockImplementation(async (url: string, options?: { method?: string }) => {
    if (url === '/api/projects') return []
    if (url === '/api/jira/lookup') return issue
    if (url === '/api/tasks' && options?.method === 'POST') return createdTask
    throw new Error(`Unhandled fetch: ${url}`)
  })
}

afterEach(() => {
  fetchMock.mockReset()
  refreshNuxtDataMock.mockClear()
})

beforeEach(() => {
  installDefaultFetchMock()
})

describe('AddTaskModal', () => {
  it('hides manual fields until lookup finishes', async () => {
    const wrapper = await mountModal()

    expect(wrapper.find('[name="summary"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="create-task"]').exists()).toBe(false)
  })

  it('fills editable Jira fields after a successful lookup', async () => {
    const wrapper = await mountModal()

    await lookup(wrapper)

    expect((wrapper.get('[name="jiraKey"]').element as HTMLInputElement).value).toBe('OPS-421')
    expect((wrapper.get('[name="summary"]').element as HTMLInputElement).value).toBe('Order status API')
    expect((wrapper.get('[name="projectName"]').element as HTMLInputElement).value).toBe('Operations')
    expect(wrapper.get('[data-testid="default-status"]').text()).toContain('Todo')
  }, 15_000)

  it('does not reuse an existing project selected by an earlier Jira lookup', async () => {
    clearNuxtData('projects')
    const existingProjectId = '00000000-0000-4000-8000-000000000020'
    const secondIssue = {
      jiraKey: 'BILL-72',
      jiraUrl: 'https://acme.atlassian.net/browse/BILL-72',
      summary: 'Reconcile invoices',
      project: { name: 'Billing', jiraProjectKey: 'BILL' },
    }
    let lookupCount = 0

    fetchMock.mockImplementation(async (url: string, options?: { method?: string }) => {
      if (url === '/api/projects') {
        return [{
          id: existingProjectId,
          name: issue.project.name,
          jiraProjectKey: issue.project.jiraProjectKey,
          createdAt: createdTask.createdAt,
          updatedAt: createdTask.updatedAt,
        }]
      }
      if (url === '/api/jira/lookup') return lookupCount++ === 0 ? issue : secondIssue
      if (url === '/api/tasks' && options?.method === 'POST') return { ...createdTask, ...secondIssue }
      throw new Error(`Unhandled fetch: ${url}`)
    })
    const wrapper = await mountModal()

    await lookup(wrapper)
    expect((wrapper.get('[name="projectId"]').element as HTMLSelectElement).value).toBe(existingProjectId)

    await wrapper.get('[name="jiraUrl"]').setValue(secondIssue.jiraUrl)
    await wrapper.get('[data-testid="jira-lookup"]').trigger('click')
    await flushPromises()

    expect((wrapper.get('[name="projectId"]').element as HTMLSelectElement).value).toBe('__new__')
    expect((wrapper.get('[name="projectName"]').element as HTMLInputElement).value).toBe('Billing')
    await submitForm(wrapper)

    const createCall = fetchMock.mock.calls.find(call => call[0] === '/api/tasks')
    expect(createCall?.[1]).toEqual(expect.objectContaining({
      method: 'POST',
      body: {
        jiraUrl: secondIssue.jiraUrl,
        jiraKey: secondIssue.jiraKey,
        summary: secondIssue.summary,
        project: { name: 'Billing', jiraProjectKey: 'BILL' },
      },
    }))
    expect(createCall?.[1]?.body).not.toHaveProperty('projectId')
  })

  it('preserves the Jira URL and reveals manual fields after a safe lookup failure', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/projects') return []
      if (url === '/api/jira/lookup') {
        throw {
          statusCode: 422,
          data: { code: 'JIRA_INVALID_URL', message: 'Enter a valid Jira issue URL.' },
        }
      }
      throw new Error(`Unhandled fetch: ${url}`)
    })
    const wrapper = await mountModal()

    await lookup(wrapper)

    expect((wrapper.get('[name="jiraUrl"]').element as HTMLInputElement).value).toBe(issue.jiraUrl)
    expect(wrapper.find('[name="jiraKey"]').exists()).toBe(true)
    expect(wrapper.get('[role="alert"]').text()).toContain('กรอกข้อมูลเองได้')
  })

  it('guards lookup and creation against repeated submissions', async () => {
    let resolveLookup!: (value: typeof issue) => void
    fetchMock.mockImplementation(async (url: string, options?: { method?: string }) => {
      if (url === '/api/projects') return []
      if (url === '/api/jira/lookup') {
        return new Promise(resolve => { resolveLookup = resolve })
      }
      if (url === '/api/tasks' && options?.method === 'POST') {
        return new Promise(resolve => { resolveCreate = resolve })
      }
      throw new Error(`Unhandled fetch: ${url}`)
    })

    let resolveCreate!: (value: typeof createdTask) => void
    const wrapper = await mountModal()

    await wrapper.get('[name="jiraUrl"]').setValue(issue.jiraUrl)
    await wrapper.get('[data-testid="jira-lookup"]').trigger('click')

    expect(wrapper.get('[data-testid="jira-lookup"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="create-task"]').exists()).toBe(false)
    await wrapper.get('[data-testid="jira-lookup"]').trigger('click')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    resolveLookup(issue)
    await flushPromises()

    await submitForm(wrapper)
    await submitForm(wrapper)

    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(wrapper.get('[data-testid="create-task"]').attributes('disabled')).toBeDefined()
    resolveCreate(createdTask)
    await flushPromises()
  })

  it('shows a link to an existing task on duplicate 409', async () => {
    fetchMock.mockImplementation(async (url: string, options?: { method?: string }) => {
      if (url === '/api/projects') return []
      if (url === '/api/jira/lookup') return issue
      if (url === '/api/tasks' && options?.method === 'POST') {
        throw {
          statusCode: 409,
          data: { code: 'DUPLICATE_JIRA', task: { id: createdTask.id } },
        }
      }
      throw new Error(`Unhandled fetch: ${url}`)
    })
    const wrapper = await mountModal()

    await lookup(wrapper)
    await submitForm(wrapper)

    const duplicate = wrapper.get('[data-testid="duplicate-task"]')
    expect(duplicate.text()).toContain('งานนี้มีอยู่แล้ว')
    expect(duplicate.get('a').attributes('href')).toBe(`/tasks/${createdTask.id}`)
  })

  it('closes, resets, emits, and refreshes dashboard/task data after creation', async () => {
    const wrapper = await mountModal()

    await lookup(wrapper)
    await submitForm(wrapper)

    expect(wrapper.emitted('created')?.[0]).toEqual([createdTask])
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
    expect(refreshNuxtDataMock).toHaveBeenCalledWith(['dashboard', 'tasks', 'projects', 'weekly-report'])

    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })
    await flushPromises()
    expect((wrapper.get('[name="jiraUrl"]').element as HTMLInputElement).value).toBe('')
    expect(wrapper.find('[name="jiraKey"]').exists()).toBe(false)
  })
})
