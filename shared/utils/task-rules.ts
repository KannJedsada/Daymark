import type { TaskStatus } from '../types/domain'

export function applyStatus(previous: TaskStatus, next: TaskStatus, now: string) {
  if (previous === next) {
    return { status: next }
  }

  if (next === 'done') {
    return { status: next, completedAt: now }
  }

  if (previous === 'done') {
    return { status: next, completedAt: null }
  }

  return { status: next }
}

export function orderFocusedTasks<T extends { status: TaskStatus, updatedAt: string }>(tasks: readonly T[]): T[] {
  const weight: Record<TaskStatus, number> = { in_progress: 0, todo: 1, done: 2 }

  return [...tasks].sort((a, b) => weight[a.status] - weight[b.status]
    || Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}
