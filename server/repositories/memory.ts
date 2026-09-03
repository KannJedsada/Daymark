import type { DashboardActivity, Project, TaskWithProject, WorkLog } from '../../shared/types/domain'
import { TaskRepositoryError, type CreateTaskInput, type CreateWorkLogInput, type ProjectInput, type TaskFilters, type TaskRepository, type UpdateTaskInput, type WorkLogDateFilters, type WorkLogRangeFilters } from './tasks'

interface MemoryState {
  projects: Map<string, Project>
  tasks: Map<string, TaskWithProject>
  workLogs: Map<string, WorkLog>
}

function timestamp(): string {
  return new Date().toISOString()
}

function activity(state: MemoryState, log: WorkLog): DashboardActivity | null {
  const task = state.tasks.get(log.taskId)
  return task ? { ...log, task } : null
}

export function createMemoryTaskRepository(state: MemoryState): TaskRepository {
  return {
    async listTasks(filters: TaskFilters = {}) {
      const taskIdsForDate = filters.date
        ? new Set([...state.workLogs.values()].filter(log => log.workedOn === filters.date).map(log => log.taskId))
        : null
      return [...state.tasks.values()]
        .filter(task => !filters.status || task.status === filters.status)
        .filter(task => !filters.projectId || task.projectId === filters.projectId)
        .filter(task => !filters.query || task.summary.toLocaleLowerCase().includes(filters.query.toLocaleLowerCase()))
        .filter(task => !taskIdsForDate || taskIdsForDate.has(task.id))
        .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    },

    async listDashboardTasks(filters = {}) {
      return [...state.tasks.values()]
        .filter(task => !filters.projectId || task.projectId === filters.projectId)
        .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.id.localeCompare(left.id))
    },

    async findTaskById(id: string) {
      return state.tasks.get(id) ?? null
    },

    async findTaskByJiraKey(key: string) {
      const normalized = key.toUpperCase()
      return [...state.tasks.values()].find(task => task.jiraKey === normalized) ?? null
    },

    async listProjects() {
      return [...state.projects.values()].toSorted((left, right) => left.name.localeCompare(right.name))
    },

    async findProjectById(id: string) {
      return state.projects.get(id) ?? null
    },

    async upsertProject(input: ProjectInput) {
      const jiraProjectKey = input.jiraProjectKey?.toUpperCase() ?? null
      const normalizedName = input.name.toLocaleLowerCase()
      const existing = [...state.projects.values()].find(project =>
        (jiraProjectKey && project.jiraProjectKey === jiraProjectKey)
        || project.name.toLocaleLowerCase() === normalizedName,
      )
      const now = timestamp()
      if (existing) {
        const project = { ...existing, name: input.name, jiraProjectKey: jiraProjectKey ?? existing.jiraProjectKey, updatedAt: now }
        state.projects.set(project.id, project)
        for (const task of state.tasks.values()) {
          if (task.projectId === project.id) state.tasks.set(task.id, { ...task, project })
        }
        return project
      }
      const project: Project = { id: crypto.randomUUID(), name: input.name, jiraProjectKey, createdAt: now, updatedAt: now }
      state.projects.set(project.id, project)
      return project
    },

    async createTask(input: CreateTaskInput) {
      const jiraKey = input.jiraKey.toUpperCase()
      if ([...state.tasks.values()].some(task => task.jiraKey === jiraKey)) throw new TaskRepositoryError('23505')
      const project = state.projects.get(input.projectId)
      if (!project) throw new TaskRepositoryError('23503')
      const now = timestamp()
      const task: TaskWithProject = {
        id: crypto.randomUUID(),
        projectId: input.projectId,
        jiraUrl: input.jiraUrl,
        jiraKey,
        summary: input.summary,
        status: input.status ?? 'todo',
        createdAt: now,
        updatedAt: now,
        completedAt: input.completedAt ?? null,
        project,
      }
      state.tasks.set(task.id, task)
      return task
    },

    async updateTask(id: string, patch: UpdateTaskInput) {
      const current = state.tasks.get(id)
      if (!current) throw new TaskRepositoryError('TASK_NOT_FOUND')
      const jiraKey = (patch.jiraKey ?? current.jiraKey).toUpperCase()
      if ([...state.tasks.values()].some(task => task.id !== id && task.jiraKey === jiraKey)) throw new TaskRepositoryError('23505')
      const project = state.projects.get(patch.projectId ?? current.projectId)
      if (!project) throw new TaskRepositoryError('23503')
      const task: TaskWithProject = {
        ...current,
        projectId: project.id,
        jiraUrl: patch.jiraUrl ?? current.jiraUrl,
        jiraKey,
        summary: patch.summary ?? current.summary,
        status: patch.status ?? current.status,
        completedAt: patch.completedAt !== undefined ? patch.completedAt : current.completedAt,
        updatedAt: timestamp(),
        project,
      }
      state.tasks.set(id, task)
      return task
    },

    async deleteTask(id: string) {
      state.tasks.delete(id)
      for (const [logId, log] of state.workLogs) {
        if (log.taskId === id) state.workLogs.delete(logId)
      }
    },

    async createWorkLog(taskId: string, input: CreateWorkLogInput) {
      if (!state.tasks.has(taskId)) throw new TaskRepositoryError('23503')
      const now = timestamp()
      const log: WorkLog = {
        id: crypto.randomUUID(),
        taskId,
        workedOn: input.workedOn,
        note: input.note,
        minutesSpent: input.minutesSpent ?? null,
        createdAt: now,
        updatedAt: now,
      }
      state.workLogs.set(log.id, log)
      return log
    },

    async listWorkLogs(taskId: string) {
      return [...state.workLogs.values()].filter(log => log.taskId === taskId)
        .toSorted((left, right) => right.workedOn.localeCompare(left.workedOn) || right.createdAt.localeCompare(left.createdAt))
    },

    async listWorkLogsForDate(filters: WorkLogDateFilters) {
      return [...state.workLogs.values()]
        .filter(log => log.workedOn === filters.workedOn)
        .map(log => activity(state, log))
        .filter((item): item is DashboardActivity => Boolean(item))
        .filter(item => !filters.projectId || item.task.projectId === filters.projectId)
        .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id))
    },

    async listWorkLogsForRange(filters: WorkLogRangeFilters) {
      return [...state.workLogs.values()]
        .filter(log => log.workedOn >= filters.from && log.workedOn <= filters.to)
        .map(log => activity(state, log))
        .filter((item): item is DashboardActivity => Boolean(item))
        .filter(item => !filters.projectId || item.task.projectId === filters.projectId)
        .toSorted((left, right) => right.workedOn.localeCompare(left.workedOn) || right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id))
    },
  }
}

export function createMemoryState(): MemoryState {
  return { projects: new Map(), tasks: new Map(), workLogs: new Map() }
}
