<script setup lang="ts">
import type { TaskStatus } from '~~/shared/types/domain'
import { TASK_STATUSES } from '~~/shared/types/domain'

export interface TaskFilterValues {
  status: string
  projectId: string
  query: string
  date: string
}

const model = defineModel<TaskFilterValues>({ required: true })

const statusOptions: Array<{ value: string, label: string }> = [
  { value: '', label: 'ทุกสถานะ' },
  ...TASK_STATUSES.map(status => ({
    value: status,
    label: status === 'todo' ? 'Todo' : status === 'in_progress' ? 'In progress' : 'Done',
  })),
]
</script>

<template>
  <form class="task-filters" aria-label="ตัวกรองงาน" @submit.prevent>
    <label>
      <span>สถานะ</span>
      <select v-model="model.status" name="status">
        <option v-for="option in statusOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </label>

    <label>
      <span>โปรเจกต์</span>
      <ProjectsProjectSelect
        v-model="model.projectId"
        allow-empty
        empty-label="ทุกโปรเจกต์"
      />
    </label>

    <label class="query-field">
      <span>ค้นหา</span>
      <input
        v-model="model.query"
        name="query"
        type="search"
        placeholder="ชื่องาน"
        autocomplete="off"
      >
    </label>

    <label>
      <span>วันที่บันทึก</span>
      <input v-model="model.date" name="date" type="date">
    </label>
  </form>
</template>

<style scoped>
.task-filters { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; padding: 1.25rem; background: rgb(255 252 246 / 88%); border: 1px solid var(--line); border-radius: var(--radius-md); }
label { color: var(--muted); font-size: .78rem; }
label span { display: block; margin-bottom: .35rem; }
input, select { width: 100%; min-height: 2.8rem; padding: .65rem .75rem; color: var(--ink); background: var(--canvas); border: 1px solid transparent; border-radius: .7rem; }
input:hover, select:hover { border-color: var(--line); }
@media (max-width: 52rem) { .task-filters { grid-template-columns: 1fr 1fr; } }
@media (max-width: 36rem) { .task-filters { grid-template-columns: 1fr; } }
</style>
