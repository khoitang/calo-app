export function toKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: string, days: number): string {
  const d = fromKey(key)
  d.setDate(d.getDate() + days)
  return toKey(d)
}

export function todayKey(): string {
  return toKey(new Date())
}

const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']

export function dayLabel(key: string): string {
  const d = fromKey(key)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${WEEKDAYS[d.getDay()]}, ${day}/${month}/${year}`
}

export function relativeDayLabel(key: string): string {
  const today = todayKey()
  if (key === today) return 'Hôm nay'
  if (key === addDays(today, -1)) return 'Hôm qua'
  if (key === addDays(today, 1)) return 'Ngày mai'
  return dayLabel(key)
}

export function isFuture(key: string): boolean {
  return key > todayKey()
}
