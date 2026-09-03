import { createMemoryState, createMemoryTaskRepository } from '../repositories/memory'
import { createTaskRepository, type TaskRepository } from '../repositories/tasks'
import { createServerSupabaseClient } from './supabase'

interface RepositoryRuntimeConfig {
  e2eTestMode: boolean | string
}

let memoryRepository: TaskRepository | null = null

function testModeEnabled(config: RepositoryRuntimeConfig): boolean {
  return config.e2eTestMode === true || config.e2eTestMode === 'true'
}

export function isE2ETestMode(config: RepositoryRuntimeConfig = useRuntimeConfig()): boolean {
  return process.env.NODE_ENV !== 'production' && testModeEnabled(config)
}

export function createServerTaskRepository(
  config: RepositoryRuntimeConfig = useRuntimeConfig(),
): TaskRepository {
  if (testModeEnabled(config)) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('E2E_TEST_MODE_FORBIDDEN_IN_PRODUCTION')
    }
    memoryRepository ??= createMemoryTaskRepository(createMemoryState())
    return memoryRepository
  }
  return createTaskRepository(createServerSupabaseClient())
}

export function resetE2ETestRepository(config: RepositoryRuntimeConfig = useRuntimeConfig()): void {
  if (!isE2ETestMode(config)) throw new Error('E2E_TEST_MODE_DISABLED')
  memoryRepository = createMemoryTaskRepository(createMemoryState())
}
