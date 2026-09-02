import { defineEventHandler, readValidatedBody, setResponseStatus, type H3Event } from 'h3'

import { createTaskSchema, type CreateTaskInput } from '../../../shared/schemas/task'
import type { TaskService } from '../../services/tasks'
import { duplicateTaskError, throwTaskApiError, useTaskService } from '../../utils/task-api'

interface Dependencies {
  service: () => TaskService
  readBody: (event: H3Event, validate: (body: unknown) => CreateTaskInput | Promise<CreateTaskInput>) => Promise<CreateTaskInput>
  setStatus: (event: H3Event, status: number) => void
}

export function createCreateTaskHandler(dependencies: Dependencies) {
  return defineEventHandler(async (event) => {
    let result
    try {
      const body = await dependencies.readBody(event, createTaskSchema.parse)
      result = await dependencies.service().createTask(body)
    }
    catch (error) {
      throwTaskApiError(error)
    }
    if (result.kind === 'duplicate') duplicateTaskError(result.task)
    dependencies.setStatus(event, 201)
    return result.task
  })
}

export default createCreateTaskHandler({
  service: useTaskService,
  readBody: (event, validate) => readValidatedBody(event, validate),
  setStatus: setResponseStatus,
})
