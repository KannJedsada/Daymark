<script setup lang="ts">
import type { WorkLog } from '../../../shared/types/domain'

defineProps<{ logs: WorkLog[] }>()

function formatDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00+07:00`))
}
</script>

<template>
  <section class="work-log-timeline" aria-labelledby="work-log-timeline-title">
    <header class="section-heading">
      <h2 id="work-log-timeline-title">บันทึกรายวัน</h2>
      <span class="count-label">{{ logs.length }} รายการ</span>
    </header>

    <ol v-if="logs.length" class="timeline" role="list">
      <li v-for="log in logs" :key="log.id" role="listitem" class="timeline-item">
        <time :datetime="log.workedOn">{{ formatDate(log.workedOn) }}</time>
        <p>{{ log.note }}</p>
        <small v-if="log.minutesSpent">{{ log.minutesSpent }} นาที</small>
      </li>
    </ol>

    <p v-else class="section-empty">ยังไม่มีบันทึกความคืบหน้า</p>
  </section>
</template>

<style scoped>
.work-log-timeline { padding: clamp(1.25rem, 3vw, 2rem); background: var(--paper); border: 1px solid var(--line); border-radius: var(--radius-lg); box-shadow: var(--shadow-paper); }
.section-heading { display: flex; align-items: end; justify-content: space-between; gap: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--line); }
h2 { margin: 0; color: var(--green); font-family: var(--font-display); font-size: clamp(1.2rem, 3vw, 1.6rem); }
.count-label { color: var(--muted); font-size: .85rem; }
.timeline { padding: 0; margin: 0; list-style: none; }
.timeline-item { padding: 1rem 0; border-bottom: 1px solid var(--line); }
.timeline-item:last-child { border-bottom: 0; }
time { display: block; color: var(--orange-strong); font-size: .78rem; font-weight: 600; letter-spacing: .04em; }
p { margin: .35rem 0 0; line-height: 1.55; }
small { display: block; margin-top: .35rem; color: var(--muted); font-size: .75rem; }
.section-empty { margin: 1rem 0 0; color: var(--muted); }
</style>
