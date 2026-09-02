<script setup lang="ts">
import type { TaskStatus } from '../../../shared/types/domain'
import { hasExplicitTaskFilters, useTasks } from '../../composables/useTasks'

const route = useRoute()

const filterForm = ref({
  status: '',
  projectId: '',
  query: '',
  date: '',
})

const debouncedQuery = ref('')

watch(
  () => [route.query.status, route.query.projectId, route.query.query, route.query.date] as const,
  ([status, projectId, query, date]) => {
    filterForm.value = {
      status: typeof status === 'string' ? status : '',
      projectId: typeof projectId === 'string' ? projectId : '',
      query: typeof query === 'string' ? query : '',
      date: typeof date === 'string' ? date : '',
    }
    debouncedQuery.value = filterForm.value.query
  },
  { immediate: true },
)

let queryTimer: ReturnType<typeof setTimeout> | undefined
watch(() => filterForm.value.query, (value) => {
  clearTimeout(queryTimer)
  queryTimer = setTimeout(() => {
    debouncedQuery.value = value
    syncFiltersToUrl()
  }, 250)
})

const filters = computed(() => ({
  status: (typeof route.query.status === 'string' ? route.query.status : undefined) as TaskStatus | undefined,
  projectId: typeof route.query.projectId === 'string' ? route.query.projectId : undefined,
  query: typeof route.query.query === 'string' ? route.query.query : undefined,
  date: typeof route.query.date === 'string' ? route.query.date : undefined,
}))

const { data: tasks, pending, error, refresh } = useTasks(filters)
const hasFilters = computed(() => hasExplicitTaskFilters(route.query))

function buildQuery() {
  return {
    status: filterForm.value.status || undefined,
    projectId: filterForm.value.projectId.trim() || undefined,
    query: debouncedQuery.value.trim() || undefined,
    date: filterForm.value.date || undefined,
  }
}

function queryMatchesRoute(next: ReturnType<typeof buildQuery>) {
  return (route.query.status ?? '') === (next.status ?? '')
    && (route.query.projectId ?? '') === (next.projectId ?? '')
    && (route.query.query ?? '') === (next.query ?? '')
    && (route.query.date ?? '') === (next.date ?? '')
}

function syncFiltersToUrl() {
  const next = buildQuery()
  if (queryMatchesRoute(next)) return
  return navigateTo({ path: '/tasks', query: next })
}

watch(
  () => [filterForm.value.status, filterForm.value.projectId, filterForm.value.date] as const,
  () => syncFiltersToUrl(),
)

function clearFilters() {
  filterForm.value = { status: '', projectId: '', query: '', date: '' }
  debouncedQuery.value = ''
  return navigateTo('/tasks')
}

useHead({
  title: 'งานทั้งหมด · DAYMARK',
  meta: [{ name: 'description', content: 'ค้นหา กรอง และติดตามงานทั้งหมด' }],
})
</script>

<template>
  <div class="tasks-page">
    <header class="page-header">
      <div>
        <p class="kicker">TASK BOARD</p>
        <h1>งานทั้งหมด</h1>
        <p class="lede">กรองตามสถานะ โปรเจกต์ คำค้น และวันที่บันทึกความคืบหน้า</p>
      </div>
      <button v-if="hasFilters" class="text-button" type="button" @click="clearFilters">ล้างตัวกรอง</button>
    </header>

    <TasksTaskFilters v-model="filterForm" />

    <p class="sr-only" role="status" aria-live="polite">
      {{ pending ? 'กำลังโหลดรายการงาน' : error ? 'โหลดรายการงานไม่สำเร็จ' : 'โหลดรายการงานแล้ว' }}
    </p>

    <SharedAppErrorState v-if="error" @retry="refresh" />

    <div v-else-if="pending" class="skeleton-panel" aria-hidden="true" />

    <SharedAppEmptyState
      v-else-if="tasks.length === 0 && !hasFilters"
      title="ยังไม่มีงานในระบบ"
      description="เพิ่มงานแรกจากปุ่ม เพิ่มงาน ที่มุมบน"
    />

    <SharedAppEmptyState
      v-else-if="tasks.length === 0 && hasFilters"
      title="ไม่พบงานในตัวกรองนี้"
      description="ลองปรับตัวกรองหรือล้างเพื่อดูงานทั้งหมด"
      action-label="ล้างตัวกรอง"
      @action="clearFilters"
    />

    <TasksTaskList v-else :tasks="tasks" />
  </div>
</template>

<style scoped>
.tasks-page { width: min(100% - 2rem, 78rem); padding: clamp(2rem, 6vw, 4rem) 0 5rem; margin-inline: auto; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1.5rem; }
.kicker { margin: 0 0 .5rem; color: var(--orange-strong); font-size: .75rem; font-weight: 600; letter-spacing: .16em; }
h1 { margin: 0; color: var(--green); font-family: var(--font-display); font-size: clamp(2.4rem, 6vw, 4rem); }
.lede { margin: .75rem 0 0; color: var(--muted); max-width: 36rem; }
.text-button { padding: .3rem; color: var(--orange-strong); background: transparent; border: 0; cursor: pointer; font-size: .85rem; text-decoration: underline; text-underline-offset: .2rem; }
.skeleton-panel { height: 24rem; margin-top: 1rem; background: #ded9cf; border-radius: var(--radius-lg); }
@media (max-width: 42rem) { .tasks-page { width: min(100% - 1.25rem, 78rem); } }
</style>
