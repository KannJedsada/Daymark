<script setup lang="ts">
const { title, description, actionLabel } = defineProps<{
  title: string
  description: string
  actionLabel?: string
}>()

const emit = defineEmits<{ action: [] }>()
</script>

<template>
  <section class="empty-state" aria-labelledby="empty-state-title">
    <span class="empty-mark" aria-hidden="true">↗</span>
    <h2 id="empty-state-title">{{ title }}</h2>
    <p>{{ description }}</p>
    <button v-if="actionLabel" type="button" @click="emit('action')">{{ actionLabel }}</button>
  </section>
</template>

<style scoped>
.empty-state { display: grid; min-height: 22rem; place-items: center; align-content: center; padding: 3rem 1.5rem; text-align: center; background: var(--paper); border: 1px dashed #bdb7aa; border-radius: var(--radius-lg); }
.empty-mark { display: grid; width: 3.5rem; height: 3.5rem; place-items: center; margin-bottom: 1rem; color: var(--orange-strong); background: var(--orange-soft); border-radius: 50%; font-size: 1.6rem; }
h2 { margin: 0; font-family: var(--font-display); font-size: clamp(1.5rem, 4vw, 2.25rem); color: var(--green); }
p { max-width: 32rem; margin: .65rem auto 1.5rem; color: var(--muted); }
button { min-height: 2.8rem; padding: .65rem 1.1rem; color: white; background: var(--orange-strong); border: 0; border-radius: 999px; cursor: pointer; font-weight: 600; }
</style>
