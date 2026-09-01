import { z } from 'zod'

const ISSUE_KEY_PATTERN = /^[A-Z][A-Z0-9_]+-\d+$/
const REQUEST_TIMEOUT_MS = 10_000

const jiraResponseSchema = z.object({
  fields: z.object({
    summary: z.string().min(1).max(300),
    project: z.object({
      name: z.string().min(1).max(300),
      key: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/),
    }),
  }),
})

export const JIRA_ERROR_CODES = [
  'JIRA_CONFIG_ERROR',
  'JIRA_INVALID_URL',
  'JIRA_ORIGIN_MISMATCH',
  'JIRA_UNAUTHORIZED',
  'JIRA_NOT_FOUND',
  'JIRA_TIMEOUT',
  'JIRA_INVALID_RESPONSE',
  'JIRA_UPSTREAM_ERROR',
] as const

export type JiraErrorCode = typeof JIRA_ERROR_CODES[number]

export class JiraError extends Error {
  readonly code: JiraErrorCode

  constructor(code: JiraErrorCode) {
    super(code)
    this.name = 'JiraError'
    this.code = code
  }
}

export interface JiraConfig {
  baseUrl: string
  email: string
  apiToken: string
}

export interface JiraIssue {
  jiraKey: string
  jiraUrl: string
  summary: string
  project: {
    name: string
    jiraProjectKey: string
  }
}

export interface JiraClient {
  lookupIssue(jiraUrl: string): Promise<JiraIssue>
}

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

function parseConfiguredOrigin(baseUrl: string): string {
  try {
    const url = new URL(baseUrl)
    if (
      !['http:', 'https:'].includes(url.protocol)
      || url.username
      || url.password
      || (url.pathname !== '/' && url.pathname !== '')
      || url.search
      || url.hash
    ) {
      throw new JiraError('JIRA_CONFIG_ERROR')
    }
    return url.origin
  }
  catch (error) {
    if (error instanceof JiraError) throw error
    throw new JiraError('JIRA_CONFIG_ERROR')
  }
}

export function parseJiraIssueUrl(jiraUrl: string, configuredBaseUrl: string): {
  jiraKey: string
  jiraUrl: string
} {
  const configuredOrigin = parseConfiguredOrigin(configuredBaseUrl)
  let url: URL

  try {
    url = new URL(jiraUrl)
  }
  catch {
    throw new JiraError('JIRA_INVALID_URL')
  }

  if (url.origin !== configuredOrigin) {
    throw new JiraError('JIRA_ORIGIN_MISMATCH')
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new JiraError('JIRA_INVALID_URL')
  }

  const pathMatch = /^\/browse\/([^/]+)$/.exec(url.pathname)
  const jiraKey = pathMatch?.[1]?.toUpperCase()
  if (!jiraKey || !ISSUE_KEY_PATTERN.test(jiraKey)) {
    throw new JiraError('JIRA_INVALID_URL')
  }

  return {
    jiraKey,
    jiraUrl: `${configuredOrigin}/browse/${jiraKey}`,
  }
}

function validateConfig(config: JiraConfig): { origin: string, email: string, apiToken: string } {
  if (!config.email.trim() || !config.apiToken.trim()) {
    throw new JiraError('JIRA_CONFIG_ERROR')
  }
  return {
    origin: parseConfiguredOrigin(config.baseUrl),
    email: config.email,
    apiToken: config.apiToken,
  }
}

export function createJiraClient(config: JiraConfig, fetcher: Fetcher = fetch): JiraClient {
  const validatedConfig = validateConfig(config)

  return {
    async lookupIssue(issueUrl) {
      const parsedIssue = parseJiraIssueUrl(issueUrl, validatedConfig.origin)
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

      try {
        const response = await fetcher(
          `${validatedConfig.origin}/rest/api/3/issue/${parsedIssue.jiraKey}?fields=summary,project`,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              Authorization: `Basic ${Buffer.from(`${validatedConfig.email}:${validatedConfig.apiToken}`).toString('base64')}`,
            },
            signal: controller.signal,
          },
        )

        if (response.status === 401 || response.status === 403) {
          throw new JiraError('JIRA_UNAUTHORIZED')
        }
        if (response.status === 404) {
          throw new JiraError('JIRA_NOT_FOUND')
        }
        if (!response.ok) {
          throw new JiraError('JIRA_UPSTREAM_ERROR')
        }

        let upstream: z.infer<typeof jiraResponseSchema>
        try {
          upstream = jiraResponseSchema.parse(await response.json())
        }
        catch (error) {
          if (controller.signal.aborted) throw error
          throw new JiraError('JIRA_INVALID_RESPONSE')
        }

        return {
          ...parsedIssue,
          summary: upstream.fields.summary,
          project: {
            name: upstream.fields.project.name,
            jiraProjectKey: upstream.fields.project.key.toUpperCase(),
          },
        }
      }
      catch (error) {
        if (error instanceof JiraError) throw error
        if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
          throw new JiraError('JIRA_TIMEOUT')
        }
        throw new JiraError('JIRA_UPSTREAM_ERROR')
      }
      finally {
        clearTimeout(timeout)
      }
    },
  }
}
