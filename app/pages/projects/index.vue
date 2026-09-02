<script setup lang="ts">
import { projectLabel, useProjects } from '../../composables/useProjects'

const form = reactive({
  name: '',
  jiraProjectKey: '',
})

const { data: projects, pending, error, refresh } = useProjects()
const creationState = ref<'idle' | 'submitting' | 'error'>('idle')

const canSubmit = computed(() => form.name.trim().length > 0 && creationState.value !== 'submitting')

async function createProject() {
  if (!canSubmit.value) return

  creationState.value = 'submitting'
  try {
    await $fetch('/api/projects', {
      method: 'POST',
      body: {
        name: form.name.trim(),
        jiraProjectKey: form.jiraProjectKey.trim() || undefined,
      },
    })
    form.name = ''
    form.jiraProjectKey = ''
    creationState.value = 'idle'
    await refresh()
    await refreshNuxtData('projects')
  }
  catch {
    creationState.value = 'error'
  }
}

useHead({
  title: 'โปรเจกต์ · DAYMARK',
  meta: [{ name: 'description', content: 'บันทึกรหัสและชื่อโปรเจกต์เพื่อเลือกใช้เมื่อเพิ่มงาน' }],
})
</script>

<template>
  <div class="projects-page">
    <header class="page-header">
      <div>
        <p class="kicker">PROJECT REGISTRY</p>
        <h1>โปรเจกต์</h1>
        <p class="lede">บันทึกรหัสและชื่อโปรเจกต์เพื่อเลือกใช้ในฟอร์มเพิ่มงานและตัวกรอง</p>
      </div>
    </header>

    <form class="create-card" aria-label="เพิ่มโปรเจกต์" @submit.prevent="createProject">
      <div class="card-heading">
        <strong>เพิ่มโปรเจกต์</strong>
        <small>SAVE PROJECT</small>
      </div>

      <label>
        <span>ชื่อโปรเจกต์</span>
        <input v-model="form.name" name="name" autocomplete="off" placeholder="Operations" required>
      </label>

      <label>
        <span>รหัสโปรเจกต์</span>
        <input v-model="form.jiraProjectKey" name="jiraProjectKey" autocomplete="off" placeholder="OPS">
      </label>

      <button type="submit" :disabled="!canSubmit">
        {{ creationState === 'submitting' ? 'กำลังบันทึก' : 'บันทึกโปรเจกต์' }}
      </button>

      <p v-if="creationState === 'error'" class="form-error" role="alert">
        บันทึกโปรเจกต์ไม่สำเร็จ กรุณาลองอีกครั้ง
      </p>
    </form>

    <section class="list-card" aria-labelledby="project-list-title">
      <div class="card-heading">
        <strong id="project-list-title">โปรเจกต์ทั้งหมด</strong>
        <small>ALL PROJECTS</small>
      </div>

      <p class="sr-only" role="status" aria-live="polite">
        {{ pending ? 'กำลังโหลดโปรเจกต์' : error ? 'โหลดโปรเจกต์ไม่สำเร็จ' : 'โหลดโปรเจกต์แล้ว' }}
      </p>

      <SharedAppErrorState v-if="error" @retry="refresh" />

      <div v-else-if="pending" class="skeleton-list" aria-hidden="true">
        <div v-for="index in 3" :key="index" class="skeleton-row" />
      </div>

      <SharedAppEmptyState
        v-else-if="projects.length === 0"
        title="ยังไม่มีโปรเจกต์"
        description="เพิ่มโปรเจกต์แรกด้านบน หรือบันทึกผ่านฟอร์มเพิ่มงาน"
      />

      <ul v-else class="project-list">
        <li v-for="project in projects" :key="project.id">
          <div>
            <strong>{{ project.name }}</strong>
            <span v-if="project.jiraProjectKey" class="project-key">{{ project.jiraProjectKey }}</span>
          </div>
          <span class="project-meta">{{ projectLabel(project) }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.projects-page { width: min(100% - 2rem, 78rem); padding: clamp(2rem, 6vw, 4rem) 0 5rem; margin-inline: auto; }
.page-header { margin-bottom: 1.5rem; }
.kicker { margin: 0 0 .5rem; color: var(--orange-strong); font-size: .75rem; font-weight: 600; letter-spacing: .16em; }
h1 { margin: 0; color: var(--green); font-family: var(--font-display); font-size: clamp(2.4rem, 6vw, 4rem); }
.lede { margin: .75rem 0 0; color: var(--muted); max-width: 36rem; }
.create-card, .list-card { display: grid; gap: 1rem; padding: 1.25rem; margin-bottom: 1rem; background: rgb(255 252 246 / 88%); border: 1px solid var(--line); border-radius: var(--radius-md); }
.card-heading strong, .card-heading small { display: block; }
.card-heading strong { color: var(--green); font-family: var(--font-display); }
.card-heading small { margin-top: .1rem; color: var(--muted); font-size: .65rem; letter-spacing: .1em; }
label { color: var(--muted); font-size: .78rem; }
label span { display: block; margin-bottom: .35rem; }
input { width: 100%; min-height: 2.8rem; padding: .65rem .75rem; color: var(--ink); background: var(--canvas); border: 1px solid transparent; border-radius: .7rem; }
input:hover { border-color: var(--line); }
button[type='submit'] { min-height: 2.8rem; color: var(--paper); background: var(--green); border: 0; border-radius: .7rem; cursor: pointer; font-weight: 600; }
button[type='submit']:disabled { opacity: .55; cursor: not-allowed; }
.form-error { margin: 0; color: var(--orange-strong); font-size: .85rem; }
.project-list { padding: 0; margin: 0; list-style: none; }
.project-list li { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .85rem 0; border-bottom: 1px solid var(--line); }
.project-list li:last-child { border-bottom: 0; }
.project-key { margin-left: .5rem; padding: .15rem .45rem; color: var(--green); background: var(--green-soft); border-radius: 999px; font-size: .72rem; font-weight: 600; }
.project-meta { color: var(--muted); font-size: .78rem; }
.skeleton-list { display: grid; gap: .75rem; }
.skeleton-row { height: 3rem; background: #ded9cf; border-radius: .7rem; }
@media (max-width: 42rem) { .projects-page { width: min(100% - 1.25rem, 78rem); } .project-list li { flex-direction: column; align-items: flex-start; } }
</style>
