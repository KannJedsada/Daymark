import { defineEventHandler, readValidatedBody, setResponseStatus } from 'h3'

import { createProjectSchema } from '../../../shared/schemas/task'
import { throwProjectApiError, useProjectService } from '../../utils/project-api'

export default defineEventHandler(async (event) => {
  try {
    const body = await readValidatedBody(event, createProjectSchema.parse)
    const project = await useProjectService().createProject(body)
    setResponseStatus(event, 201)
    return project
  }
  catch (error) {
    throwProjectApiError(error)
  }
})
