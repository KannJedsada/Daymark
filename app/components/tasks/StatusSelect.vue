<script setup lang="ts">
import type { TaskStatus, TaskWithProject } from '~~/shared/types/domain'
import { TASK_STATUSES } from '~~/shared/types/domain'

const model = defineModel<TaskStatus>()

const props = defineProps<{
  taskId: string
  disabled?: boolean
  label?: string
}>()

const emit = defineEmits<{
  updated: [task: TaskWithProject]
}>()

const busy = ref(false)
const errorMessage = ref('')
const fieldId = computed(() => `task-status-${props.taskId}`)
const errorId = computed(() => `task-status-error-${props.taskId}`)

const options: Array<{ value: TaskStatus, label: string }> = [
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
]

async function onStatusChange(event: Event) {
  const next = (event.target as HTMLSelectElement).value as TaskStatus
  if (!model.value || !TASK_STATUSES.includes(next) || next === model.value || busy.value || props.disabled) return

  const previous = model.value
  errorMessage.value = ''
  busy.value = true
  model.value = next

  try {
    const task = await $fetch<TaskWithProject>(`/api/tasks/${props.taskId}`, {
      method: 'PATCH',
      body: { status: next },
    })
    model.value = task.status
    emit('updated', task)
    await refreshNuxtData(['dashboard', 'tasks', `task-${props.taskId}`])
  }
  catch {
    errorMessage.value = 'อัปเดตสถานะไม่สำเร็จ'
    model.value = previous
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="status-select">
    <label :for="fieldId">{{ label ?? 'สถานะ' }}</label>
    <select
      :id="fieldId"
      name="status"
      :value="model"
      :disabled="disabled || busy"
      :aria-describedby="errorMessage ? errorId : undefined"
      :aria-invalid="errorMessage ? 'true' : undefined"
      @change="onStatusChange"
    >
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
    <p v-if="errorMessage" :id="errorId" class="field-error" role="alert">{{ errorMessage }}</p>
  </div>
</template>

<style scoped>
.status-select { display: grid; gap: .35rem; }
label { color: var(--muted); font-size: .78rem; }
select { width: 100%; min-height: 2.8rem; padding: .65rem .75rem; color: var(--ink); background: var(--canvas); border: 1px solid var(--line); border-radius: .7rem; }
.field-error { margin: 0; color: var(--orange-strong); font-size: .78rem; }
</style>
