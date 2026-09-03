<script setup lang="ts">
import type { TaskStatus, TaskWithProject } from '~~/shared/types/domain'

const { tasks } = defineProps<{ tasks: TaskWithProject[] }>()

const emit = defineEmits<{
  updated: [task: TaskWithProject]
}>()

const statusByTask = reactive<Record<string, TaskStatus>>({})

watch(
  () => tasks,
  (nextTasks) => {
    for (const task of nextTasks) statusByTask[task.id] = task.status
  },
  { immediate: true, deep: true },
)

function onUpdated(task: TaskWithProject) {
  statusByTask[task.id] = task.status
  emit('updated', task)
}

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
        <div class="task-row">
          <NuxtLink class="task-link" :to="`/tasks/${task.id}`">
          <span class="task-copy">
            <strong>{{ task.summary }}</strong>
            <span>{{ task.project.name }} · {{ task.jiraKey }}</span>
          </span>
          </NuxtLink>
          <div class="task-status-control">
            <span class="sr-only" data-status-label>{{ statusLabel(statusByTask[task.id] ?? task.status) }}</span>
            <TasksStatusSelect
              v-model="statusByTask[task.id]"
              :task-id="task.id"
              label="เปลี่ยนสถานะ"
              @updated="onUpdated"
            />
          </div>
        </div>
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
}
.task-link {
  min-width: 0;
  flex: 1;
  padding: .35rem 0;
  color: inherit;
  text-decoration: none;
  transition: color 160ms ease, transform 160ms ease;
}
.task-link:hover,
.task-link:focus-visible {
  color: var(--green);
  transform: translateX(.35rem);
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
.task-status-control { width: min(11rem, 42vw); flex: 0 0 auto; }
.section-empty {
  margin: 1.5rem 0 0;
  color: var(--muted);
}
@media (max-width: 36rem) {
  .task-row {
    flex-direction: column;
    align-items: flex-start;
  }
  .task-link, .task-status-control { width: 100%; }
}
</style>
