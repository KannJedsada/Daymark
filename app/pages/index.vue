<script setup lang="ts">
const route = useRoute()
const addTaskRequested = useState('daymark:add-task-requested', () => false)

const today = useState('daymark:today', () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date()))

const projectFilter = ref('')
const dateFilter = ref('')
const filters = computed(() => ({
  projectId: typeof route.query.projectId === 'string' ? route.query.projectId : undefined,
  date: typeof route.query.date === 'string' ? route.query.date : today.value,
}))

const { data: dashboard, pending, error, refresh } = useDashboard(filters)
const hasFilters = computed(() => hasExplicitDashboardFilters(route.query))
const totalTasks = computed(() => {
  const counts = dashboard.value.counts
  return counts.todo + counts.inProgress + counts.done
})

const thaiDate = computed(() => new Intl.DateTimeFormat('th-TH', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(new Date(`${filters.value.date || today.value}T00:00:00+07:00`)))

watch(
  () => [route.query.projectId, route.query.date] as const,
  ([projectId, date]) => {
    projectFilter.value = typeof projectId === 'string' ? projectId : ''
    dateFilter.value = typeof date === 'string' ? date : ''
  },
  { immediate: true },
)

function applyFilters() {
  return navigateTo({
    path: '/',
    query: {
      projectId: projectFilter.value.trim() || undefined,
      date: dateFilter.value || undefined,
    },
  })
}

function clearFilters() {
  projectFilter.value = ''
  dateFilter.value = ''
  return navigateTo('/')
}

function requestAddTask() {
  addTaskRequested.value = true
}

useHead({
  title: 'Daily Focus · DAYMARK',
  meta: [{ name: 'description', content: 'ภาพรวมงานวันนี้ งานที่กำลังทำ และบันทึกความคืบหน้า' }],
})
</script>

<template>
  <div class="dashboard-page">
    <header class="hero">
      <div class="hero-copy">
        <p class="kicker">DAILY FOCUS / BANGKOK</p>
        <h1>วันนี้<br><em>ไปต่อกับอะไร</em></h1>
        <p class="date-line">{{ thaiDate }}</p>
      </div>

      <form class="filter-card" aria-label="ตัวกรองภาพรวม" @submit.prevent="applyFilters">
        <div class="filter-heading">
          <div>
            <span>มุมมองวันนี้</span>
            <small>FILTER THE DAY</small>
          </div>
          <button v-if="hasFilters" class="text-button" type="button" @click="clearFilters">ล้างตัวกรอง</button>
        </div>
        <label>
          <span>โปรเจกต์</span>
          <input v-model="projectFilter" name="projectId" placeholder="Project ID (ทั้งหมด)" autocomplete="off">
        </label>
        <label>
          <span>วันที่</span>
          <input v-model="dateFilter" name="date" type="date">
        </label>
        <button class="filter-submit" type="submit">ดูภาพรวม</button>
      </form>
    </header>

    <p class="sr-only" role="status" aria-live="polite">
      {{ pending ? 'กำลังโหลดภาพรวม' : error ? 'โหลดภาพรวมไม่สำเร็จ' : 'โหลดภาพรวมแล้ว' }}
    </p>

    <div v-if="pending" class="skeleton-layout" aria-hidden="true">
      <div class="skeleton-cards">
        <div v-for="index in 3" :key="index" class="skeleton skeleton-card" />
      </div>
      <div class="skeleton-content">
        <div class="skeleton skeleton-panel" />
        <div class="skeleton skeleton-panel" />
      </div>
    </div>

    <SharedAppErrorState v-else-if="error" @retry="refresh" />

    <SharedAppEmptyState
      v-else-if="totalTasks === 0 && !hasFilters"
      title="เริ่มวางหมุดหมายแรก"
      description="เพิ่มงานจาก Jira เพื่อให้ DAYMARK ช่วยรวมสิ่งที่ต้องทำและสิ่งที่เดินหน้าแล้วไว้ในที่เดียว"
      action-label="เพิ่มงานแรก"
      @action="requestAddTask"
    />

    <SharedAppEmptyState
      v-else-if="totalTasks === 0 && hasFilters"
      title="ไม่พบงานในมุมมองนี้"
      description="ลองล้างตัวกรองเพื่อกลับไปดูภาพรวมงานทั้งหมด"
      action-label="ล้างตัวกรอง"
      @action="clearFilters"
    />

    <template v-else>
      <DashboardStatusCards :counts="dashboard.counts" />
      <div class="dashboard-grid">
        <DashboardFocusList :tasks="dashboard.focusedTasks" />
        <DashboardTodayActivity :activity="dashboard.todayActivity" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.dashboard-page { width: min(100% - 2rem, 78rem); padding: clamp(2rem, 6vw, 5rem) 0 5rem; margin-inline: auto; }
.hero { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(18rem, .65fr); align-items: end; gap: clamp(2rem, 6vw, 6rem); margin-bottom: clamp(2.5rem, 6vw, 5rem); }
.kicker { margin: 0 0 1.1rem; color: var(--orange-strong); font-size: .75rem; font-weight: 600; letter-spacing: .16em; }
h1 { max-width: 12ch; margin: 0; color: var(--green); font-family: var(--font-display); font-size: clamp(3.2rem, 9vw, 7.2rem); font-weight: 600; letter-spacing: -.055em; line-height: .88; }
h1 em { color: var(--ink); font-size: .56em; font-style: normal; font-weight: 500; letter-spacing: -.035em; }
.date-line { margin: 1.25rem 0 0; color: var(--muted); font-size: 1rem; }
.filter-card { position: relative; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; padding: 1.25rem; background: rgb(255 252 246 / 88%); border: 1px solid var(--line); border-radius: var(--radius-md); box-shadow: var(--shadow-paper); }
.filter-card::before { position: absolute; top: -3px; right: 2rem; left: 2rem; height: 3px; content: ''; background: var(--orange); border-radius: 999px; }
.filter-heading { grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; }
.filter-heading span, .filter-heading small { display: block; }
.filter-heading span { color: var(--green); font-family: var(--font-display); font-weight: 600; }
.filter-heading small { margin-top: .1rem; color: var(--muted); font-size: .65rem; letter-spacing: .1em; }
label { color: var(--muted); font-size: .78rem; }
label span { display: block; margin-bottom: .35rem; }
input { width: 100%; min-height: 2.8rem; padding: .65rem .75rem; color: var(--ink); background: var(--canvas); border: 1px solid transparent; border-radius: .7rem; }
input:hover { border-color: var(--line); }
.filter-submit { grid-column: 1 / -1; min-height: 2.8rem; color: var(--paper); background: var(--green); border: 0; border-radius: .7rem; cursor: pointer; font-weight: 600; }
.text-button { padding: .3rem; color: var(--orange-strong); background: transparent; border: 0; cursor: pointer; font-size: .8rem; text-decoration: underline; text-underline-offset: .2rem; }
.dashboard-grid { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(17rem, .85fr); align-items: start; gap: 1rem; margin-top: 1rem; }
.skeleton-layout { display: grid; gap: 1rem; }
.skeleton-cards, .skeleton-content { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
.skeleton-content { grid-template-columns: 1.55fr .85fr; }
.skeleton { overflow: hidden; background: #ded9cf; border-radius: var(--radius-md); }
.skeleton::after { display: block; width: 50%; height: 100%; content: ''; background: linear-gradient(90deg, transparent, rgb(255 255 255 / 48%), transparent); animation: shimmer 1.3s infinite; }
.skeleton-card { height: 10.5rem; }
.skeleton-panel { height: 24rem; border-radius: var(--radius-lg); }
@keyframes shimmer { from { transform: translateX(-120%); } to { transform: translateX(240%); } }
@media (max-width: 52rem) { .hero { grid-template-columns: 1fr; gap: 2rem; } .dashboard-grid { grid-template-columns: 1fr; } }
@media (max-width: 42rem) { .dashboard-page { width: min(100% - 1.25rem, 78rem); } .filter-card { grid-template-columns: 1fr; } .filter-heading, .filter-submit { grid-column: 1; } .skeleton-cards, .skeleton-content { grid-template-columns: 1fr; } .skeleton-card { height: 7.5rem; } }
</style>
