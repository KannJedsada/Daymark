<script setup lang="ts">
const route = useRoute()
const addTaskRequested = useState('daymark:add-task-requested', () => false)

const navigation = [
  { label: 'Dashboard', labelThai: 'ภาพรวม', to: '/' },
  { label: 'Tasks', labelThai: 'งานทั้งหมด', to: '/tasks' },
  { label: 'Projects', labelThai: 'โปรเจกต์', to: '/projects' },
  { label: 'Weekly', labelThai: 'รายสัปดาห์', to: '/reports/weekly' },
] as const

function requestAddTask() {
  addTaskRequested.value = true
}

function handleCreated() {
  addTaskRequested.value = false
}
</script>

<template>
  <div class="app-shell">
    <a class="skip-link" href="#main-content">ข้ามไปยังเนื้อหาหลัก</a>

    <header class="site-header">
      <div class="header-inner">
        <NuxtLink class="wordmark" to="/" aria-label="DAYMARK หน้าแรก">
          <span class="wordmark-mark" aria-hidden="true">D</span>
          <span>DAYMARK</span>
        </NuxtLink>

        <nav aria-label="เมนูหลัก">
          <ul class="nav-list">
            <li v-for="item in navigation" :key="item.to">
              <NuxtLink
                :to="item.to"
                class="nav-link"
                :class="{ 'nav-link-active': route.path === item.to }"
                :aria-current="route.path === item.to ? 'page' : undefined"
              >
                <span>{{ item.labelThai }}</span>
                <span class="nav-english" aria-hidden="true">{{ item.label }}</span>
              </NuxtLink>
            </li>
          </ul>
        </nav>

        <button class="add-task-button" type="button" @click="requestAddTask">
          <span aria-hidden="true">＋</span>
          <span>เพิ่มงาน</span>
        </button>
      </div>

    </header>

    <TasksAddTaskModal v-model:open="addTaskRequested" @created="handleCreated" />

    <main id="main-content" tabindex="-1">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.app-shell { min-height: 100vh; }
.skip-link { position: fixed; z-index: 100; top: .75rem; left: .75rem; padding: .75rem 1rem; color: var(--paper); background: var(--green); border-radius: var(--radius-sm); transform: translateY(-160%); transition: transform 160ms ease; }
.skip-link:focus { transform: translateY(0); }
.site-header { position: sticky; z-index: 20; top: 0; border-bottom: 1px solid rgb(24 61 50 / 12%); background: rgb(244 240 231 / 88%); backdrop-filter: blur(18px); }
.header-inner { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; width: min(100% - 2rem, 78rem); min-height: 5rem; margin-inline: auto; }
.wordmark { display: inline-flex; align-items: center; gap: .65rem; width: max-content; color: var(--green); font-family: var(--font-display); font-size: .95rem; font-weight: 700; letter-spacing: .12em; text-decoration: none; }
.wordmark-mark { display: grid; width: 2rem; height: 2rem; place-items: center; color: var(--paper); background: var(--green); border-radius: 50% 50% 50% .35rem; letter-spacing: 0; }
.nav-list { display: flex; gap: .25rem; padding: 0; margin: 0; list-style: none; }
.nav-link { display: flex; align-items: baseline; gap: .35rem; padding: .65rem .9rem; color: var(--muted); border-radius: 999px; font-size: .94rem; text-decoration: none; transition: color 160ms ease, background 160ms ease; }
.nav-link:hover, .nav-link-active { color: var(--green); background: rgb(255 252 246 / 80%); }
.nav-english { font-size: .68rem; text-transform: uppercase; letter-spacing: .08em; opacity: .72; }
.add-task-button { justify-self: end; display: inline-flex; min-height: 2.85rem; align-items: center; gap: .4rem; padding: .65rem 1.05rem; color: white; background: var(--orange-strong); border: 0; border-radius: 999px; box-shadow: 0 8px 20px rgb(168 59 28 / 22%); cursor: pointer; font-weight: 600; transition: transform 160ms ease, box-shadow 160ms ease; }
.add-task-button:hover { transform: translateY(-2px); box-shadow: 0 11px 24px rgb(232 97 53 / 28%); }
@media (max-width: 46rem) {
  .header-inner { grid-template-columns: 1fr auto; min-height: 4.5rem; }
  nav { grid-column: 1 / -1; grid-row: 2; padding-bottom: .55rem; }
  .nav-list { justify-content: center; }
  .nav-english { display: none; }
}
</style>
