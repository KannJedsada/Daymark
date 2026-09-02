<script setup lang="ts">
import type { TaskWithProject } from '../../../shared/types/domain'

defineProps<{ tasks: TaskWithProject[] }>()

function statusLabel(status: TaskWithProject['status']) {
  return status === 'in_progress' ? 'กำลังทำ' : status === 'todo' ? 'รอเริ่ม' : 'เสร็จแล้ว'
}
</script>

<template>
  <section class="focus-section" aria-labelledby="focus-title">
    <header class="section-heading">
      <div>
        <p class="eyebrow">TODAY'S FOCUS</p>
        <h2 id="focus-title">งานที่ต้องไปต่อ</h2>
      </div>
      <span class="count-label">{{ tasks.length }} งาน</span>
    </header>

    <ol v-if="tasks.length" class="focus-list">
      <li v-for="(task, index) in tasks" :key="task.id">
        <NuxtLink class="focus-item" :to="`/tasks/${task.id}`">
          <span class="item-index" aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</span>
          <span class="item-copy">
            <strong>{{ task.summary }}</strong>
            <span>{{ task.project.name }} · {{ task.jiraKey }}</span>
          </span>
          <span class="status-pill" :class="`status-${task.status}`">
            <span aria-hidden="true">{{ task.status === 'in_progress' ? '→' : '○' }}</span>
            {{ statusLabel(task.status) }}
          </span>
        </NuxtLink>
      </li>
    </ol>

    <p v-else class="section-empty">ไม่มีงานค้างในรายการโฟกัส — จังหวะวันนี้โล่งแล้ว</p>
  </section>
</template>

<style scoped>
.focus-section { padding: clamp(1.25rem, 3vw, 2rem); background: var(--paper); border: 1px solid var(--line); border-radius: var(--radius-lg); box-shadow: var(--shadow-paper); }
.section-heading { display: flex; align-items: end; justify-content: space-between; gap: 1rem; padding-bottom: 1.25rem; border-bottom: 1px solid var(--line); }
.eyebrow { margin: 0 0 .2rem; color: var(--orange-strong); font-size: .72rem; font-weight: 600; letter-spacing: .14em; }
h2 { margin: 0; color: var(--green); font-family: var(--font-display); font-size: clamp(1.45rem, 3vw, 2rem); }
.count-label { color: var(--muted); font-size: .85rem; }
.focus-list { padding: 0; margin: 0; list-style: none; }
.focus-list li + li { border-top: 1px solid var(--line); }
.focus-item { display: grid; grid-template-columns: 2.5rem minmax(0, 1fr) auto; align-items: center; gap: 1rem; padding: 1.2rem .3rem; color: inherit; text-decoration: none; transition: padding 160ms ease, color 160ms ease; }
.focus-item:hover { padding-inline: .7rem .3rem; color: var(--green); }
.item-index { color: #a2aaa6; font-family: var(--font-display); font-size: .82rem; }
.item-copy { min-width: 0; }
.item-copy strong, .item-copy > span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-copy strong { font-size: 1rem; font-weight: 600; }
.item-copy > span { margin-top: .25rem; color: var(--muted); font-size: .8rem; }
.status-pill { display: inline-flex; min-height: 2rem; align-items: center; gap: .35rem; padding: .3rem .65rem; color: var(--green); background: var(--green-soft); border-radius: 999px; font-size: .75rem; font-weight: 600; white-space: nowrap; }
.status-in_progress { color: #813519; background: var(--orange-soft); }
.section-empty { margin: 1.5rem 0 0; color: var(--muted); }
@media (max-width: 36rem) { .focus-item { grid-template-columns: 1.8rem minmax(0, 1fr); } .status-pill { grid-column: 2; width: max-content; } }
</style>
