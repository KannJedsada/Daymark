import { defineEventHandler, getQuery, type H3Event } from 'h3'

import { taskListQuerySchema } from '../../../shared/schemas/task'
import type { TaskService } from '../../services/tasks'
import { throwTaskApiError, useTaskService } from '../../utils/task-api'

interface Dependencies {
  service: () => TaskService
  query: (event: H3Event) => unknown
}

export function createListTasksHandler(dependencies: Dependencies) {
  return defineEventHandler(async (event) => {
    try {
      const query = taskListQuerySchema.parse(dependencies.query(event))
      return await dependencies.service().listTasks(query)
    }
    catch (error) {
      throwTaskApiError(error)
    }
  })
}

export default createListTasksHandler({ service: useTaskService, query: getQuery })
