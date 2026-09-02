<script setup lang="ts">
import type { TaskDetail } from '../../composables/useTasks'
import type { TaskWithProject, WorkLog } from '../../../shared/types/domain'
import { useTaskDetail } from '../../composables/useTasks'

const route = useRoute()
const taskId = computed(() => typeof route.params.id === 'string' ? route.params.id : undefined)

const { data: remoteTask, pending, error, refresh } = useTaskDetail(taskId)
const task = ref<TaskDetail | null>(null)

watch(remoteTask, (value) => {
  if (value) task.value = { ...value, workLogs: [...value.workLogs] }
}, { immediate: true })

const deleteOpen = ref(false)
const deleting = ref(false)
const deleteError = ref('')

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

async function confirmDelete() {
  if (!task.value || deleting.value) return
  deleting.value = true
  deleteError.value = ''
  try {
    await $fetch(`/api/tasks/${task.value.id}`, { method: 'DELETE' })
    await refreshNuxtData(['dashboard', 'tasks'])
    await navigateTo('/tasks')
  }
  catch {
    deleteError.value = 'ลบงานไม่สำเร็จ'
    deleting.value = false
  }
}

function onWorkLogCreated(log: WorkLog) {
  if (!task.value) return
  task.value = {
    ...task.value,
    workLogs: [log, ...task.value.workLogs],
  }
}

function onStatusUpdated(updated: TaskWithProject) {
  if (!task.value) return
  task.value = {
    ...task.value,
    ...updated,
    project: updated.project,
    workLogs: task.value.workLogs,
  }
}

useHead({
  title: () => task.value ? `${task.value.jiraKey} · DAYMARK` : 'รายละเอียดงาน · DAYMARK',
})
</script>

<template>
  <div class="task-detail-page">
    <p class="sr-only" role="status" aria-live="polite">
      {{ pending ? 'กำลังโหลดงาน' : error ? 'โหลดงานไม่สำเร็จ' : 'โหลดงานแล้ว' }}
    </p>

    <SharedAppErrorState v-if="error" @retry="refresh" />

    <div v-else-if="pending || !task" class="skeleton-panel" aria-hidden="true" />

    <template v-else>
      <header class="detail-header">
        <div>
          <p class="kicker">{{ task.project.name }}</p>
          <h1>{{ task.summary }}</h1>
          <p class="meta-line">
            <a :href="task.jiraUrl" target="_blank" rel="noopener noreferrer">{{ task.jiraKey }}</a>
            · อัปเดต {{ formatTimestamp(task.updatedAt) }}
          </p>
          <p v-if="task.completedAt" class="completed-at" data-testid="completed-at">
            เสร็จเมื่อ {{ formatTimestamp(task.completedAt) }}
          </p>
        </div>

        <TasksStatusSelect
          v-model="task.status"
          :task-id="task.id"
          @updated="onStatusUpdated"
        />
      </header>

      <div class="detail-grid">
        <TasksWorkLogForm :task-id="task.id" @created="onWorkLogCreated" />
        <TasksWorkLogTimeline :logs="task.workLogs" />
      </div>

      <section class="danger-zone">
        <button type="button" data-testid="delete-task" @click="deleteOpen = true">ลบงาน</button>
      </section>

      <UModal v-model:open="deleteOpen" title="ยืนยันการลบงาน" :portal="false">
        <template #body>
          <p data-testid="delete-confirmation">
            การลบงานนี้จะลบบันทึกความคืบหน้าที่เชื่อมกับงานทั้งหมดด้วย และไม่สามารถกู้คืนได้
          </p>
          <p v-if="deleteError" class="delete-error" role="alert">{{ deleteError }}</p>
        </template>
        <template #footer>
          <UButton color="neutral" variant="ghost" :disabled="deleting" @click="deleteOpen = false">ยกเลิก</UButton>
          <UButton color="error" data-testid="confirm-delete" :loading="deleting" @click="confirmDelete">
            ลบงาน
          </UButton>
        </template>
      </UModal>
    </template>
  </div>
</template>

<style scoped>
.task-detail-page { width: min(100% - 2rem, 78rem); padding: clamp(2rem, 6vw, 4rem) 0 5rem; margin-inline: auto; }
.skeleton-panel { height: 28rem; background: #ded9cf; border-radius: var(--radius-lg); }
.detail-header { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(14rem, .6fr); gap: 1.5rem; margin-bottom: 1.5rem; }
.kicker { margin: 0 0 .35rem; color: var(--orange-strong); font-size: .75rem; font-weight: 600; letter-spacing: .14em; }
h1 { margin: 0; color: var(--green); font-family: var(--font-display); font-size: clamp(2rem, 5vw, 3.4rem); line-height: 1.05; }
.meta-line, .completed-at { margin: .75rem 0 0; color: var(--muted); font-size: .9rem; }
.meta-line a { color: var(--green); }
.completed-at { color: #2f4f45; font-weight: 600; }
.detail-grid { display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); gap: 1rem; }
.danger-zone { margin-top: 1.5rem; }
.danger-zone button { min-height: 2.6rem; padding: .55rem 1rem; color: var(--orange-strong); background: transparent; border: 1px solid rgb(168 59 28 / 25%); border-radius: .7rem; cursor: pointer; font-weight: 600; }
.delete-error { margin: .75rem 0 0; color: var(--orange-strong); font-size: .85rem; }
@media (max-width: 52rem) { .detail-header, .detail-grid { grid-template-columns: 1fr; } }
@media (max-width: 42rem) { .task-detail-page { width: min(100% - 1.25rem, 78rem); } }
</style>
