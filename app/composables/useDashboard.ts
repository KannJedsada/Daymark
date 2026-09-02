import type { DashboardSummary } from '../../shared/types/domain'

export interface DashboardFilters {
  projectId?: string
  date?: string
}

export function hasExplicitDashboardFilters(query: Record<string, unknown>) {
  return (typeof query.projectId === 'string' && query.projectId.length > 0)
    || (typeof query.date === 'string' && query.date.length > 0)
}

const emptyDashboard = (): DashboardSummary => ({
  counts: { todo: 0, inProgress: 0, done: 0 },
  focusedTasks: [],
  todayActivity: [],
})

export function useDashboard(filters: Ref<DashboardFilters>) {
  const query = computed(() => ({
    projectId: filters.value.projectId || undefined,
    date: filters.value.date || undefined,
  }))

  const request = useFetch<DashboardSummary>('/api/dashboard', {
    key: 'dashboard',
    query,
    lazy: true,
    default: emptyDashboard,
  })

  const pending = computed(() => request.status.value === 'pending')

  return {
    data: request.data,
    error: request.error,
    pending,
    refresh: request.refresh,
  }
}
