import { createError, defineEventHandler, isError, readValidatedBody, type H3Event } from 'h3'
import { ZodError } from 'zod'

import { jiraLookupSchema, type JiraLookupInput } from '../../../shared/schemas/task'
import {
  JiraError,
  createJiraClient,
  type JiraClient,
  type JiraConfig,
  type JiraErrorCode,
} from '../../utils/jira'

interface JiraRuntimeConfig {
  jiraBaseUrl: string
  jiraEmail: string
  jiraApiToken: string
}

interface JiraLookupDependencies {
  readBody: (
    event: H3Event,
    validate: (body: unknown) => JiraLookupInput | Promise<JiraLookupInput>,
  ) => Promise<JiraLookupInput>
  runtimeConfig: () => JiraRuntimeConfig
  createClient: (config: JiraConfig) => JiraClient
}

const errorResponses: Record<JiraErrorCode, {
  statusCode: number
  code: JiraErrorCode | 'JIRA_INVALID_URL'
  message: string
}> = {
  JIRA_CONFIG_ERROR: { statusCode: 500, code: 'JIRA_CONFIG_ERROR', message: 'Jira lookup is not configured.' },
  JIRA_INVALID_URL: { statusCode: 422, code: 'JIRA_INVALID_URL', message: 'Enter a valid Jira issue URL.' },
  JIRA_ORIGIN_MISMATCH: { statusCode: 422, code: 'JIRA_INVALID_URL', message: 'Enter a valid Jira issue URL.' },
  JIRA_UNAUTHORIZED: { statusCode: 502, code: 'JIRA_UNAUTHORIZED', message: 'Jira authentication failed.' },
  JIRA_NOT_FOUND: { statusCode: 404, code: 'JIRA_NOT_FOUND', message: 'Jira issue was not found.' },
  JIRA_TIMEOUT: { statusCode: 504, code: 'JIRA_TIMEOUT', message: 'Jira did not respond in time.' },
  JIRA_INVALID_RESPONSE: { statusCode: 502, code: 'JIRA_INVALID_RESPONSE', message: 'Jira returned an invalid response.' },
  JIRA_UPSTREAM_ERROR: { statusCode: 502, code: 'JIRA_UPSTREAM_ERROR', message: 'Jira lookup failed.' },
}

function safeRouteError(error: unknown): never {
  const response = error instanceof ZodError || (isError(error) && error.statusCode === 400)
    ? errorResponses.JIRA_INVALID_URL
    : error instanceof JiraError
      ? errorResponses[error.code]
      : { statusCode: 500, code: 'JIRA_UPSTREAM_ERROR' as const, message: 'Jira lookup failed.' }

  throw createError({
    statusCode: response.statusCode,
    statusMessage: response.message,
    message: response.message,
    data: { code: response.code, message: response.message },
  })
}

export function createJiraLookupHandler(dependencies: JiraLookupDependencies) {
  return defineEventHandler(async (event) => {
    try {
      const body = await dependencies.readBody(event, jiraLookupSchema.parse)
      const runtimeConfig = dependencies.runtimeConfig()
      const client = dependencies.createClient({
        baseUrl: runtimeConfig.jiraBaseUrl,
        email: runtimeConfig.jiraEmail,
        apiToken: runtimeConfig.jiraApiToken,
      })
      return await client.lookupIssue(body.jiraUrl)
    }
    catch (error) {
      safeRouteError(error)
    }
  })
}

export default createJiraLookupHandler({
  readBody: (event, validate) => readValidatedBody(event, validate),
  runtimeConfig: () => useRuntimeConfig(),
  createClient: createJiraClient,
})
