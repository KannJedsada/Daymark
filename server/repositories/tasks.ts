import type { Database } from 'better-sqlite3'

import type { DashboardActivity, Project, TaskStatus, TaskWithProject, WorkLog } from '../../shared/types/domain'

export interface TaskFilters {
  status?: TaskStatus
  projectId?: string
  query?: string
  date?: string
}

export interface ProjectInput {
  name: string
  jiraProjectKey?: string | null
}

export interface CreateTaskInput {
  projectId: string
  jiraUrl: string
  jiraKey: string
  summary: string
  status?: TaskStatus
  completedAt?: string | null
}

export interface UpdateTaskInput {
  projectId?: string
  jiraUrl?: string
  jiraKey?: string
  summary?: string
  status?: TaskStatus
  completedAt?: string | null
}

export interface CreateWorkLogInput {
  workedOn: string
  note: string
  minutesSpent?: number | null
}

export interface WorkLogDateFilters {
  workedOn: string
  projectId?: string
}

interface ProjectRow {
  id: string
  name: string
  jira_project_key: string | null
  created_at: string
  updated_at: string
}

interface TaskRow {
  id: string
  project_id: string
  jira_url: string
  jira_key: string
  summary: string
  status: TaskStatus
  created_at: string
  updated_at: string
  completed_at: string | null
}

interface WorkLogRow {
  id: string
  task_id: string
  worked_on: string
  note: string
  minutes_spent: number | null
  created_at: string
  updated_at: string
}

const DASHBOARD_PAGE_SIZE = 1_000

export class TaskRepositoryError extends Error {
  constructor(public readonly databaseCode?: string) {
    super('TASK_REPOSITORY_QUERY_FAILED')
    this.name = 'TaskRepositoryError'
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

function newId(): string {
  return crypto.randomUUID()
}

function mapProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    jiraProjectKey: row.jira_project_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapTask(row: TaskRow, project: Project): TaskWithProject {
  return {
    id: row.id,
    projectId: row.project_id,
    jiraUrl: row.jira_url,
    jiraKey: row.jira_key,
    summary: row.summary,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    project,
  }
}

function mapWorkLog(row: WorkLogRow): WorkLog {
  return {
    id: row.id,
    taskId: row.task_id,
    workedOn: row.worked_on,
    note: row.note,
    minutesSpent: row.minutes_spent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function getProject(db: Database, projectId: string): Project {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as ProjectRow | undefined
  if (!row) throw new Error(`PROJECT_NOT_FOUND: ${projectId}`)
  return mapProject(row)
}

function getTaskWithProject(db: Database, taskId: string): TaskWithProject | null {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as TaskRow | undefined
  if (!row) return null
  return mapTask(row, getProject(db, row.project_id))
}

function wrapDatabaseError(error: unknown): never {
  if (error instanceof Error && 'code' in error) {
    throw new TaskRepositoryError(String((error as { code?: string }).code))
  }
  throw error
}

export function createTaskRepository(db: Database) {
  return {
    listTasks(filters: TaskFilters = {}): TaskWithProject[] {
      const clauses: string[] = []
      const params: unknown[] = []

      if (filters.status) {
        clauses.push('t.status = ?')
        params.push(filters.status)
      }
      if (filters.projectId) {
        clauses.push('t.project_id = ?')
        params.push(filters.projectId)
      }
      if (filters.query) {
        clauses.push('t.summary LIKE ?')
        params.push(`%${filters.query}%`)
      }
      if (filters.date) {
        clauses.push('EXISTS (SELECT 1 FROM work_logs wl WHERE wl.task_id = t.id AND wl.worked_on = ?)')
        params.push(filters.date)
      }

      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
      const rows = db.prepare(`
        SELECT t.*
        FROM tasks t
        ${where}
        ORDER BY t.updated_at DESC
      `).all(...params) as TaskRow[]

      return rows.map(row => mapTask(row, getProject(db, row.project_id)))
    },

    listDashboardTasks(filters: Pick<TaskFilters, 'projectId'> = {}): TaskWithProject[] {
      const tasks: TaskWithProject[] = []
      const params: unknown[] = []
      let where = ''
      if (filters.projectId) {
        where = 'WHERE project_id = ?'
        params.push(filters.projectId)
      }

      while (true) {
        const offset = tasks.length
        const rows = db.prepare(`
          SELECT *
          FROM tasks
          ${where}
          ORDER BY updated_at DESC, id DESC
          LIMIT ? OFFSET ?
        `).all(...params, DASHBOARD_PAGE_SIZE, offset) as TaskRow[]

        if (rows.length === 0) break
        tasks.push(...rows.map(row => mapTask(row, getProject(db, row.project_id))))
        if (rows.length < DASHBOARD_PAGE_SIZE) break
      }

      return tasks
    },

    findTaskById(id: string): TaskWithProject | null {
      return getTaskWithProject(db, id)
    },

    findTaskByJiraKey(key: string): TaskWithProject | null {
      const row = db.prepare('SELECT * FROM tasks WHERE jira_key = ?').get(key.toUpperCase()) as TaskRow | undefined
      if (!row) return null
      return mapTask(row, getProject(db, row.project_id))
    },

    upsertProject(input: ProjectInput): Project {
      const timestamp = nowIso()
      const jiraProjectKey = input.jiraProjectKey?.toUpperCase() ?? null

      if (jiraProjectKey) {
        const existing = db.prepare('SELECT * FROM projects WHERE jira_project_key = ?').get(jiraProjectKey) as ProjectRow | undefined
        if (existing) {
          db.prepare('UPDATE projects SET name = ?, updated_at = ? WHERE id = ?').run(input.name, timestamp, existing.id)
          return mapProject({ ...existing, name: input.name, updated_at: timestamp })
        }
      }

      const existingByName = db.prepare('SELECT * FROM projects WHERE name = ? COLLATE NOCASE').get(input.name) as ProjectRow | undefined
      if (existingByName) {
        if (jiraProjectKey && !existingByName.jira_project_key) {
          db.prepare('UPDATE projects SET jira_project_key = ?, updated_at = ? WHERE id = ?')
            .run(jiraProjectKey, timestamp, existingByName.id)
          return mapProject({ ...existingByName, jira_project_key: jiraProjectKey, updated_at: timestamp })
        }
        return mapProject(existingByName)
      }

      const row: ProjectRow = {
        id: newId(),
        name: input.name,
        jira_project_key: jiraProjectKey,
        created_at: timestamp,
        updated_at: timestamp,
      }
      db.prepare(`
        INSERT INTO projects (id, name, jira_project_key, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(row.id, row.name, row.jira_project_key, row.created_at, row.updated_at)
      return mapProject(row)
    },

    createTask(input: CreateTaskInput): TaskWithProject {
      const timestamp = nowIso()
      const row: TaskRow = {
        id: newId(),
        project_id: input.projectId,
        jira_url: input.jiraUrl,
        jira_key: input.jiraKey.toUpperCase(),
        summary: input.summary,
        status: input.status ?? 'todo',
        created_at: timestamp,
        updated_at: timestamp,
        completed_at: input.completedAt ?? null,
      }

      try {
        db.prepare(`
          INSERT INTO tasks (
            id, project_id, jira_url, jira_key, summary, status, created_at, updated_at, completed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          row.id,
          row.project_id,
          row.jira_url,
          row.jira_key,
          row.summary,
          row.status,
          row.created_at,
          row.updated_at,
          row.completed_at,
        )
      }
      catch (error) {
        wrapDatabaseError(error)
      }

      return mapTask(row, getProject(db, row.project_id))
    },

    updateTask(id: string, patch: UpdateTaskInput): TaskWithProject {
      const current = getTaskWithProject(db, id)
      if (!current) throw new TaskRepositoryError('TASK_NOT_FOUND')

      const next: TaskRow = {
        id: current.id,
        project_id: patch.projectId ?? current.projectId,
        jira_url: patch.jiraUrl ?? current.jiraUrl,
        jira_key: (patch.jiraKey ?? current.jiraKey).toUpperCase(),
        summary: patch.summary ?? current.summary,
        status: patch.status ?? current.status,
        created_at: current.createdAt,
        updated_at: nowIso(),
        completed_at: patch.completedAt !== undefined ? patch.completedAt : current.completedAt,
      }

      try {
        db.prepare(`
          UPDATE tasks
          SET project_id = ?, jira_url = ?, jira_key = ?, summary = ?, status = ?, updated_at = ?, completed_at = ?
          WHERE id = ?
        `).run(
          next.project_id,
          next.jira_url,
          next.jira_key,
          next.summary,
          next.status,
          next.updated_at,
          next.completed_at,
          id,
        )
      }
      catch (error) {
        wrapDatabaseError(error)
      }

      return mapTask(next, getProject(db, next.project_id))
    },

    deleteTask(id: string): void {
      db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
    },

    createWorkLog(taskId: string, input: CreateWorkLogInput): WorkLog {
      const timestamp = nowIso()
      const row: WorkLogRow = {
        id: newId(),
        task_id: taskId,
        worked_on: input.workedOn,
        note: input.note,
        minutes_spent: input.minutesSpent ?? null,
        created_at: timestamp,
        updated_at: timestamp,
      }

      db.prepare(`
        INSERT INTO work_logs (id, task_id, worked_on, note, minutes_spent, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        row.id,
        row.task_id,
        row.worked_on,
        row.note,
        row.minutes_spent,
        row.created_at,
        row.updated_at,
      )

      return mapWorkLog(row)
    },

    listWorkLogs(taskId: string): WorkLog[] {
      const rows = db.prepare(`
        SELECT *
        FROM work_logs
        WHERE task_id = ?
        ORDER BY worked_on DESC, created_at DESC
      `).all(taskId) as WorkLogRow[]
      return rows.map(mapWorkLog)
    },

    listWorkLogsForDate(filters: WorkLogDateFilters): DashboardActivity[] {
      const workLogs: DashboardActivity[] = []
      const params: unknown[] = [filters.workedOn]
      let projectClause = ''
      if (filters.projectId) {
        projectClause = 'AND t.project_id = ?'
        params.push(filters.projectId)
      }

      while (true) {
        const offset = workLogs.length
        const rows = db.prepare(`
          SELECT wl.*, t.id AS task_id_ref, t.project_id, t.jira_url, t.jira_key, t.summary, t.status,
                 t.created_at AS task_created_at, t.updated_at AS task_updated_at, t.completed_at
          FROM work_logs wl
          INNER JOIN tasks t ON t.id = wl.task_id
          WHERE wl.worked_on = ? ${projectClause}
          ORDER BY wl.created_at DESC, wl.id DESC
          LIMIT ? OFFSET ?
        `).all(...params, DASHBOARD_PAGE_SIZE, offset) as Array<WorkLogRow & {
          project_id: string
          jira_url: string
          jira_key: string
          summary: string
          status: TaskStatus
          task_created_at: string
          task_updated_at: string
          completed_at: string | null
        }>

        if (rows.length === 0) break

        workLogs.push(...rows.map(row => ({
          ...mapWorkLog(row),
          task: mapTask({
            id: row.task_id,
            project_id: row.project_id,
            jira_url: row.jira_url,
            jira_key: row.jira_key,
            summary: row.summary,
            status: row.status,
            created_at: row.task_created_at,
            updated_at: row.task_updated_at,
            completed_at: row.completed_at,
          }, getProject(db, row.project_id)),
        })))

        if (rows.length < DASHBOARD_PAGE_SIZE) break
      }

      return workLogs
    },
  }
}

export type TaskRepository = ReturnType<typeof createTaskRepository>
