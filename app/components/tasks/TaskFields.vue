<script setup lang="ts">
import { z } from 'zod'

import type { TaskCreationForm } from '../../composables/useTaskCreation'
import { useProjects } from '../../composables/useProjects'

const NEW_PROJECT_VALUE = '__new__'

const model = defineModel<TaskCreationForm>({ required: true })
const { data: projects } = useProjects()

const usesExistingProject = computed(() => z.uuid().safeParse(model.value.projectId).success)
const showManualProjectFields = computed(() => !usesExistingProject.value)

watch(
  [() => model.value.jiraProjectKey, () => model.value.projectName, projects],
  () => {
    if (usesExistingProject.value) return

    const key = model.value.jiraProjectKey.trim().toUpperCase()
    const name = model.value.projectName.trim().toLowerCase()
    const match = projects.value.find(project =>
      (key && project.jiraProjectKey === key)
      || (name && project.name.toLowerCase() === name),
    )

    if (match) {
      model.value.projectId = match.id
      return
    }

    model.value.projectId = NEW_PROJECT_VALUE
  },
  { immediate: true },
)
</script>

<template>
  <div class="task-fields">
    <div class="field-grid">
      <UFormField name="jiraKey" label="รหัส Jira" required>
        <UInput
          v-model="model.jiraKey"
          name="jiraKey"
          autocomplete="off"
          placeholder="OPS-421"
          class="w-full"
        />
      </UFormField>

      <UFormField name="projectId" label="โปรเจกต์" required>
        <ProjectsProjectSelect v-model="model.projectId" />
      </UFormField>
    </div>

    <div v-if="showManualProjectFields" class="field-grid">
      <UFormField name="jiraProjectKey" label="รหัสโปรเจกต์" hint="ไม่บังคับ">
        <UInput
          v-model="model.jiraProjectKey"
          name="jiraProjectKey"
          autocomplete="off"
          placeholder="OPS"
          class="w-full"
        />
      </UFormField>

      <UFormField name="projectName" label="ชื่อโปรเจกต์" required>
        <UInput
          v-model="model.projectName"
          name="projectName"
          autocomplete="off"
          placeholder="ชื่อโปรเจกต์"
          class="w-full"
        />
      </UFormField>
    </div>

    <UFormField name="summary" label="ชื่องาน" required>
      <UInput
        v-model="model.summary"
        name="summary"
        autocomplete="off"
        placeholder="งานนี้ต้องทำอะไร"
        class="w-full"
      />
    </UFormField>

    <div class="status-row" data-testid="default-status">
      <span>
        <small>สถานะเริ่มต้น</small>
        <strong>Todo</strong>
      </span>
      <span class="status-dot" aria-hidden="true" />
    </div>
  </div>
</template>

<style scoped>
.task-fields { display: grid; gap: 1rem; }
.field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.status-row { display: flex; min-height: 3.4rem; align-items: center; justify-content: space-between; padding: .75rem .9rem; background: var(--green-soft); border: 1px solid rgb(24 61 50 / 10%); border-radius: .85rem; }
.status-row small, .status-row strong { display: block; }
.status-row small { color: var(--muted); font-size: .72rem; }
.status-row strong { margin-top: .08rem; color: var(--green); font-family: var(--font-display); }
.status-dot { width: .7rem; height: .7rem; background: var(--green); border-radius: 50%; box-shadow: 0 0 0 .35rem rgb(24 61 50 / 10%); }
@media (max-width: 36rem) { .field-grid { grid-template-columns: 1fr; } }
</style>
