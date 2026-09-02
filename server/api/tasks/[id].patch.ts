import { defineEventHandler, getRouterParam, readValidatedBody, type H3Event } from 'h3'

import { patchTaskSchema, taskIdSchema, type PatchTaskInput } from '../../../shared/schemas/task'
import type { TaskService } from '../../services/tasks'
import { throwTaskApiError, useTaskService } from '../../utils/task-api'

interface Dependencies {
  service: () => TaskService
  id: (event: H3Event) => unknown
  readBody: (event: H3Event, validate: (body: unknown) => PatchTaskInput | Promise<PatchTaskInput>) => Promise<PatchTaskInput>
}

export function createPatchTaskHandler(dependencies: Dependencies) {
  return defineEventHandler(async (event) => {
    try {
      const id = taskIdSchema.parse(dependencies.id(event))
      const body = await dependencies.readBody(event, patchTaskSchema.parse)
      return await dependencies.service().updateTask(id, body)
    }
    catch (error) {
      throwTaskApiError(error)
    }
  })
}

export default createPatchTaskHandler({
  service: useTaskService,
  id: event => getRouterParam(event, 'id'),
  readBody: (event, validate) => readValidatedBody(event, validate),
})
