import type { WeeklyReportQuery } from '../../shared/schemas/task'
import type { DashboardActivity, WeeklyReport, WeeklyReportDay } from '../../shared/types/domain'
import { addBangkokDays, bangkokDate, bangkokWeekRange } from '../../shared/utils/date'
import type { TaskRepository } from '../repositories/tasks'

type ReportRepository = Pick<TaskRepository, 'listWorkLogsForRange'>

function groupByDay(activities: DashboardActivity[]) {
  const map = new Map<string, DashboardActivity[]>()
  for (const activity of activities) {
    const bucket = map.get(activity.workedOn) ?? []
    bucket.push(activity)
    map.set(activity.workedOn, bucket)
  }
  return map
}

function summarizeDay(date: string, activities: DashboardActivity[]): WeeklyReportDay {
  const totalMinutes = activities.reduce((sum, item) => sum + (item.minutesSpent ?? 0), 0)
  return { date, activities, totalMinutes }
}

export function createReportService(repository: ReportRepository) {
  return {
    async getWeeklyReport(filters: WeeklyReportQuery = {}): Promise<WeeklyReport> {
      const { from, to } = bangkokWeekRange(filters.week ?? bangkokDate())
      const activities = await repository.listWorkLogsForRange({
        from,
        to,
        projectId: filters.projectId,
      })
      const grouped = groupByDay(activities)

      const days: WeeklyReportDay[] = []
      let cursor = from
      while (cursor <= to) {
        days.push(summarizeDay(cursor, grouped.get(cursor) ?? []))
        cursor = addBangkokDays(cursor, 1)
      }

      return {
        from,
        to,
        days,
        totalMinutes: days.reduce((sum, day) => sum + day.totalMinutes, 0),
        totalEntries: activities.length,
      }
    },
  }
}

export type ReportService = ReturnType<typeof createReportService>
