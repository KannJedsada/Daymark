import { createError, defineEventHandler, getQuery, type H3Event } from 'h3'
import { ZodError } from 'zod'

import { dashboardQuerySchema } from '../../shared/schemas/task'
import { createTaskRepository } from '../repositories/tasks'
import { createDashboardService, type DashboardService } from '../services/dashboard'
import { getDatabase } from '../utils/database'

interface Dependencies {
  service: () => DashboardService
  query: (event: H3Event) => unknown
}

export function useDashboardService(): DashboardService {
  return createDashboardService(createTaskRepository(getDatabase()))
}

export function createDashboardHandler(dependencies: Dependencies) {
  return defineEventHandler(async (event) => {
    try {
      const filters = dashboardQuerySchema.parse(dependencies.query(event))
      return await dependencies.service().getSummary(filters)
    }
    catch (error) {
      const validationError = error instanceof ZodError
      const body = validationError
        ? { code: 'VALIDATION_ERROR' as const, message: 'The request is invalid.' }
        : { code: 'STORAGE_ERROR' as const, message: 'Unable to load the dashboard.' }

      throw createError({
        statusCode: validationError ? 422 : 500,
        statusMessage: body.message,
        message: body.message,
        data: body,
      })
    }
  })
}

export default createDashboardHandler({ service: useDashboardService, query: getQuery })
