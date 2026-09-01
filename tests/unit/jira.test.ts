import { describe, expect, it, vi } from 'vitest'

import { JiraError, createJiraClient, parseJiraIssueUrl } from '../../server/utils/jira'

const config = {
  baseUrl: 'https://acme.atlassian.net',
  email: 'dev@example.com',
  apiToken: 'secret-token',
}

describe('parseJiraIssueUrl', () => {
  it('extracts and normalizes a key from the configured Jira origin', () => {
    expect(parseJiraIssueUrl('https://acme.atlassian.net/browse/ops-421', config.baseUrl))
      .toEqual({ jiraKey: 'OPS-421', jiraUrl: 'https://acme.atlassian.net/browse/OPS-421' })
  })

  it('rejects another origin', () => {
    expect(() => parseJiraIssueUrl('https://evil.example/browse/OPS-421', config.baseUrl))
      .toThrow('JIRA_ORIGIN_MISMATCH')
  })

  it.each([
    'https://acme.atlassian.net/issues/OPS-421',
    'https://acme.atlassian.net/browse/OPS-421/extra',
    'https://acme.atlassian.net/browse/421',
    'https://user@acme.atlassian.net/browse/OPS-421',
    'https://acme.atlassian.net/browse/OPS-421?redirect=true',
  ])('rejects a non-canonical issue URL: %s', (jiraUrl) => {
    expect(() => parseJiraIssueUrl(jiraUrl, config.baseUrl)).toThrow(JiraError)
  })
})

describe('createJiraClient', () => {
  it('requests only summary and project and normalizes the response', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      fields: {
        summary: 'Order status API',
        project: { name: 'Operations', key: 'ops' },
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } }))

    const result = await createJiraClient(config, fetcher).lookupIssue(
      'https://acme.atlassian.net/browse/ops-421',
    )

    expect(fetcher).toHaveBeenCalledOnce()
    const [url, init] = fetcher.mock.calls[0]!
    expect(url).toBe('https://acme.atlassian.net/rest/api/3/issue/OPS-421?fields=summary,project')
    expect(init.headers).toEqual({
      Accept: 'application/json',
      Authorization: `Basic ${Buffer.from('dev@example.com:secret-token').toString('base64')}`,
    })
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(result).toEqual({
      jiraKey: 'OPS-421',
      jiraUrl: 'https://acme.atlassian.net/browse/OPS-421',
      summary: 'Order status API',
      project: { name: 'Operations', jiraProjectKey: 'OPS' },
    })
  })

  it.each([
    [401, 'JIRA_UNAUTHORIZED'],
    [403, 'JIRA_UNAUTHORIZED'],
    [404, 'JIRA_NOT_FOUND'],
    [500, 'JIRA_UPSTREAM_ERROR'],
  ] as const)('maps status %i to %s without reading an upstream body', async (status, code) => {
    const json = vi.fn()
    const fetcher = vi.fn(async () => ({ ok: false, status, json }) as unknown as Response)

    await expect(createJiraClient(config, fetcher).lookupIssue(
      'https://acme.atlassian.net/browse/OPS-421',
    )).rejects.toMatchObject({ code })
    expect(json).not.toHaveBeenCalled()
  })

  it('rejects an invalid successful response', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ fields: { summary: 'Missing project' } })))

    await expect(createJiraClient(config, fetcher).lookupIssue(
      'https://acme.atlassian.net/browse/OPS-421',
    )).rejects.toMatchObject({ code: 'JIRA_INVALID_RESPONSE' })
  })

  it('aborts an upstream request after ten seconds', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    }))
    const lookup = createJiraClient(config, fetcher).lookupIssue(
      'https://acme.atlassian.net/browse/OPS-421',
    )
    const rejection = expect(lookup).rejects.toMatchObject({ code: 'JIRA_TIMEOUT' })

    await vi.advanceTimersByTimeAsync(10_000)
    await rejection
    vi.useRealTimers()
  })
})
