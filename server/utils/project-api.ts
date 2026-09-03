import { createError, isError } from 'h3'
import { ZodError } from 'zod'

import { createProjectService, type ProjectService } from '../services/projects'
import { createServerTaskRepository } from './repository'

export interface ProjectApiErrorBody {
  code: 'VALIDATION_ERROR' | 'STORAGE_ERROR'
  message: string
}

export function useProjectService(): ProjectService {
  return createProjectService(createServerTaskRepository())
}

export function throwProjectApiError(error: unknown): never {
  let statusCode = 500
  let body: ProjectApiErrorBody = { code: 'STORAGE_ERROR', message: 'Unable to complete the request.' }

  if (error instanceof ZodError || (isError(error) && error.statusCode === 400)) {
    statusCode = 422
    body = { code: 'VALIDATION_ERROR', message: 'The request is invalid.' }
  }

  throw createError({
    statusCode,
    statusMessage: body.message,
    message: body.message,
    data: body,
  })
}
