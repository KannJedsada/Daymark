import { describe, expect, it } from 'vitest'

import { createReportService } from '../../server/services/reports'
import type { DashboardActivity, TaskWithProject } from '../../shared/types/domain'

const PROJECT_ID = '00000000-0000-4000-8000-000000000001'

function task(id: string, updatedAt: string): TaskWithProject {
  return {
    id,
    projectId: PROJECT_ID,
    jiraUrl: `https://acme.atlassian.net/browse/${id}`,
    jiraKey: id.toUpperCase(),
    summary: `Task ${id}`,
    status: 'in_progress',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt,
    completedAt: null,
    project: {
      id: PROJECT_ID,
      name: 'Operations',
      jiraProjectKey: 'OPS',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    },
  }
}

function activity(
  id: string,
  workedOn: string,
  createdAt: string,
  taskContext = task('ops-1', createdAt),
): DashboardActivity {
  return {
    id,
    taskId: taskContext.id,
    workedOn,
    note: `Note ${id}`,
    minutesSpent: 30,
    createdAt,
    updatedAt: createdAt,
    task: taskContext,
  }
}

describe('weekly report service', () => {
  it('groups work logs by Bangkok day across a full week', async () => {
    const logs = [
      activity('mon', '2025-09-01', '2025-09-01T08:00:00.000Z'),
      activity('wed', '2025-09-03', '2025-09-03T10:00:00.000Z'),
      activity('other-week', '2025-08-31', '2025-08-31T10:00:00.000Z'),
    ]

    const service = createReportService({
      listWorkLogsForRange: async ({ from, to }) => logs.filter(log => log.workedOn >= from && log.workedOn <= to),
    })

    const report = await service.getWeeklyReport({ week: '2025-09-03' })

    expect(report.from).toBe('2025-09-01')
    expect(report.to).toBe('2025-09-07')
    expect(report.totalEntries).toBe(2)
    expect(report.totalMinutes).toBe(60)
    expect(report.days.map(day => day.date)).toEqual([
      '2025-09-01',
      '2025-09-02',
      '2025-09-03',
      '2025-09-04',
      '2025-09-05',
      '2025-09-06',
      '2025-09-07',
    ])
    expect(report.days[0]?.activities.map(item => item.id)).toEqual(['mon'])
    expect(report.days[2]?.activities.map(item => item.id)).toEqual(['wed'])
    expect(report.days[1]?.totalMinutes).toBe(0)
  })
})
