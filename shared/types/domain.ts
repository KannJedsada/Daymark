export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const

export type TaskStatus = typeof TASK_STATUSES[number]

export interface Project {
  id: string
  name: string
  jiraProjectKey: string | null
  createdAt: string
  updatedAt: string
}

export interface Task {
  id: string
  projectId: string
  jiraUrl: string
  jiraKey: string
  summary: string
  status: TaskStatus
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export interface WorkLog {
  id: string
  taskId: string
  workedOn: string
  note: string
  minutesSpent: number | null
  createdAt: string
  updatedAt: string
}

export type TaskWithProject = Task & {
  project: Project
}

export type DashboardActivity = WorkLog & {
  task: TaskWithProject
}

export interface DashboardSummary {
  counts: {
    todo: number
    inProgress: number
    done: number
  }
  focusedTasks: TaskWithProject[]
  todayActivity: DashboardActivity[]
}

export interface WeeklyReportDay {
  date: string
  activities: DashboardActivity[]
  totalMinutes: number
}

export interface WeeklyReport {
  from: string
  to: string
  days: WeeklyReportDay[]
  totalMinutes: number
  totalEntries: number
}
