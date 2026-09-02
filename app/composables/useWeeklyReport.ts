import type { WeeklyReport } from '../../shared/types/domain'

export interface WeeklyReportFilters {
  week?: string
  projectId?: string
}

export function useWeeklyReport(filters: Ref<WeeklyReportFilters>) {
  const query = computed(() => ({
    week: filters.value.week || undefined,
    projectId: filters.value.projectId || undefined,
  }))

  const emptyReport = (): WeeklyReport => ({
    from: '',
    to: '',
    days: [],
    totalMinutes: 0,
    totalEntries: 0,
  })

  const request = useFetch<WeeklyReport>('/api/reports/weekly', {
    key: 'weekly-report',
    query,
    lazy: true,
    default: emptyReport,
  })

  const pending = computed(() => request.status.value === 'pending')

  return {
    data: request.data,
    error: request.error,
    pending,
    refresh: request.refresh,
  }
}
