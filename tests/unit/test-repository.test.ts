import { afterEach, describe, expect, it } from 'vitest'

import { createServerTaskRepository, resetE2ETestRepository } from '../../server/utils/repository'

const config = { e2eTestMode: true }
const previousNodeEnv = process.env.NODE_ENV

afterEach(() => {
  process.env.NODE_ENV = previousNodeEnv
})

describe('E2E test repository guard', () => {
  it('keeps deterministic in-memory state until explicitly reset', async () => {
    process.env.NODE_ENV = 'test'
    resetE2ETestRepository(config)
    const repository = createServerTaskRepository(config)
    await repository.upsertProject({ name: 'Operations' })

    await expect(createServerTaskRepository(config).listProjects()).resolves.toHaveLength(1)
    resetE2ETestRepository(config)
    await expect(createServerTaskRepository(config).listProjects()).resolves.toEqual([])
  })

  it('rejects test mode in production', () => {
    process.env.NODE_ENV = 'production'
    expect(() => createServerTaskRepository(config)).toThrow('E2E_TEST_MODE_FORBIDDEN_IN_PRODUCTION')
    expect(() => resetE2ETestRepository(config)).toThrow('E2E_TEST_MODE_DISABLED')
  })
})
