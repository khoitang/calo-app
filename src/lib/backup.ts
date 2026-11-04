import type { DB } from '../types'
import { todayKey } from './date'

export function isDb(value: unknown): value is DB {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<DB>
  if (!Array.isArray(v.foods) || !Array.isArray(v.logs)) return false
  return v.foods.every(
    (f) =>
      f &&
      typeof f.id === 'string' &&
      typeof f.name === 'string' &&
      typeof f.kcal === 'number' &&
      typeof f.servingGrams === 'number',
  )
}

export function downloadBackup(db: DB): void {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `calo-backup-${todayKey()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function readBackup(file: File): Promise<DB> {
  const parsed: unknown = JSON.parse(await file.text())
  if (!isDb(parsed)) throw new Error('invalid backup')
  return parsed
}
