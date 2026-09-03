import { defineEventHandler } from 'h3'

import { throwProjectApiError, useProjectService } from '../../utils/project-api'

export default defineEventHandler(async () => {
  try {
    return await useProjectService().listProjects()
  }
  catch (error) {
    throwProjectApiError(error)
  }
})
