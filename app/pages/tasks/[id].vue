<script setup lang="ts">
import type { TaskDetail } from '../../composables/useTasks'
import type { TaskWithProject, WorkLog } from '~~/shared/types/domain'
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
const editing = ref(false)
const saving = ref(false)
const editError = ref('')
const editForm = reactive({
  jiraUrl: '',
  jiraKey: '',
  summary: '',
  projectId: '',
})

function resetEditForm() {
  if (!task.value) return
  editForm.jiraUrl = task.value.jiraUrl
  editForm.jiraKey = task.value.jiraKey
  editForm.summary = task.value.summary
  editForm.projectId = task.value.projectId
  editError.value = ''
}

function beginEditing() {
  resetEditForm()
  editing.value = true
}

function cancelEditing() {
  editing.value = false
  resetEditForm()
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

async function saveTask() {
  if (!task.value || saving.value) return

  const jiraUrl = editForm.jiraUrl.trim()
  const jiraKey = editForm.jiraKey.trim().toUpperCase()
  const summary = editForm.summary.trim()
  if (!jiraUrl || !jiraKey || !summary || !editForm.projectId) {
    editError.value = 'กรุณากรอกลิงก์ Jira รหัสงาน ชื่องาน และโปรเจกต์ให้ครบ'
    return
  }

  try {
    const parsedUrl = new URL(jiraUrl)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Unsupported protocol')
  }
  catch {
    editError.value = 'ลิงก์ Jira ต้องเป็น URL ที่ถูกต้อง'
    return
  }

  saving.value = true
  editError.value = ''
  try {
    const updated = await $fetch<TaskWithProject>(`/api/tasks/${task.value.id}`, {
      method: 'PATCH',
      body: { jiraUrl, jiraKey, summary, projectId: editForm.projectId },
    })
    onTaskUpdated(updated)
    editing.value = false
    await refreshNuxtData(['dashboard', 'tasks', `task-${task.value.id}`])
  }
  catch {
    editError.value = 'บันทึกการแก้ไขไม่สำเร็จ'
  }
  finally {
    saving.value = false
  }
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

function onTaskUpdated(updated: TaskWithProject) {
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
            · สร้าง {{ formatTimestamp(task.createdAt) }}
            · อัปเดต {{ formatTimestamp(task.updatedAt) }}
          </p>
          <p v-if="task.completedAt" class="completed-at" data-testid="completed-at">
            เสร็จเมื่อ {{ formatTimestamp(task.completedAt) }}
          </p>
        </div>

        <TasksStatusSelect
          v-model="task.status"
          :task-id="task.id"
          @updated="onTaskUpdated"
        />
      </header>

      <section class="edit-section" aria-labelledby="task-edit-title">
        <div class="edit-heading">
          <div>
            <p class="kicker">TASK DETAILS</p>
            <h2 id="task-edit-title">ข้อมูลงาน</h2>
          </div>
          <button v-if="!editing" class="secondary-button" type="button" data-testid="edit-task" @click="beginEditing">
            แก้ไขข้อมูล
          </button>
        </div>

        <form v-if="editing" class="edit-form" novalidate @submit.prevent="saveTask">
          <label for="edit-jira-url">
            <span>ลิงก์ Jira</span>
            <input id="edit-jira-url" v-model="editForm.jiraUrl" name="jiraUrl" type="url" required>
          </label>
          <div class="edit-grid">
            <label for="edit-jira-key">
              <span>รหัส Jira</span>
              <input id="edit-jira-key" v-model="editForm.jiraKey" name="jiraKey" required maxlength="100">
            </label>
            <label for="edit-project">
              <span>โปรเจกต์</span>
              <ProjectsProjectSelect id="edit-project" v-model="editForm.projectId" name="projectId" :allow-create="false" />
            </label>
          </div>
          <label for="edit-summary">
            <span>ชื่องาน</span>
            <input id="edit-summary" v-model="editForm.summary" name="summary" required maxlength="300">
          </label>
          <p v-if="editError" class="edit-error" role="alert">{{ editError }}</p>
          <div class="edit-actions">
            <button class="secondary-button" type="button" :disabled="saving" @click="cancelEditing">ยกเลิก</button>
            <button class="primary-button" type="submit" data-testid="save-task" :disabled="saving">
              {{ saving ? 'กำลังบันทึก' : 'บันทึกการแก้ไข' }}
            </button>
          </div>
        </form>
        <dl v-else class="detail-list">
          <div><dt>Jira</dt><dd><a :href="task.jiraUrl" target="_blank" rel="noopener noreferrer">{{ task.jiraKey }}</a></dd></div>
          <div><dt>โปรเจกต์</dt><dd>{{ task.project.name }}</dd></div>
          <div><dt>ชื่องาน</dt><dd>{{ task.summary }}</dd></div>
        </dl>
      </section>

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
.edit-section { padding: 1.25rem; margin-bottom: 1rem; background: rgb(255 252 246 / 88%); border: 1px solid var(--line); border-radius: var(--radius-md); }
.edit-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.edit-heading h2 { margin: 0; color: var(--green); font-family: var(--font-display); font-size: 1.35rem; }
.edit-form { display: grid; gap: 1rem; margin-top: 1rem; }
.edit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.edit-form label { color: var(--muted); font-size: .78rem; }
.edit-form label > span { display: block; margin-bottom: .35rem; }
.edit-form input { width: 100%; min-height: 2.8rem; padding: .65rem .75rem; color: var(--ink); background: var(--canvas); border: 1px solid var(--line); border-radius: .7rem; }
.edit-actions { display: flex; justify-content: flex-end; gap: .65rem; }
.primary-button, .secondary-button { min-height: 2.6rem; padding: .55rem 1rem; border-radius: .7rem; cursor: pointer; font-weight: 600; }
.primary-button { color: var(--paper); background: var(--green); border: 1px solid var(--green); }
.secondary-button { color: var(--green); background: transparent; border: 1px solid var(--line); }
.primary-button:disabled, .secondary-button:disabled { cursor: not-allowed; opacity: .65; }
.edit-error { margin: 0; color: var(--orange-strong); font-size: .82rem; }
.detail-list { display: grid; grid-template-columns: .8fr 1fr 2fr; gap: 1rem; margin: 1rem 0 0; }
.detail-list div { min-width: 0; }
.detail-list dt { color: var(--muted); font-size: .72rem; }
.detail-list dd { overflow-wrap: anywhere; margin: .25rem 0 0; }
.detail-list a { color: var(--green); }
.danger-zone { margin-top: 1.5rem; }
.danger-zone button { min-height: 2.6rem; padding: .55rem 1rem; color: var(--orange-strong); background: transparent; border: 1px solid rgb(168 59 28 / 25%); border-radius: .7rem; cursor: pointer; font-weight: 600; }
.delete-error { margin: .75rem 0 0; color: var(--orange-strong); font-size: .85rem; }
@media (max-width: 52rem) { .detail-header, .detail-grid { grid-template-columns: 1fr; } .detail-list { grid-template-columns: 1fr 1fr; } }
@media (max-width: 42rem) { .task-detail-page { width: min(100% - 1.25rem, 78rem); } .edit-grid, .detail-list { grid-template-columns: 1fr; } }
</style>
