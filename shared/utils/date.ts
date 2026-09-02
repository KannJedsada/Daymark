export function bangkokDate(value: string | Date = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value

  return `${part('year')}-${part('month')}-${part('day')}`
}

function bangkokWeekdayIndex(value: string | Date): number {
  const date = typeof value === 'string' ? new Date(`${value}T12:00:00+07:00`) : value
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    weekday: 'short',
  }).format(date)
  const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  return order.indexOf(weekday)
}

export function addBangkokDays(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00+07:00`)
  date.setUTCDate(date.getUTCDate() + days)
  return bangkokDate(date)
}

export function bangkokWeekRange(anchor: string | Date = new Date()): { from: string, to: string } {
  const anchorDate = typeof anchor === 'string' ? anchor : bangkokDate(anchor)
  const from = addBangkokDays(anchorDate, -bangkokWeekdayIndex(anchorDate))
  return { from, to: addBangkokDays(from, 6) }
}
