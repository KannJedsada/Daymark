<script setup lang="ts">
import type { TaskStatus, TaskWithProject } from "../../../shared/types/domain";

defineProps<{ tasks: TaskWithProject[] }>();

function statusLabel(status: TaskStatus) {
  if (status === "in_progress") return "In progress";
  if (status === "todo") return "Todo";
  return "Done";
}
</script>

<template>
  <section class="task-list-section" aria-labelledby="task-list-title">
    <header class="section-heading">
      <div>
        <p class="eyebrow">ALL TASKS</p>
        <h2 id="task-list-title">รายการงาน</h2>
      </div>
      <span class="count-label">{{ tasks.length }} งาน</span>
    </header>

    <ol v-if="tasks.length" class="task-list" role="list">
      <li v-for="task in tasks" :key="task.id" role="listitem">
        <NuxtLink class="task-row" :to="`/tasks/${task.id}`">
          <span class="task-copy">
            <strong>{{ task.summary }}</strong>
            <span>{{ task.project.name }} · {{ task.jiraKey }}</span>
          </span>
          <span
            class="status-pill"
            :class="`status-${task.status}`"
            data-status-label
          >
            {{ statusLabel(task.status) }}
          </span>
        </NuxtLink>
      </li>
    </ol>

    <p v-else class="section-empty">ไม่พบงานในตัวกรองนี้</p>
  </section>
</template>

<style scoped>
.task-list-section {
  padding: clamp(1.25rem, 3vw, 2rem);
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-paper);
}
.section-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--line);
}
.eyebrow {
  margin: 0 0 0.2rem;
  color: var(--orange-strong);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.14em;
}
h2 {
  margin: 0;
  color: var(--green);
  font-family: var(--font-display);
  font-size: clamp(1.45rem, 3vw, 2rem);
}
.count-label {
  color: var(--muted);
  font-size: 0.85rem;
}
.task-list {
  padding: 0;
  margin: 0;
  list-style: none;
}
.task-list li + li {
  border-top: 1px solid var(--line);
}
.task-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.1rem 0.3rem;
  color: inherit;
  text-decoration: none;
  transition:
    padding 160ms ease,
    color 160ms ease;
}
.task-row:hover,
.task-row:focus-visible {
  padding-inline: 0.7rem 0.3rem;
  color: var(--green);
}
.task-copy {
  min-width: 0;
}
.task-copy strong,
.task-copy > span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.task-copy strong {
  font-size: 1rem;
  font-weight: 600;
}
.task-copy > span {
  margin-top: 0.25rem;
  color: var(--muted);
  font-size: 0.8rem;
}
.status-pill {
  display: inline-flex;
  min-height: 2rem;
  align-items: center;
  padding: 0.3rem 0.65rem;
  color: var(--green);
  background: var(--green-soft);
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}
.status-in_progress {
  color: #813519;
  background: var(--orange-soft);
}
.status-done {
  color: #2f4f45;
  background: #d7e8df;
}
.section-empty {
  margin: 1.5rem 0 0;
  color: var(--muted);
}
@media (max-width: 36rem) {
  .task-row {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
