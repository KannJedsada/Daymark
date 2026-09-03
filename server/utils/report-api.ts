import { createError, isError } from 'h3'
import { ZodError } from 'zod'

import { createReportService, type ReportService } from '../services/reports'
import { createServerTaskRepository } from './repository'

export interface ReportApiErrorBody {
  code: 'VALIDATION_ERROR' | 'STORAGE_ERROR'
  message: string
}

export function useReportService(): ReportService {
  return createReportService(createServerTaskRepository())
}

export function throwReportApiError(error: unknown): never {
  let statusCode = 500
  let body: ReportApiErrorBody = { code: 'STORAGE_ERROR', message: 'Unable to load the report.' }

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
