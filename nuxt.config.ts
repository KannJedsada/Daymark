export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  devtools: { enabled: true },
  runtimeConfig: {
    supabaseUrl: '',
    supabaseServiceRoleKey: '',
    e2eTestMode: false,
    jiraBaseUrl: '',
    jiraEmail: '',
    jiraApiToken: '',
  },
  typescript: { typeCheck: true, strict: true },
})
