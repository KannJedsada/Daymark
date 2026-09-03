import { createError, defineEventHandler } from 'h3'

import { isE2ETestMode, resetE2ETestRepository } from '../../utils/repository'

export default defineEventHandler(() => {
  if (!isE2ETestMode()) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }
  resetE2ETestRepository()
  return { ok: true }
})
