import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    environment: 'happy-dom',
    coverage: { reporter: ['text', 'html'] },
    pool: 'forks',
    isolate: true,
    // Nuxt component suites perform substantial shared setup. Running files one
    // at a time avoids worker contention and keeps the local/CI signal stable.
    fileParallelism: false,
  },
})
