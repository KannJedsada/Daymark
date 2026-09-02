import { defineEventHandler, getRouterParam, type H3Event } from 'h3'

import { taskIdSchema } from '../../../shared/schemas/task'
import type { TaskService } from '../../services/tasks'
import { throwTaskApiError, useTaskService } from '../../utils/task-api'

interface Dependencies {
  service: () => TaskService
  id: (event: H3Event) => unknown
}

export function createGetTaskHandler(dependencies: Dependencies) {
  return defineEventHandler(async (event) => {
    try {
      const id = taskIdSchema.parse(dependencies.id(event))
      return await dependencies.service().getTask(id)
    }
    catch (error) {
      throwTaskApiError(error)
    }
  })
}

export default createGetTaskHandler({ service: useTaskService, id: event => getRouterParam(event, 'id') })
