<script setup lang="ts">
import { projectLabel, useProjects } from '../../composables/useProjects'

const NEW_PROJECT_VALUE = '__new__'

const props = withDefaults(defineProps<{
  allowEmpty?: boolean
  emptyLabel?: string
  name?: string
}>(), {
  allowEmpty: false,
  emptyLabel: 'ทุกโปรเจกต์',
  name: 'projectId',
})

const model = defineModel<string>({ required: true })

const { data: projects } = useProjects()

function onChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  model.value = value
}
</script>

<template>
  <select
    :name="name"
    class="project-select"
    :value="model"
    @change="onChange"
  >
    <option v-if="allowEmpty" value="">
      {{ emptyLabel }}
    </option>
    <option
      v-for="project in projects"
      :key="project.id"
      :value="project.id"
    >
      {{ projectLabel(project) }}
    </option>
    <option v-if="!allowEmpty" :value="NEW_PROJECT_VALUE">
      + เพิ่มโปรเจกต์ใหม่
    </option>
  </select>
</template>

<style scoped>
.project-select {
  width: 100%;
  min-height: 2.8rem;
  padding: .65rem .75rem;
  color: var(--ink);
  background: var(--canvas);
  border: 1px solid transparent;
  border-radius: .7rem;
}

.project-select:hover {
  border-color: var(--line);
}
</style>
