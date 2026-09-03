import type { SupabaseClient } from '@supabase/supabase-js'

import type { DashboardActivity, Project, TaskStatus, TaskWithProject, WorkLog } from '../../shared/types/domain'

type DatabaseError = { code?: string, message?: string }
type QueryResult = { data: unknown; error: DatabaseError | null; count?: number | null }

interface QueryBuilder extends PromiseLike<QueryResult> {
  delete(): QueryBuilder
  eq(column: string, value: unknown): QueryBuilder
  gte(column: string, value: unknown): QueryBuilder
  ilike(column: string, pattern: string): QueryBuilder
  insert(values: Record<string, unknown>): QueryBuilder
  lte(column: string, value: unknown): QueryBuilder
  maybeSingle(): QueryBuilder
  order(column: string, options?: { ascending?: boolean }): QueryBuilder
  range(from: number, to: number): QueryBuilder
  select(columns?: string, options?: { count?: 'exact' }): QueryBuilder
  single(): QueryBuilder
  update(values: Record<string, unknown>): QueryBuilder
}

export type TaskRepositoryClient = Pick<SupabaseClient, 'from'>

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

export interface WorkLogRangeFilters {
  from: string
  to: string
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
  project: ProjectRow | ProjectRow[]
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

interface DashboardActivityRow extends WorkLogRow {
  task: TaskRow | TaskRow[]
}

const TASK_WITH_PROJECT_COLUMNS = `
  id,
  project_id,
  jira_url,
  jira_key,
  summary,
  status,
  created_at,
  updated_at,
  completed_at,
  project:projects (
    id,
    name,
    jira_project_key,
    created_at,
    updated_at
  )
`

const ACTIVITY_WITH_TASK_COLUMNS = `
  id,
  task_id,
  worked_on,
  note,
  minutes_spent,
  created_at,
  updated_at,
  task:tasks!inner (
    ${TASK_WITH_PROJECT_COLUMNS}
  )
`

const PAGE_SIZE = 1_000

function table(client: TaskRepositoryClient, name: string): QueryBuilder {
  return client.from(name) as unknown as QueryBuilder
}

async function execute(query: QueryBuilder): Promise<unknown> {
  const { data, error } = await query
  if (error) throw new TaskRepositoryError(error.code)
  return data
}

async function executePage(query: QueryBuilder): Promise<{ data: unknown; count: number | null }> {
  const { data, error, count = null } = await query
  if (error) throw new TaskRepositoryError(error.code)
  return { data, count }
}

export class TaskRepositoryError extends Error {
  constructor(public readonly databaseCode?: string) {
    super('TASK_REPOSITORY_QUERY_FAILED')
    this.name = 'TaskRepositoryError'
  }
}

function mapProject(row: ProjectRow): Project {
  return { id: row.id, name: row.name, jiraProjectKey: row.jira_project_key, createdAt: row.created_at, updatedAt: row.updated_at }
}

function mapTask(row: TaskRow): TaskWithProject {
  const project = Array.isArray(row.project) ? row.project[0] : row.project
  if (!project) throw new Error(`SUPABASE_INVALID_TASK_ROW: project missing for task ${row.id}`)
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
    project: mapProject(project),
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

function mapActivity(row: DashboardActivityRow): DashboardActivity {
  const task = Array.isArray(row.task) ? row.task[0] : row.task
  if (!task) throw new Error(`SUPABASE_INVALID_WORK_LOG_ROW: task missing for work log ${row.id}`)
  return { ...mapWorkLog(row), task: mapTask(task) }
}

function taskPayload(input: CreateTaskInput | UpdateTaskInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  if (input.projectId !== undefined) payload.project_id = input.projectId
  if (input.jiraUrl !== undefined) payload.jira_url = input.jiraUrl
  if (input.jiraKey !== undefined) payload.jira_key = input.jiraKey.toUpperCase()
  if (input.summary !== undefined) payload.summary = input.summary
  if (input.status !== undefined) payload.status = input.status
  if (input.completedAt !== undefined) payload.completed_at = input.completedAt
  return payload
}

async function findProjectForUpsert(
  client: TaskRepositoryClient,
  name: string,
  jiraProjectKey: string | null,
): Promise<ProjectRow | null> {
  if (jiraProjectKey) {
    const byKey = await execute(table(client, 'projects').select().eq('jira_project_key', jiraProjectKey).maybeSingle()) as ProjectRow | null
    if (byKey) return byKey
  }
  return await execute(table(client, 'projects').select().eq('name', name).maybeSingle()) as ProjectRow | null
}

async function collectActivities(client: TaskRepositoryClient, configure: (query: QueryBuilder) => QueryBuilder): Promise<DashboardActivity[]> {
  const activities: DashboardActivity[] = []
  while (true) {
    let query = table(client, 'work_logs')
      .select(ACTIVITY_WITH_TASK_COLUMNS, { count: 'exact' })
      .order('worked_on', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
    query = configure(query).range(activities.length, activities.length + PAGE_SIZE - 1)
    const page = await executePage(query)
    const rows = (page.data ?? []) as DashboardActivityRow[]
    activities.push(...rows.map(mapActivity))
    if (rows.length === 0 || (page.count !== null && activities.length >= page.count)) break
    if (page.count === null && rows.length < PAGE_SIZE) break
  }
  return activities
}

export function createTaskRepository(client: TaskRepositoryClient) {
  return {
    async listTasks(filters: TaskFilters = {}): Promise<TaskWithProject[]> {
      let query = table(client, 'tasks')
        .select(filters.date ? `${TASK_WITH_PROJECT_COLUMNS}, work_logs!inner(worked_on)` : TASK_WITH_PROJECT_COLUMNS)
        .order('updated_at', { ascending: false })
      if (filters.status) query = query.eq('status', filters.status)
      if (filters.projectId) query = query.eq('project_id', filters.projectId)
      if (filters.query) query = query.ilike('summary', `%${filters.query}%`)
      if (filters.date) query = query.eq('work_logs.worked_on', filters.date)
      const rows = await execute(query) as TaskRow[] | null
      return (rows ?? []).map(mapTask)
    },

    async listDashboardTasks(filters: Pick<TaskFilters, 'projectId'> = {}): Promise<TaskWithProject[]> {
      const tasks: TaskWithProject[] = []
      while (true) {
        let query = table(client, 'tasks').select(TASK_WITH_PROJECT_COLUMNS, { count: 'exact' })
          .order('updated_at', { ascending: false }).order('id', { ascending: false })
        if (filters.projectId) query = query.eq('project_id', filters.projectId)
        query = query.range(tasks.length, tasks.length + PAGE_SIZE - 1)
        const page = await executePage(query)
        const rows = (page.data ?? []) as TaskRow[]
        tasks.push(...rows.map(mapTask))
        if (rows.length === 0 || (page.count !== null && tasks.length >= page.count)) break
        if (page.count === null && rows.length < PAGE_SIZE) break
      }
      return tasks
    },

    async findTaskById(id: string): Promise<TaskWithProject | null> {
      const row = await execute(table(client, 'tasks').select(TASK_WITH_PROJECT_COLUMNS).eq('id', id).maybeSingle()) as TaskRow | null
      return row ? mapTask(row) : null
    },

    async findTaskByJiraKey(key: string): Promise<TaskWithProject | null> {
      const row = await execute(table(client, 'tasks').select(TASK_WITH_PROJECT_COLUMNS).eq('jira_key', key.toUpperCase()).maybeSingle()) as TaskRow | null
      return row ? mapTask(row) : null
    },

    async listProjects(): Promise<Project[]> {
      const rows = await execute(table(client, 'projects').select().order('name', { ascending: true })) as ProjectRow[] | null
      return (rows ?? []).map(mapProject)
    },

    async findProjectById(id: string): Promise<Project | null> {
      const row = await execute(table(client, 'projects').select().eq('id', id).maybeSingle()) as ProjectRow | null
      return row ? mapProject(row) : null
    },

    async upsertProject(input: ProjectInput): Promise<Project> {
      const jiraProjectKey = input.jiraProjectKey?.toUpperCase() ?? null
      try {
        const existing = await findProjectForUpsert(client, input.name, jiraProjectKey)
        if (existing) {
          if (jiraProjectKey && existing.jira_project_key === jiraProjectKey && existing.name !== input.name) {
            const row = await execute(table(client, 'projects').update({ name: input.name }).eq('id', existing.id).select().single()) as ProjectRow
            return mapProject(row)
          }
          if (jiraProjectKey && !existing.jira_project_key) {
            const row = await execute(table(client, 'projects').update({ jira_project_key: jiraProjectKey }).eq('id', existing.id).select().single()) as ProjectRow
            return mapProject(row)
          }
          return mapProject(existing)
        }
        const row = await execute(table(client, 'projects').insert({ name: input.name, jira_project_key: jiraProjectKey }).select().single()) as ProjectRow
        return mapProject(row)
      }
      catch (error) {
        if (!(error instanceof TaskRepositoryError) || error.databaseCode !== '23505') throw error
        const concurrent = await findProjectForUpsert(client, input.name, jiraProjectKey)
        if (!concurrent) throw error
        return mapProject(concurrent)
      }
    },

    async createTask(input: CreateTaskInput): Promise<TaskWithProject> {
      const row = await execute(table(client, 'tasks').insert(taskPayload(input)).select(TASK_WITH_PROJECT_COLUMNS).single()) as TaskRow
      return mapTask(row)
    },

    async updateTask(id: string, patch: UpdateTaskInput): Promise<TaskWithProject> {
      const row = await execute(table(client, 'tasks').update(taskPayload(patch)).eq('id', id).select(TASK_WITH_PROJECT_COLUMNS).single()) as TaskRow
      return mapTask(row)
    },

    async deleteTask(id: string): Promise<void> {
      await execute(table(client, 'tasks').delete().eq('id', id))
    },

    async createWorkLog(taskId: string, input: CreateWorkLogInput): Promise<WorkLog> {
      const row = await execute(table(client, 'work_logs').insert({
        task_id: taskId,
        worked_on: input.workedOn,
        note: input.note,
        minutes_spent: input.minutesSpent ?? null,
      }).select().single()) as WorkLogRow
      return mapWorkLog(row)
    },

    async listWorkLogs(taskId: string): Promise<WorkLog[]> {
      const rows = await execute(table(client, 'work_logs').select().eq('task_id', taskId)
        .order('worked_on', { ascending: false }).order('created_at', { ascending: false })) as WorkLogRow[] | null
      return (rows ?? []).map(mapWorkLog)
    },

    async listWorkLogsForDate(filters: WorkLogDateFilters): Promise<DashboardActivity[]> {
      return collectActivities(client, (query) => {
        let filtered = query.eq('worked_on', filters.workedOn)
        if (filters.projectId) filtered = filtered.eq('task.project_id', filters.projectId)
        return filtered
      })
    },

    async listWorkLogsForRange(filters: WorkLogRangeFilters): Promise<DashboardActivity[]> {
      return collectActivities(client, (query) => {
        let filtered = query.gte('worked_on', filters.from).lte('worked_on', filters.to)
        if (filters.projectId) filtered = filtered.eq('task.project_id', filters.projectId)
        return filtered
      })
    },
  }
}

export type TaskRepository = ReturnType<typeof createTaskRepository>
