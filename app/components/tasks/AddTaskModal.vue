<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { TaskWithProject } from '../../../shared/types/domain'
import {
  taskCreationFormSchema,
  type TaskCreationForm,
} from '../../composables/useTaskCreation'

const props = withDefaults(defineProps<{
  open: boolean
  portal?: boolean
}>(), {
  portal: true,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  created: [task: TaskWithProject]
}>()

const {
  form,
  lookupState,
  creationState,
  fieldsVisible,
  isLookingUp,
  isSubmitting,
  isBusy,
  lookupJira,
  createTask,
  reset,
} = useTaskCreation((task) => {
  emit('created', task)
  emit('update:open', false)
})

const openModel = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

watch(() => props.open, (open) => {
  if (!open) reset()
})

function close() {
  if (!isBusy.value) emit('update:open', false)
}

function onSubmit(_event: FormSubmitEvent<TaskCreationForm>) {
  return createTask()
}
</script>

<template>
  <UModal
    v-model:open="openModel"
    title="เพิ่มงานใหม่"
    description="เริ่มจากลิงก์ Jira แล้วปรับรายละเอียดก่อนบันทึกได้"
    :portal="portal"
    :transition="false"
    :dismissible="!isBusy"
    :close="false"
    :ui="{
      content: 'w-[min(calc(100%-1rem),42rem)] max-w-2xl overflow-hidden bg-default p-0 sm:rounded-[2rem] max-sm:top-auto max-sm:bottom-0 max-sm:w-full max-sm:max-w-none max-sm:translate-y-0 max-sm:rounded-b-none',
      header: 'hidden',
    }"
  >
    <template #body>
      <div class="task-sheet">
        <header class="sheet-header">
          <div>
            <p class="eyebrow">ADD TO DAILY FOCUS</p>
            <h2>เพิ่มงานใหม่</h2>
            <p>วางลิงก์ Jira เพื่อดึงรายละเอียด หรือกรอกเองเมื่อ Jira ไม่พร้อม</p>
          </div>
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            aria-label="ปิดฟอร์มเพิ่มงาน"
            :disabled="isBusy"
            @click="close"
          />
        </header>

        <UForm
          :schema="taskCreationFormSchema"
          :state="form"
          :disabled="isSubmitting"
          class="form-body"
          @submit="onSubmit"
        >
          <section class="jira-step" aria-labelledby="jira-step-title">
            <div class="step-label">
              <span aria-hidden="true">01</span>
              <div>
                <strong id="jira-step-title">เชื่อมงานจาก Jira</strong>
                <small>JIRA LOOKUP</small>
              </div>
            </div>

            <UFormField name="jiraUrl" label="ลิงก์ Jira" required>
              <div class="lookup-row">
                <UInput
                  v-model="form.jiraUrl"
                  name="jiraUrl"
                  type="url"
                  autocomplete="url"
                  placeholder="https://company.atlassian.net/browse/OPS-421"
                  class="min-w-0 flex-1"
                />
                <UButton
                  type="button"
                  color="primary"
                  data-testid="jira-lookup"
                  :loading="isLookingUp"
                  :disabled="isBusy"
                  @click="lookupJira"
                >
                  {{ isLookingUp ? 'กำลังค้นหา' : 'ค้นหางาน' }}
                </UButton>
              </div>
            </UFormField>

            <p class="lookup-live" aria-live="polite" aria-atomic="true">
              <template v-if="isLookingUp">กำลังดึงรายละเอียดงานจาก Jira</template>
              <template v-else-if="lookupState.status === 'ready' && lookupState.source === 'jira'">
                ดึงรายละเอียดสำเร็จ คุณแก้ไขข้อมูลก่อนบันทึกได้
              </template>
            </p>

            <UAlert
              v-if="lookupState.status === 'ready' && lookupState.source === 'manual'"
              color="warning"
              variant="soft"
              icon="i-lucide-triangle-alert"
              title="ใช้การกรอกข้อมูลเอง"
              :description="lookupState.message"
              role="alert"
            />
          </section>

          <section v-if="fieldsVisible" class="details-step" aria-labelledby="details-step-title">
            <div class="step-label">
              <span aria-hidden="true">02</span>
              <div>
                <strong id="details-step-title">ตรวจสอบรายละเอียด</strong>
                <small>EDIT BEFORE SAVE</small>
              </div>
            </div>

            <TasksTaskFields v-model="form" />

            <UAlert
              v-if="creationState.status === 'error'"
              color="error"
              variant="soft"
              icon="i-lucide-circle-alert"
              title="ยังบันทึกงานไม่ได้"
              :description="creationState.message"
              role="alert"
            />

            <UAlert
              v-else-if="creationState.status === 'duplicate'"
              data-testid="duplicate-task"
              color="warning"
              variant="soft"
              icon="i-lucide-copy-check"
              title="งานนี้มีอยู่แล้ว"
              role="alert"
            >
              <template #description>
                <NuxtLink :to="`/tasks/${creationState.taskId}`">เปิดงานที่มีอยู่</NuxtLink>
              </template>
            </UAlert>

            <div class="form-actions">
              <UButton type="button" color="neutral" variant="ghost" :disabled="isBusy" @click="close">
                ยกเลิก
              </UButton>
              <UButton
                type="submit"
                color="primary"
                icon="i-lucide-plus"
                data-testid="create-task"
                :loading="isSubmitting"
                :disabled="isBusy"
              >
                {{ isSubmitting ? 'กำลังเพิ่มงาน' : 'เพิ่มเข้า Daily Focus' }}
              </UButton>
            </div>
          </section>
        </UForm>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.task-sheet { max-height: min(48rem, calc(100dvh - 1rem)); overflow-y: auto; background: var(--paper); }
.sheet-header { position: relative; display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding: 1.6rem 1.6rem 1.35rem; color: var(--paper); background: var(--green); }
.sheet-header::after { position: absolute; right: 1.6rem; bottom: 0; left: 1.6rem; height: 3px; content: ''; background: var(--orange); }
.eyebrow { margin: 0 0 .35rem; color: #f5aa8d; font-size: .68rem; font-weight: 600; letter-spacing: .16em; }
h2 { margin: 0; font-family: var(--font-display); font-size: clamp(1.55rem, 5vw, 2.2rem); }
.sheet-header p:last-child { max-width: 34rem; margin: .35rem 0 0; color: #c9d7d1; font-size: .85rem; }
.form-body { display: grid; }
.jira-step, .details-step { display: grid; gap: 1rem; padding: 1.4rem 1.6rem; }
.details-step { border-top: 1px solid var(--line); }
.step-label { display: flex; align-items: center; gap: .75rem; }
.step-label > span { display: grid; width: 2.15rem; height: 2.15rem; place-items: center; color: var(--orange-strong); background: var(--orange-soft); border-radius: 50%; font-family: var(--font-display); font-size: .72rem; font-weight: 600; }
.step-label strong, .step-label small { display: block; }
.step-label strong { color: var(--green); font-family: var(--font-display); }
.step-label small { margin-top: .05rem; color: var(--muted); font-size: .62rem; letter-spacing: .1em; }
.lookup-row { display: flex; align-items: flex-start; gap: .6rem; }
.lookup-live { min-height: 1.25rem; margin: -.4rem 0 0; color: var(--green); font-size: .78rem; }
.form-actions { display: flex; align-items: center; justify-content: flex-end; gap: .6rem; padding-top: .25rem; }
@media (max-width: 36rem) {
  .task-sheet { max-height: calc(100dvh - 1rem); }
  .sheet-header, .jira-step, .details-step { padding-inline: 1rem; }
  .lookup-row { align-items: stretch; flex-direction: column; }
  .form-actions { align-items: stretch; flex-direction: column-reverse; }
  .form-actions > * { justify-content: center; }
}
</style>
