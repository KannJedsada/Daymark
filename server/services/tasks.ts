import type {
  CreateTaskInput as ValidatedCreateTaskInput,
  CreateWorkLogInput as ValidatedCreateWorkLogInput,
  PatchTaskInput,
} from '../../shared/schemas/task'
import type { TaskStatus, TaskWithProject, WorkLog } from '../../shared/types/domain'
import { applyStatus } from '../../shared/utils/task-rules'
import { TaskRepositoryError, type TaskFilters, type TaskRepository } from '../repositories/tasks'

export type TaskServiceErrorCode = 'TASK_NOT_FOUND' | 'PROJECT_NOT_FOUND'

export class TaskServiceError extends Error {
  constructor(public readonly code: TaskServiceErrorCode) {
    super(code)
    this.name = 'TaskServiceError'
  }
}

export type CreateTaskResult =
  | { kind: 'created', task: TaskWithProject }
  | { kind: 'duplicate', task: TaskWithProject }

export interface TaskDetail extends TaskWithProject {
  workLogs: WorkLog[]
}

async function requireTask(repository: TaskRepository, id: string): Promise<TaskWithProject> {
  const task = await repository.findTaskById(id)
  if (!task) throw new TaskServiceError('TASK_NOT_FOUND')
  return task
}

function isUniqueViolation(code?: string) {
  return code === '23505'
}

async function resolveProject(repository: TaskRepository, input: ValidatedCreateTaskInput) {
  if (input.projectId) {
    const project = await repository.findProjectById(input.projectId)
    if (!project) throw new TaskServiceError('PROJECT_NOT_FOUND')
    return project
  }

  if (!input.project) throw new TaskServiceError('PROJECT_NOT_FOUND')

  return repository.upsertProject({
    name: input.project.name,
    jiraProjectKey: input.project.jiraProjectKey?.toUpperCase(),
  })
}

export function createTaskService(
  repository: TaskRepository,
  clock: () => string = () => new Date().toISOString(),
) {
  return {
    listTasks(filters: TaskFilters = {}) {
      return repository.listTasks(filters)
    },

    async getTask(id: string): Promise<TaskDetail> {
      const task = await requireTask(repository, id)
      const workLogs = await repository.listWorkLogs(id)
      return { ...task, workLogs }
    },

    async createTask(input: ValidatedCreateTaskInput): Promise<CreateTaskResult> {
      const jiraKey = input.jiraKey.toUpperCase()
      const existing = await repository.findTaskByJiraKey(jiraKey)
      if (existing) return { kind: 'duplicate', task: existing }

      const project = await resolveProject(repository, input)
      let task: TaskWithProject
      try {
        task = await repository.createTask({
          projectId: project.id,
          jiraUrl: input.jiraUrl,
          jiraKey,
          summary: input.summary,
          status: 'todo',
          completedAt: null,
        })
      }
      catch (error) {
        if (!(error instanceof TaskRepositoryError) || !isUniqueViolation(error.databaseCode)) throw error
        const concurrentTask = await repository.findTaskByJiraKey(jiraKey)
        if (!concurrentTask) throw error
        return { kind: 'duplicate', task: concurrentTask }
      }
      return { kind: 'created', task }
    },

    async updateTask(id: string, patch: PatchTaskInput): Promise<TaskWithProject> {
      const current = await requireTask(repository, id)
      const update: Parameters<TaskRepository['updateTask']>[1] = {}

      if (patch.jiraUrl !== undefined) update.jiraUrl = patch.jiraUrl
      if (patch.jiraKey !== undefined) update.jiraKey = patch.jiraKey.toUpperCase()
      if (patch.summary !== undefined) update.summary = patch.summary
      if (patch.projectId !== undefined) update.projectId = patch.projectId
      if (patch.project !== undefined) {
        const project = await repository.upsertProject({
          name: patch.project.name,
          jiraProjectKey: patch.project.jiraProjectKey?.toUpperCase(),
        })
        update.projectId = project.id
      }
      if (patch.status !== undefined) {
        Object.assign(update, applyStatus(current.status, patch.status, clock()))
      }

      if (Object.keys(update).length === 0) return current
      return repository.updateTask(id, update)
    },

    async changeStatus(id: string, status: TaskStatus): Promise<TaskWithProject> {
      return this.updateTask(id, { status })
    },

    async deleteTask(id: string): Promise<void> {
      await requireTask(repository, id)
      await repository.deleteTask(id)
    },

    async createWorkLog(id: string, input: ValidatedCreateWorkLogInput): Promise<WorkLog> {
      await requireTask(repository, id)
      return repository.createWorkLog(id, {
        workedOn: input.workedOn,
        note: input.note,
        minutesSpent: input.minutesSpent,
      })
    },
  }
}

export type TaskService = ReturnType<typeof createTaskService>
