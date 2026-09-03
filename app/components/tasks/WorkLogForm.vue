<script setup lang="ts">
import type { WorkLog } from '~~/shared/types/domain'
import { createWorkLogSchema } from '~~/shared/schemas/task'
import { bangkokDate } from '~~/shared/utils/date'

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
const fieldErrors = reactive<Partial<Record<'workedOn' | 'note' | 'minutesSpent', string>>>({})
const workedOnInput = ref<HTMLInputElement | null>(null)
const noteInput = ref<HTMLTextAreaElement | null>(null)
const minutesInput = ref<HTMLInputElement | null>(null)

function clearValidationErrors() {
  fieldErrors.workedOn = undefined
  fieldErrors.note = undefined
  fieldErrors.minutesSpent = undefined
}

function describeIssue(field: keyof typeof fieldErrors) {
  if (field === 'workedOn') return 'กรุณาระบุวันที่ทำงานให้ถูกต้อง'
  if (field === 'note') return 'กรุณาระบุสิ่งที่ทำ'
  return 'นาทีต้องเป็นจำนวนเต็มระหว่าง 1–1,440'
}

async function focusFirstInvalidField() {
  await nextTick()
  if (fieldErrors.workedOn) workedOnInput.value?.focus()
  else if (fieldErrors.note) noteInput.value?.focus()
  else if (fieldErrors.minutesSpent) minutesInput.value?.focus()
}

async function submit() {
  if (busy.value || props.disabled) return

  errorMessage.value = ''
  clearValidationErrors()
  const minutesRaw = String(form.minutesSpent ?? '').trim()
  const minutes = minutesRaw ? Number(minutesRaw) : undefined

  const parsed = createWorkLogSchema.safeParse({
    workedOn: form.workedOn,
    note: form.note,
    minutesSpent: minutes,
  })

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0]
      if ((field === 'workedOn' || field === 'note' || field === 'minutesSpent') && !fieldErrors[field]) {
        fieldErrors[field] = describeIssue(field)
      }
    }
    await focusFirstInvalidField()
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
  <form class="work-log-form" aria-labelledby="work-log-form-title" novalidate @submit.prevent="submit">
    <h3 id="work-log-form-title">บันทึกความคืบหน้า</h3>

    <label for="work-log-worked-on">
      <span>วันที่ทำงาน</span>
      <input
        id="work-log-worked-on"
        ref="workedOnInput"
        v-model="form.workedOn"
        name="workedOn"
        type="date"
        required
        :disabled="busy || disabled"
        :aria-invalid="fieldErrors.workedOn ? 'true' : undefined"
        :aria-describedby="fieldErrors.workedOn ? 'work-log-worked-on-error' : undefined"
      >
    </label>
    <p v-if="fieldErrors.workedOn" id="work-log-worked-on-error" class="field-error" role="alert">
      {{ fieldErrors.workedOn }}
    </p>

    <label for="work-log-note">
      <span>บันทึก</span>
      <textarea
        id="work-log-note"
        ref="noteInput"
        v-model="form.note"
        name="note"
        rows="4"
        maxlength="2000"
        required
        placeholder="ทำอะไรบ้างวันนี้"
        :disabled="busy || disabled"
        :aria-invalid="fieldErrors.note ? 'true' : undefined"
        :aria-describedby="fieldErrors.note ? 'work-log-note-error' : undefined"
      />
    </label>
    <p v-if="fieldErrors.note" id="work-log-note-error" class="field-error" role="alert">
      {{ fieldErrors.note }}
    </p>

    <label for="work-log-minutes">
      <span>นาที (ไม่บังคับ)</span>
      <input
        id="work-log-minutes"
        ref="minutesInput"
        v-model="form.minutesSpent"
        name="minutesSpent"
        type="number"
        min="1"
        max="1440"
        step="1"
        inputmode="numeric"
        placeholder="45"
        :disabled="busy || disabled"
        :aria-invalid="fieldErrors.minutesSpent ? 'true' : undefined"
        :aria-describedby="fieldErrors.minutesSpent ? 'work-log-minutes-error' : undefined"
      >
    </label>
    <p v-if="fieldErrors.minutesSpent" id="work-log-minutes-error" class="field-error" role="alert">
      {{ fieldErrors.minutesSpent }}
    </p>

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
