import { describe, expect, it } from 'vitest'

import { bangkokDate } from '../../shared/utils/date'

describe('bangkokDate', () => {
  it('uses the Bangkok calendar day across UTC midnight', () => {
    expect(bangkokDate('2026-08-31T18:30:00.000Z')).toBe('2026-09-01')
  })

  it('accepts a Date value', () => {
    expect(bangkokDate(new Date('2026-09-01T16:59:59.000Z'))).toBe('2026-09-01')
  })
})
