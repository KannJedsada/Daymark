<script setup lang="ts">
import type { WorkLog } from '../../../shared/types/domain'
import { bangkokDate } from '../../../shared/utils/date'
import { createWorkLogSchema } from '../../../shared/schemas/task'

const props = defineProps<{
  taskId: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  created: [log: WorkLog]
}>()

const form = reactive({
  workedOn: bangkokDate(),
  note: '',
  minutesSpent: '',
})

const busy = ref(false)
const errorMessage = ref('')

async function submit() {
  if (busy.value || props.disabled) return

  errorMessage.value = ''
  const minutesRaw = String(form.minutesSpent ?? '').trim()
  const minutes = minutesRaw ? Number.parseInt(minutesRaw, 10) : undefined

  const parsed = createWorkLogSchema.safeParse({
    workedOn: form.workedOn,
    note: form.note,
    minutesSpent: minutes,
  })

  if (!parsed.success) {
    errorMessage.value = parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง'
    return
  }

  busy.value = true
  try {
    const log = await $fetch<WorkLog>(`/api/tasks/${props.taskId}/work-logs`, {
      method: 'POST',
      body: parsed.data,
    })
    form.note = ''
    form.minutesSpent = ''
    form.workedOn = bangkokDate()
    emit('created', log)
    await refreshNuxtData(['dashboard', 'tasks', `task-${props.taskId}`])
  }
  catch {
    errorMessage.value = 'บันทึกงานรายวันไม่สำเร็จ'
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <form class="work-log-form" aria-labelledby="work-log-form-title" @submit.prevent="submit">
    <h3 id="work-log-form-title">บันทึกความคืบหน้า</h3>

    <label>
      <span>วันที่ทำงาน</span>
      <input v-model="form.workedOn" name="workedOn" type="date" required :disabled="busy || disabled">
    </label>

    <label>
      <span>บันทึก</span>
      <textarea
        v-model="form.note"
        name="note"
        rows="4"
        maxlength="2000"
        required
        placeholder="ทำอะไรบ้างวันนี้"
        :disabled="busy || disabled"
        :aria-describedby="errorMessage ? 'work-log-error' : undefined"
      />
    </label>

    <label>
      <span>นาที (ไม่บังคับ)</span>
      <input
        v-model="form.minutesSpent"
        name="minutesSpent"
        type="number"
        min="1"
        max="1440"
        placeholder="45"
        :disabled="busy || disabled"
      >
    </label>

    <p v-if="errorMessage" id="work-log-error" class="field-error" role="alert">{{ errorMessage }}</p>

    <button type="submit" data-testid="add-work-log" :disabled="busy || disabled">
      {{ busy ? 'กำลังบันทึก' : 'เพิ่มบันทึก' }}
    </button>
  </form>
</template>

<style scoped>
.work-log-form { display: grid; gap: 1rem; padding: 1.25rem; background: rgb(255 252 246 / 88%); border: 1px solid var(--line); border-radius: var(--radius-md); }
h3 { margin: 0; color: var(--green); font-family: var(--font-display); font-size: 1.15rem; }
label { color: var(--muted); font-size: .78rem; }
label span { display: block; margin-bottom: .35rem; }
input, textarea { width: 100%; padding: .65rem .75rem; color: var(--ink); background: var(--canvas); border: 1px solid transparent; border-radius: .7rem; }
input:hover, textarea:hover { border-color: var(--line); }
textarea { resize: vertical; min-height: 6rem; }
button { min-height: 2.8rem; padding: .65rem 1rem; color: var(--paper); background: var(--green); border: 0; border-radius: .7rem; cursor: pointer; font-weight: 600; }
button:disabled { opacity: .65; cursor: not-allowed; }
.field-error { margin: 0; color: var(--orange-strong); font-size: .78rem; }
</style>
