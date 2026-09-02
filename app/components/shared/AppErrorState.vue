<script setup lang="ts">
defineProps<{ message?: string }>()
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <section class="error-state" role="alert" aria-labelledby="dashboard-error-title">
    <span aria-hidden="true">!</span>
    <div>
      <h2 id="dashboard-error-title">โหลดภาพรวมไม่สำเร็จ</h2>
      <p>{{ message || 'ลองเชื่อมต่ออีกครั้ง ข้อมูลเดิมของคุณจะไม่หาย' }}</p>
    </div>
    <button type="button" @click="emit('retry')">ลองอีกครั้ง</button>
  </section>
</template>

<style scoped>
.error-state { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 1rem; padding: 1.25rem; background: #fff4ef; border: 1px solid #e7a287; border-radius: var(--radius-md); }
.error-state > span { display: grid; width: 2.5rem; height: 2.5rem; place-items: center; color: white; background: var(--orange-strong); border-radius: 50%; font-weight: 700; }
h2, p { margin: 0; }
h2 { color: var(--green); font-family: var(--font-display); font-size: 1.1rem; }
p { margin-top: .2rem; color: var(--muted); }
button { min-height: 2.65rem; padding: .55rem .9rem; color: var(--green); background: var(--paper); border: 1px solid var(--green); border-radius: 999px; cursor: pointer; font-weight: 600; }
@media (max-width: 38rem) { .error-state { grid-template-columns: auto 1fr; } button { grid-column: 1 / -1; } }
</style>
