import { describe, expect, it } from 'vitest'

import { createServerSupabaseClient } from '../../server/utils/supabase'

describe('server Supabase client', () => {
  it('fails clearly when server-only credentials are missing', () => {
    expect(() => createServerSupabaseClient({ supabaseUrl: '', supabaseServiceRoleKey: '' }))
      .toThrow('SUPABASE_NOT_CONFIGURED: set NUXT_SUPABASE_URL and NUXT_SUPABASE_SERVICE_ROLE_KEY')
  })

  it('creates a client from server-only runtime values', () => {
    const client = createServerSupabaseClient({
      supabaseUrl: 'https://example.supabase.co',
      supabaseServiceRoleKey: 'test-service-role-key',
    })
    expect(client).toHaveProperty('from')
  })
})
