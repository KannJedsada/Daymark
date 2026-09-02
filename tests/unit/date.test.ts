import { describe, expect, it } from 'vitest'

import { bangkokDate, bangkokWeekRange, addBangkokDays } from '../../shared/utils/date'

describe('bangkokDate', () => {
  it('uses the Bangkok calendar day across UTC midnight', () => {
    expect(bangkokDate('2026-08-31T18:30:00.000Z')).toBe('2026-09-01')
  })

  it('accepts a Date value', () => {
    expect(bangkokDate(new Date('2026-09-01T16:59:59.000Z'))).toBe('2026-09-01')
  })
})

describe('bangkokWeekRange', () => {
  it('returns Monday through Sunday for a midweek Bangkok date', () => {
    expect(bangkokWeekRange('2026-09-03')).toEqual({
      from: '2026-08-31',
      to: '2026-09-06',
    })
  })

  it('uses addBangkokDays to walk the week forward', () => {
    const { from } = bangkokWeekRange('2026-09-03')
    expect(addBangkokDays(from, 6)).toBe('2026-09-06')
  })
})
