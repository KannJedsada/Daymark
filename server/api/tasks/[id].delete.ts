import { defineEventHandler, getRouterParam, setResponseStatus, type H3Event } from 'h3'

import { taskIdSchema } from '../../../shared/schemas/task'
import type { TaskService } from '../../services/tasks'
import { throwTaskApiError, useTaskService } from '../../utils/task-api'

interface Dependencies {
  service: () => TaskService
  id: (event: H3Event) => unknown
  setStatus: (event: H3Event, status: number) => void
}

export function createDeleteTaskHandler(dependencies: Dependencies) {
  return defineEventHandler(async (event) => {
    try {
      const id = taskIdSchema.parse(dependencies.id(event))
      await dependencies.service().deleteTask(id)
      dependencies.setStatus(event, 204)
      return null
    }
    catch (error) {
      throwTaskApiError(error)
    }
  })
}

export default createDeleteTaskHandler({
  service: useTaskService,
  id: event => getRouterParam(event, 'id'),
  setStatus: setResponseStatus,
})
