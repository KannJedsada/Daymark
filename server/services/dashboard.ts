import type {
  DashboardActivity,
  DashboardSummary,
  TaskStatus,
  TaskWithProject,
} from '../../shared/types/domain'
import type { DashboardQuery } from '../../shared/schemas/task'
import { bangkokDate } from '../../shared/utils/date'
import type { TaskRepository } from '../repositories/tasks'

const FOCUS_ORDER: Readonly<Record<Exclude<TaskStatus, 'done'>, number>> = {
  in_progress: 0,
  todo: 1,
}

export function buildDashboardSummary(
  tasks: readonly TaskWithProject[],
  workLogs: readonly DashboardActivity[],
  today: string,
): DashboardSummary {
  const counts = { todo: 0, inProgress: 0, done: 0 }

  for (const task of tasks) {
    if (task.status === 'todo') counts.todo += 1
    else if (task.status === 'in_progress') counts.inProgress += 1
    else counts.done += 1
  }

  const focusedTasks = tasks
    .filter((task): task is TaskWithProject & { status: Exclude<TaskStatus, 'done'> } => task.status !== 'done')
    .toSorted((left, right) => {
      const statusDifference = FOCUS_ORDER[left.status] - FOCUS_ORDER[right.status]
      return statusDifference || right.updatedAt.localeCompare(left.updatedAt)
    })

  const todayActivity = workLogs
    .filter(log => log.workedOn === today)
    .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))

  return { counts, focusedTasks, todayActivity }
}

type DashboardRepository = Pick<TaskRepository, 'listDashboardTasks' | 'listWorkLogsForDate'>
type Clock = () => Date

export function createDashboardService(
  repository: DashboardRepository,
  clock: Clock = () => new Date(),
) {
  return {
    async getSummary(filters: DashboardQuery = {}): Promise<DashboardSummary> {
      const date = filters.date ?? bangkokDate(clock())
      const [tasks, workLogs] = await Promise.all([
        repository.listDashboardTasks(filters.projectId ? { projectId: filters.projectId } : {}),
        repository.listWorkLogsForDate({
          workedOn: date,
          ...(filters.projectId ? { projectId: filters.projectId } : {}),
        }),
      ])

      return buildDashboardSummary(tasks, workLogs, date)
    },
  }
}

export type DashboardService = ReturnType<typeof createDashboardService>
