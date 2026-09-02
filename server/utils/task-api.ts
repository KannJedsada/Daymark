import { createError, isError } from 'h3'
import { ZodError } from 'zod'

import { createTaskRepository } from '../repositories/tasks'
import { createTaskService, TaskServiceError, type TaskService } from '../services/tasks'
import { getDatabase } from './database'

export interface TaskApiErrorBody {
  code: 'VALIDATION_ERROR' | 'TASK_NOT_FOUND' | 'DUPLICATE_JIRA' | 'STORAGE_ERROR'
  message: string
}

export function useTaskService(): TaskService {
  return createTaskService(createTaskRepository(getDatabase()))
}

export function throwTaskApiError(error: unknown): never {
  let statusCode = 500
  let body: TaskApiErrorBody = { code: 'STORAGE_ERROR', message: 'Unable to complete the request.' }

  if (error instanceof ZodError || (isError(error) && error.statusCode === 400)) {
    statusCode = 422
    body = { code: 'VALIDATION_ERROR', message: 'The request is invalid.' }
  }
  else if (error instanceof TaskServiceError && error.code === 'TASK_NOT_FOUND') {
    statusCode = 404
    body = { code: 'TASK_NOT_FOUND', message: 'Task not found.' }
  }

  throw createError({
    statusCode,
    statusMessage: body.message,
    message: body.message,
    data: body,
  })
}

export function duplicateTaskError(task: unknown): never {
  const body: TaskApiErrorBody = { code: 'DUPLICATE_JIRA', message: 'A task already exists for this Jira issue.' }
  throw createError({
    statusCode: 409,
    statusMessage: body.message,
    message: body.message,
    data: { ...body, task },
  })
}
