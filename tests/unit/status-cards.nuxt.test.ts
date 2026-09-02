import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'

import StatusCards from '../../app/components/dashboard/StatusCards.vue'
import AppErrorState from '../../app/components/shared/AppErrorState.vue'

describe('StatusCards', () => {
  it('labels every status count in text', async () => {
    const wrapper = await mountSuspended(StatusCards, {
      props: { counts: { todo: 12, inProgress: 5, done: 28 } },
    })

    expect(wrapper.text()).toContain('Todo')
    expect(wrapper.text()).toContain('12')
    expect(wrapper.text()).toContain('In progress')
    expect(wrapper.text()).toContain('5')
    expect(wrapper.text()).toContain('Done')
    expect(wrapper.text()).toContain('28')
    expect(wrapper.findAll('[data-status-label]')).toHaveLength(3)
  }, 15_000)

  it('exposes a retry action when dashboard loading fails', async () => {
    const wrapper = await mountSuspended(AppErrorState)

    await wrapper.get('button').trigger('click')

    expect(wrapper.attributes('role')).toBe('alert')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})
