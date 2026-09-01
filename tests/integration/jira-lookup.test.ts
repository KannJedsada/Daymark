import { createError } from 'h3'
import { describe, expect, it, vi } from 'vitest'

import { JiraError } from '../../server/utils/jira'
import { createJiraLookupHandler } from '../../server/api/jira/lookup.post'

describe('POST /api/jira/lookup', () => {
  it('returns the normalized Jira issue', async () => {
    const issue = {
      jiraKey: 'OPS-421',
      jiraUrl: 'https://acme.atlassian.net/browse/OPS-421',
      summary: 'Order status API',
      project: { name: 'Operations', jiraProjectKey: 'OPS' },
    }
    const lookupIssue = vi.fn(async () => issue)
    const handler = createJiraLookupHandler({
      readBody: vi.fn(async (_event, validate) => validate({
        jiraUrl: 'https://acme.atlassian.net/browse/ops-421',
      })),
      runtimeConfig: () => ({
        jiraBaseUrl: 'https://acme.atlassian.net', jiraEmail: 'dev@example.com', jiraApiToken: 'token',
      }),
      createClient: vi.fn(() => ({ lookupIssue })),
    })

    await expect(handler({} as never)).resolves.toEqual(issue)
    expect(lookupIssue).toHaveBeenCalledWith('https://acme.atlassian.net/browse/ops-421')
  })

  it('maps an invalid Jira URL to a safe non-blocking 422 response', async () => {
    const handler = createJiraLookupHandler({
      readBody: vi.fn(async (_event, validate) => validate({ jiraUrl: 'https://evil.example/browse/OPS-421' })),
      runtimeConfig: () => ({
        jiraBaseUrl: 'https://acme.atlassian.net', jiraEmail: 'dev@example.com', jiraApiToken: 'token',
      }),
      createClient: vi.fn(() => ({
        lookupIssue: vi.fn(async () => { throw new JiraError('JIRA_ORIGIN_MISMATCH') }),
      })),
    })

    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 422,
      data: { code: 'JIRA_INVALID_URL', message: 'Enter a valid Jira issue URL.' },
    })
  })

  it('maps body validation failures wrapped by H3 to the same safe 422 response', async () => {
    const handler = createJiraLookupHandler({
      readBody: vi.fn(async () => { throw createError({ statusCode: 400, message: 'sensitive validator detail' }) }),
      runtimeConfig: vi.fn(),
      createClient: vi.fn(),
    })

    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 422,
      data: { code: 'JIRA_INVALID_URL', message: 'Enter a valid Jira issue URL.' },
    })
  })
})
