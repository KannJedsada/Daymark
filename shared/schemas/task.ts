import { z } from 'zod'

import { TASK_STATUSES } from '../types/domain'

const trimmedRequiredString = (maximum: number) => z.string().trim().min(1).max(maximum)

const projectInputSchema = z.object({
  name: trimmedRequiredString(300),
  jiraProjectKey: trimmedRequiredString(100).optional(),
})

export const jiraLookupSchema = z.object({
  jiraUrl: z.url(),
})

export const createTaskSchema = z.object({
  jiraUrl: z.url(),
  jiraKey: trimmedRequiredString(100),
  summary: trimmedRequiredString(300),
  project: projectInputSchema.optional(),
  projectId: z.uuid().optional(),
}).refine(input => input.projectId || input.project, {
  message: 'Project is required',
  path: ['project'],
})

export const patchTaskSchema = z.object({
  jiraUrl: z.url().optional(),
  jiraKey: trimmedRequiredString(100).optional(),
  summary: trimmedRequiredString(300).optional(),
  project: projectInputSchema.optional(),
  projectId: z.uuid().optional(),
  status: z.enum(TASK_STATUSES).optional(),
}).refine(patch => Object.keys(patch).length > 0, {
  message: 'At least one task field is required',
})

export const createWorkLogSchema = z.object({
  workedOn: z.iso.date(),
  note: trimmedRequiredString(2_000),
  minutesSpent: z.int().min(1).max(1_440).optional(),
})

export const taskListQuerySchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  projectId: z.uuid().optional(),
  query: z.string().trim().min(1).max(300).optional(),
  date: z.iso.date().optional(),
})

export const dashboardQuerySchema = z.object({
  projectId: z.uuid().optional(),
  date: z.iso.date().optional(),
})

export const createProjectSchema = z.object({
  name: trimmedRequiredString(300),
  jiraProjectKey: trimmedRequiredString(100).optional(),
})

export const weeklyReportQuerySchema = z.object({
  week: z.iso.date().optional(),
  projectId: z.uuid().optional(),
})

export const taskIdSchema = z.uuid()

export type JiraLookupInput = z.infer<typeof jiraLookupSchema>
export type CreateTaskInput = z.infer<typeof createTaskSchema>
export type PatchTaskInput = z.infer<typeof patchTaskSchema>
export type CreateWorkLogInput = z.infer<typeof createWorkLogSchema>
export type ProjectInput = z.infer<typeof projectInputSchema>
export type TaskListQuery = z.infer<typeof taskListQuerySchema>
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>
export type CreateProjectBody = z.infer<typeof createProjectSchema>
export type WeeklyReportQuery = z.infer<typeof weeklyReportQuerySchema>
