import type { TaskStatus, TaskWithProject } from '../../shared/types/domain'

export interface TaskListFilters {
  status?: TaskStatus
  projectId?: string
  query?: string
  date?: string
}

export function hasExplicitTaskFilters(query: Record<string, unknown>) {
  return (typeof query.status === 'string' && query.status.length > 0)
    || (typeof query.projectId === 'string' && query.projectId.length > 0)
    || (typeof query.query === 'string' && query.query.length > 0)
    || (typeof query.date === 'string' && query.date.length > 0)
}

export function useTasks(filters: Ref<TaskListFilters>) {
  const query = computed(() => ({
    status: filters.value.status || undefined,
    projectId: filters.value.projectId || undefined,
    query: filters.value.query || undefined,
    date: filters.value.date || undefined,
  }))

  const request = useFetch<TaskWithProject[]>('/api/tasks', {
    key: 'tasks',
    query,
    lazy: true,
    default: () => [],
  })

  const pending = computed(() => request.status.value === 'pending')

  return {
    data: request.data,
    error: request.error,
    pending,
    refresh: request.refresh,
  }
}

export interface TaskDetail extends TaskWithProject {
  workLogs: Array<{
    id: string
    taskId: string
    workedOn: string
    note: string
    minutesSpent: number | null
    createdAt: string
    updatedAt: string
  }>
}

export function useTaskDetail(taskId: Ref<string | undefined>) {
  const request = useFetch<TaskDetail>(() => taskId.value ? `/api/tasks/${taskId.value}` : '', {
    key: () => taskId.value ? `task-${taskId.value}` : 'task-empty',
    lazy: true,
    watch: [taskId],
  })

  const pending = computed(() => request.status.value === 'pending')

  return {
    data: request.data,
    error: request.error,
    pending,
    refresh: request.refresh,
  }
}
