import { defineEventHandler, getQuery } from 'h3'

import { weeklyReportQuerySchema } from '../../../shared/schemas/task'
import { throwReportApiError, useReportService } from '../../utils/report-api'

export default defineEventHandler(async (event) => {
  try {
    const query = weeklyReportQuerySchema.parse(getQuery(event))
    return useReportService().getWeeklyReport(query)
  }
  catch (error) {
    throwReportApiError(error)
  }
})
