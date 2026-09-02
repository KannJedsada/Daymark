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
  project: projectInputSchema,
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

export const taskIdSchema = z.uuid()

export type JiraLookupInput = z.infer<typeof jiraLookupSchema>
export type CreateTaskInput = z.infer<typeof createTaskSchema>
export type PatchTaskInput = z.infer<typeof patchTaskSchema>
export type CreateWorkLogInput = z.infer<typeof createWorkLogSchema>
export type ProjectInput = z.infer<typeof projectInputSchema>
export type TaskListQuery = z.infer<typeof taskListQuerySchema>
