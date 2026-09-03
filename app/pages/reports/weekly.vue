<script setup lang="ts">
import { addBangkokDays } from '~~/shared/utils/date'
import { projectLabel } from '../../composables/useProjects'
import { useWeeklyReport } from '../../composables/useWeeklyReport'

const route = useRoute()

const projectFilter = ref('')
const weekAnchor = ref('')

watch(
  () => [route.query.week, route.query.projectId] as const,
  ([week, projectId]) => {
    weekAnchor.value = typeof week === 'string' ? week : ''
    projectFilter.value = typeof projectId === 'string' ? projectId : ''
  },
  { immediate: true },
)

const filters = computed(() => ({
  week: typeof route.query.week === 'string' ? route.query.week : undefined,
  projectId: typeof route.query.projectId === 'string' ? route.query.projectId : undefined,
}))

const { data: report, pending, error, refresh } = useWeeklyReport(filters)

const weekLabel = computed(() => {
  if (!report.value.from) return ''
  const from = new Date(`${report.value.from}T00:00:00+07:00`)
  const to = new Date(`${report.value.to}T00:00:00+07:00`)
  const formatter = new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  return `${formatter.format(from)} – ${formatter.format(to)}`
})

function formatDay(date: string) {
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${date}T00:00:00+07:00`))
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function syncQuery() {
  return navigateTo({
    path: '/reports/weekly',
    query: {
      week: weekAnchor.value || undefined,
      projectId: projectFilter.value && projectFilter.value !== '__new__' ? projectFilter.value : undefined,
    },
  })
}

function shiftWeek(days: number) {
  const anchor = report.value.from || weekAnchor.value
  if (!anchor) return
  weekAnchor.value = addBangkokDays(anchor, days)
  return syncQuery()
}

watch(projectFilter, () => syncQuery())

useHead({
  title: 'รายงานรายสัปดาห์ · DAYMARK',
  meta: [{ name: 'description', content: 'สรุปงานที่ทำในแต่ละวันของสัปดาห์' }],
})
</script>

<template>
  <div class="weekly-page">
    <header class="page-header">
      <div>
        <p class="kicker">WEEKLY REPORT</p>
        <h1>รายงานรายสัปดาห์</h1>
        <p class="lede">ดูว่าทำอะไรไปบ้างในแต่ละวันของสัปดาห์ (จันทร์–อาทิตย์)</p>
      </div>
    </header>

    <form class="filter-card" aria-label="ตัวกรองรายงาน" @submit.prevent="syncQuery">
      <div class="filter-heading">
        <div>
          <span>สัปดาห์นี้</span>
          <small>{{ weekLabel }}</small>
        </div>
        <div class="week-nav">
          <button type="button" class="text-button" @click="shiftWeek(-7)">สัปดาห์ก่อน</button>
          <button type="button" class="text-button" @click="shiftWeek(7)">สัปดาห์ถัดไป</button>
        </div>
      </div>

      <label>
        <span>โปรเจกต์</span>
        <ProjectsProjectSelect
          v-model="projectFilter"
          allow-empty
          empty-label="ทุกโปรเจกต์"
        />
      </label>

      <label>
        <span>วันในสัปดาห์</span>
        <input v-model="weekAnchor" name="week" type="date">
      </label>

      <button class="filter-submit" type="submit">ดูรายงาน</button>
    </form>

    <div class="summary-strip" v-if="report.from">
      <div>
        <small>บันทึกทั้งหมด</small>
        <strong>{{ report.totalEntries }}</strong>
      </div>
      <div>
        <small>เวลารวม</small>
        <strong>{{ report.totalMinutes }} นาที</strong>
      </div>
    </div>

    <p class="sr-only" role="status" aria-live="polite">
      {{ pending ? 'กำลังโหลดรายงาน' : error ? 'โหลดรายงานไม่สำเร็จ' : 'โหลดรายงานแล้ว' }}
    </p>

    <SharedAppErrorState v-if="error" @retry="refresh" />

    <div v-else-if="pending" class="skeleton-panel" aria-hidden="true" />

    <SharedAppEmptyState
      v-else-if="report.totalEntries === 0"
      title="ยังไม่มีบันทึกในสัปดาห์นี้"
      description="บันทึกความคืบหน้าในหน้างาน แล้วกลับมาดูสรุปรายสัปดาห์"
    />

    <div v-else class="day-grid">
      <section
        v-for="day in report.days"
        :key="day.date"
        class="day-card"
        :class="{ 'day-card-empty': day.activities.length === 0 }"
      >
        <header>
          <h2>{{ formatDay(day.date) }}</h2>
          <span v-if="day.totalMinutes">{{ day.totalMinutes }} นาที</span>
        </header>

        <p v-if="day.activities.length === 0" class="day-empty">ไม่มีบันทึก</p>

        <ol v-else class="activity-list">
          <li v-for="log in day.activities" :key="log.id">
            <p class="activity-meta">
              <time :datetime="log.createdAt">{{ formatTime(log.createdAt) }}</time>
              <span v-if="log.minutesSpent">· {{ log.minutesSpent }} นาที</span>
              <span v-if="log.task.project">· {{ projectLabel(log.task.project) }}</span>
            </p>
            <p class="activity-note">{{ log.note }}</p>
            <NuxtLink :to="`/tasks/${log.task.id}`">{{ log.task.jiraKey }} · {{ log.task.summary }}</NuxtLink>
          </li>
        </ol>
      </section>
    </div>
  </div>
</template>

<style scoped>
.weekly-page { width: min(100% - 2rem, 78rem); padding: clamp(2rem, 6vw, 4rem) 0 5rem; margin-inline: auto; }
.page-header { margin-bottom: 1.5rem; }
.kicker { margin: 0 0 .5rem; color: var(--orange-strong); font-size: .75rem; font-weight: 600; letter-spacing: .16em; }
h1 { margin: 0; color: var(--green); font-family: var(--font-display); font-size: clamp(2.4rem, 6vw, 4rem); }
.lede { margin: .75rem 0 0; color: var(--muted); max-width: 40rem; }
.filter-card { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; padding: 1.25rem; margin-bottom: 1rem; background: rgb(255 252 246 / 88%); border: 1px solid var(--line); border-radius: var(--radius-md); }
.filter-heading { grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.filter-heading span, .filter-heading small { display: block; }
.filter-heading span { color: var(--green); font-family: var(--font-display); font-weight: 600; }
.filter-heading small { margin-top: .1rem; color: var(--muted); font-size: .78rem; }
.week-nav { display: flex; gap: .75rem; }
label { color: var(--muted); font-size: .78rem; }
label span { display: block; margin-bottom: .35rem; }
input { width: 100%; min-height: 2.8rem; padding: .65rem .75rem; color: var(--ink); background: var(--canvas); border: 1px solid transparent; border-radius: .7rem; }
input:hover { border-color: var(--line); }
.filter-submit { grid-column: 1 / -1; min-height: 2.8rem; color: var(--paper); background: var(--green); border: 0; border-radius: .7rem; cursor: pointer; font-weight: 600; }
.text-button { padding: .3rem; color: var(--orange-strong); background: transparent; border: 0; cursor: pointer; font-size: .8rem; text-decoration: underline; text-underline-offset: .2rem; }
.summary-strip { display: flex; gap: 1rem; margin-bottom: 1rem; }
.summary-strip div { flex: 1; padding: 1rem 1.1rem; background: var(--green-soft); border: 1px solid rgb(24 61 50 / 10%); border-radius: var(--radius-md); }
.summary-strip small { display: block; color: var(--muted); font-size: .72rem; }
.summary-strip strong { display: block; margin-top: .2rem; color: var(--green); font-family: var(--font-display); font-size: 1.35rem; }
.skeleton-panel { height: 24rem; background: #ded9cf; border-radius: var(--radius-lg); }
.day-grid { display: grid; gap: 1rem; }
.day-card { padding: 1.1rem 1.25rem; background: rgb(255 252 246 / 88%); border: 1px solid var(--line); border-radius: var(--radius-md); }
.day-card-empty { opacity: .72; }
.day-card header { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; margin-bottom: .75rem; }
.day-card h2 { margin: 0; color: var(--green); font-family: var(--font-display); font-size: 1.1rem; }
.day-card header span { color: var(--muted); font-size: .78rem; }
.day-empty { margin: 0; color: var(--muted); font-size: .85rem; }
.activity-list { padding: 0; margin: 0; list-style: none; }
.activity-list li { padding: .75rem 0; border-top: 1px solid var(--line); }
.activity-list li:first-child { border-top: 0; padding-top: 0; }
.activity-meta { margin: 0; color: var(--muted); font-size: .75rem; }
.activity-note { margin: .35rem 0; line-height: 1.55; }
a { color: var(--orange-strong); font-size: .78rem; text-underline-offset: .2rem; }
@media (max-width: 42rem) {
  .weekly-page { width: min(100% - 1.25rem, 78rem); }
  .filter-card { grid-template-columns: 1fr; }
  .filter-heading { flex-direction: column; align-items: flex-start; }
  .summary-strip { flex-direction: column; }
}
</style>
