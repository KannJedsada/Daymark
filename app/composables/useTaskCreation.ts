import { z } from 'zod'

import type { TaskWithProject } from '../../shared/types/domain'

const requiredText = (label: string, maximum: number) => z.string()
  .trim()
  .min(1, `กรุณากรอก${label}`)
  .max(maximum, `${label}ยาวเกินไป`)

export const taskCreationFormSchema = z.object({
  jiraUrl: z.url('กรุณากรอกลิงก์ Jira ที่ถูกต้อง'),
  jiraKey: requiredText('รหัส Jira', 100),
  summary: requiredText('ชื่องาน', 300),
  projectName: requiredText('ชื่อโปรเจกต์', 300),
  jiraProjectKey: z.string().trim().max(100, 'รหัสโปรเจกต์ยาวเกินไป'),
})

const jiraIssueSchema = z.object({
  jiraUrl: z.url(),
  jiraKey: z.string().trim().min(1).max(100),
  summary: z.string().trim().min(1).max(300),
  project: z.object({
    name: z.string().trim().min(1).max(300),
    jiraProjectKey: z.string().trim().min(1).max(100),
  }),
})

export type TaskCreationForm = z.infer<typeof taskCreationFormSchema>

type LookupState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready', source: 'jira' }
  | { status: 'ready', source: 'manual', message: string }

type CreationState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'duplicate', taskId: string }
  | { status: 'error', message: string }

interface FetchFailure {
  statusCode?: number
  data?: {
    code?: string
    task?: { id?: string }
    data?: { code?: string, task?: { id?: string } }
  }
}

function createEmptyForm(): TaskCreationForm {
  return { jiraUrl: '', jiraKey: '', summary: '', projectName: '', jiraProjectKey: '' }
}

function failureDetails(error: unknown) {
  const failure = error as FetchFailure
  const payload = failure.data?.data ?? failure.data
  return { statusCode: failure.statusCode, code: payload?.code, taskId: payload?.task?.id }
}

export function useTaskCreation(onCreated: (task: TaskWithProject) => void) {
  const form = reactive<TaskCreationForm>(createEmptyForm())
  const lookupState = ref<LookupState>({ status: 'idle' })
  const creationState = ref<CreationState>({ status: 'idle' })

  const fieldsVisible = computed(() => lookupState.value.status === 'ready')
  const isLookingUp = computed(() => lookupState.value.status === 'loading')
  const isSubmitting = computed(() => creationState.value.status === 'submitting')
  const isBusy = computed(() => isLookingUp.value || isSubmitting.value)

  function reset() {
    Object.assign(form, createEmptyForm())
    lookupState.value = { status: 'idle' }
    creationState.value = { status: 'idle' }
  }

  async function lookupJira() {
    if (isBusy.value) return

    creationState.value = { status: 'idle' }
    const parsedUrl = z.url().safeParse(form.jiraUrl.trim())
    if (!parsedUrl.success) {
      lookupState.value = {
        status: 'ready',
        source: 'manual',
        message: 'ตรวจสอบลิงก์ Jira ไม่สำเร็จ คุณยังกรอกข้อมูลเองได้',
      }
      return
    }

    lookupState.value = { status: 'loading' }
    try {
      const response = await $fetch('/api/jira/lookup', {
        method: 'POST',
        body: { jiraUrl: parsedUrl.data },
      })
      const issue = jiraIssueSchema.parse(response)
      Object.assign(form, {
        jiraUrl: issue.jiraUrl,
        jiraKey: issue.jiraKey,
        summary: issue.summary,
        projectName: issue.project.name,
        jiraProjectKey: issue.project.jiraProjectKey,
      })
      lookupState.value = { status: 'ready', source: 'jira' }
    }
    catch {
      lookupState.value = {
        status: 'ready',
        source: 'manual',
        message: 'ดึงข้อมูลจาก Jira ไม่สำเร็จ แต่ลิงก์ยังอยู่และคุณกรอกข้อมูลเองได้',
      }
    }
  }

  async function createTask() {
    if (isBusy.value || !fieldsVisible.value) return

    const parsed = taskCreationFormSchema.safeParse(form)
    if (!parsed.success) return

    creationState.value = { status: 'submitting' }
    try {
      const task = await $fetch<TaskWithProject>('/api/tasks', {
        method: 'POST',
        body: {
          jiraUrl: parsed.data.jiraUrl,
          jiraKey: parsed.data.jiraKey,
          summary: parsed.data.summary,
          project: {
            name: parsed.data.projectName,
            jiraProjectKey: parsed.data.jiraProjectKey || undefined,
          },
        },
      })
      await refreshNuxtData(['dashboard', 'tasks'])
      reset()
      onCreated(task)
    }
    catch (error) {
      const failure = failureDetails(error)
      if (failure.statusCode === 409 && failure.code === 'DUPLICATE_JIRA' && failure.taskId) {
        creationState.value = { status: 'duplicate', taskId: failure.taskId }
        return
      }
      creationState.value = {
        status: 'error',
        message: 'บันทึกงานไม่สำเร็จ กรุณาลองอีกครั้ง',
      }
    }
  }

  return {
    form,
    lookupState,
    creationState,
    fieldsVisible,
    isLookingUp,
    isSubmitting,
    isBusy,
    lookupJira,
    createTask,
    reset,
  }
}
