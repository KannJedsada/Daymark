<script setup lang="ts">
import type { DashboardActivity } from '../../../shared/types/domain'

defineProps<{ activity: DashboardActivity[] }>()

function formatTime(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
</script>

<template>
  <aside class="activity-section" aria-labelledby="activity-title">
    <header>
      <p>DAILY NOTES</p>
      <h2 id="activity-title">บันทึกวันนี้</h2>
    </header>

    <ol v-if="activity.length" class="activity-list">
      <li v-for="log in activity" :key="log.id">
        <span class="timeline-dot" aria-hidden="true" />
        <div>
          <p class="activity-meta">
            <time :datetime="log.createdAt">{{ formatTime(log.createdAt) }}</time>
            <span v-if="log.minutesSpent">· {{ log.minutesSpent }} นาที</span>
          </p>
          <p class="activity-note">{{ log.note }}</p>
          <NuxtLink :to="`/tasks/${log.task.id}`">{{ log.task.jiraKey }} · {{ log.task.summary }}</NuxtLink>
        </div>
      </li>
    </ol>

    <p v-else class="section-empty">ยังไม่มีบันทึกงานสำหรับวันนี้</p>
  </aside>
</template>

<style scoped>
.activity-section { padding: clamp(1.25rem, 3vw, 2rem); color: var(--paper); background: var(--green); border-radius: var(--radius-lg); box-shadow: var(--shadow-paper); }
header { padding-bottom: 1.25rem; border-bottom: 1px solid rgb(255 255 255 / 16%); }
header p { margin: 0 0 .2rem; color: #e7a287; font-size: .72rem; font-weight: 600; letter-spacing: .14em; }
h2 { margin: 0; font-family: var(--font-display); font-size: clamp(1.45rem, 3vw, 2rem); }
.activity-list { padding: 1.25rem 0 0; margin: 0; list-style: none; }
.activity-list li { position: relative; display: grid; grid-template-columns: .8rem 1fr; gap: .75rem; padding-bottom: 1.35rem; }
.activity-list li:not(:last-child)::before { position: absolute; top: .8rem; bottom: 0; left: .3rem; width: 1px; content: ''; background: rgb(255 255 255 / 18%); }
.timeline-dot { position: relative; z-index: 1; width: .65rem; height: .65rem; margin-top: .35rem; background: var(--orange); border: 2px solid var(--green); border-radius: 50%; box-shadow: 0 0 0 2px var(--orange); }
.activity-meta { margin: 0; color: #b8cbc5; font-size: .75rem; }
.activity-note { margin: .35rem 0; line-height: 1.55; }
a { color: #f1ba9f; font-size: .78rem; text-underline-offset: .2rem; }
.section-empty { margin: 1.5rem 0 0; color: #b8cbc5; }
</style>
