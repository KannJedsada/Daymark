<script setup lang="ts">
interface Counts {
  todo: number
  inProgress: number
  done: number
}

const { counts } = defineProps<{ counts: Counts }>()

const cards = computed(() => [
  { key: 'todo', label: 'Todo', labelThai: 'รอเริ่ม', value: counts.todo, symbol: '○' },
  { key: 'in-progress', label: 'In progress', labelThai: 'กำลังทำ', value: counts.inProgress, symbol: '→' },
  { key: 'done', label: 'Done', labelThai: 'เสร็จแล้ว', value: counts.done, symbol: '✓' },
])
</script>

<template>
  <section aria-labelledby="status-overview-title">
    <h2 id="status-overview-title" class="sr-only">จำนวนงานแยกตามสถานะ</h2>
    <ul class="status-grid">
      <li v-for="card in cards" :key="card.key" class="status-card" :class="`status-${card.key}`">
        <div class="status-heading">
          <span class="status-symbol" aria-hidden="true">{{ card.symbol }}</span>
          <span data-status-label>
            <strong>{{ card.labelThai }}</strong>
            <small>{{ card.label }}</small>
          </span>
        </div>
        <p :aria-label="`${card.labelThai} ${card.value} งาน`">{{ card.value }}</p>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.status-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; padding: 0; margin: 0; list-style: none; }
.status-card { position: relative; min-height: 10.5rem; padding: 1.3rem; overflow: hidden; background: var(--paper); border: 1px solid var(--line); border-radius: var(--radius-md); box-shadow: var(--shadow-paper); animation: rise-in 460ms both; }
.status-card::after { position: absolute; right: -2.2rem; bottom: -3.5rem; width: 8rem; height: 8rem; content: ''; background: var(--green-soft); border-radius: 50%; opacity: .6; }
.status-in-progress { animation-delay: 70ms; }
.status-done { animation-delay: 140ms; }
.status-in-progress::after { background: var(--orange-soft); }
.status-done { color: var(--paper); background: var(--green); border-color: var(--green); }
.status-done::after { background: #2f594d; }
.status-heading { position: relative; z-index: 1; display: flex; align-items: center; gap: .75rem; }
.status-symbol { display: grid; width: 2.4rem; height: 2.4rem; place-items: center; border: 1px solid currentColor; border-radius: 50%; font-size: 1.1rem; }
.status-heading strong, .status-heading small { display: block; }
.status-heading strong { font-family: var(--font-display); font-size: 1rem; }
.status-heading small { color: var(--muted); font-size: .72rem; letter-spacing: .06em; text-transform: uppercase; }
.status-done small { color: #b8cbc5; }
p { position: relative; z-index: 1; margin: 1.2rem 0 0; font-family: var(--font-display); font-size: clamp(2.5rem, 6vw, 4.3rem); font-weight: 600; line-height: .9; }
@keyframes rise-in { from { opacity: 0; transform: translateY(10px); } }
@media (max-width: 42rem) { .status-grid { grid-template-columns: 1fr; } .status-card { min-height: 7.5rem; } p { margin-top: .8rem; } }
</style>
