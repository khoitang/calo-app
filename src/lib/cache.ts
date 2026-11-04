import type { DB } from '../types'
import { isDb } from './backup'

export interface CachedData {
  db: DB
  updatedAt: number
}

const KEY_PREFIX = 'calo-ngay.v2.user.'

export function userDataCacheKey(userId: string): string {
  return `${KEY_PREFIX}${userId}`
}

export function readDataCache(userId: string): CachedData | null {
  try {
    const raw = localStorage.getItem(userDataCacheKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CachedData>
    if (!parsed || !isDb(parsed.db)) return null
    return {
      db: parsed.db,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
    }
  } catch {
    return null
  }
}

export function writeDataCache(userId: string, db: DB, updatedAt = Date.now()): void {
  try {
    localStorage.setItem(userDataCacheKey(userId), JSON.stringify({ db, updatedAt }))
  } catch {
    // Hết dung lượng hoặc chế độ riêng tư: bỏ qua.
  }
}

export function clearDataCache(userId: string): void {
  try {
    localStorage.removeItem(userDataCacheKey(userId))
  } catch {
    // ignore
  }
}
