import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface SupabaseRuntimeConfig {
  supabaseUrl: string
  supabaseServiceRoleKey: string
}

export function createServerSupabaseClient(
  runtimeConfig: SupabaseRuntimeConfig = useRuntimeConfig(),
): SupabaseClient {
  if (!runtimeConfig.supabaseUrl || !runtimeConfig.supabaseServiceRoleKey) {
    throw new Error('SUPABASE_NOT_CONFIGURED: set NUXT_SUPABASE_URL and NUXT_SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  })
}
