import { defineEventHandler, getRouterParam, readValidatedBody, setResponseStatus, type H3Event } from 'h3'

import { createWorkLogSchema, taskIdSchema, type CreateWorkLogInput } from '../../../../shared/schemas/task'
import type { TaskService } from '../../../services/tasks'
import { throwTaskApiError, useTaskService } from '../../../utils/task-api'

interface Dependencies {
  service: () => TaskService
  id: (event: H3Event) => unknown
  readBody: (event: H3Event, validate: (body: unknown) => CreateWorkLogInput | Promise<CreateWorkLogInput>) => Promise<CreateWorkLogInput>
  setStatus: (event: H3Event, status: number) => void
}

export function createWorkLogHandler(dependencies: Dependencies) {
  return defineEventHandler(async (event) => {
    try {
      const id = taskIdSchema.parse(dependencies.id(event))
      const body = await dependencies.readBody(event, createWorkLogSchema.parse)
      const workLog = await dependencies.service().createWorkLog(id, body)
      dependencies.setStatus(event, 201)
      return workLog
    }
    catch (error) {
      throwTaskApiError(error)
    }
  })
}

export default createWorkLogHandler({
  service: useTaskService,
  id: event => getRouterParam(event, 'id'),
  readBody: (event, validate) => readValidatedBody(event, validate),
  setStatus: setResponseStatus,
})
