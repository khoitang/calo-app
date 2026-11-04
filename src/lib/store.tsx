import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { DB, Food, LogEntry, Profile, SyncState, User } from '../types'
import { SEED_FOODS } from '../data/seedFoods'
import { api } from './api'
import { isDb } from './backup'
import { readDataCache, writeDataCache } from './cache'
import { uid } from './logs'

const LEGACY_KEY = 'calo-ngay.v1'

function defaultDb(): DB {
  return { profile: null, foods: [...SEED_FOODS], logs: [] }
}

function mergeSeeds(foods: Food[]): Food[] {
  const byId = new Map(foods.map((f) => [f.id, f]))
  for (const seed of SEED_FOODS) {
    // Seed luôn lấy theo phiên bản mới; món người dùng tự thêm giữ nguyên.
    if (!byId.has(seed.id) || !byId.get(seed.id)?.custom) {
      byId.set(seed.id, seed)
    }
  }
  return [...byId.values()]
}

function normalizeDb(db: DB): DB {
  return {
    profile: db.profile ?? null,
    foods: mergeSeeds(Array.isArray(db.foods) ? db.foods : []),
    logs: Array.isArray(db.logs) ? db.logs : [],
  }
}

function loadLegacy(): DB | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isDb(parsed) ? parsed : null
  } catch {
    return null
  }
}

function removeLegacy(): void {
  try {
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    // ignore
  }
}

interface StoreValue {
  db: DB
  syncState: SyncState
  setProfile: (profile: Profile) => void
  upsertFood: (food: Food) => void
  deleteFood: (id: string) => void
  addLog: (entry: Omit<LogEntry, 'id' | 'at'>) => void
  updateLog: (id: string, grams: number) => void
  deleteLog: (id: string) => void
  copyDay: (from: string, to: string) => number
  replaceAll: (db: DB) => void
  reset: () => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ user, children }: { user: User; children: ReactNode }) {
  const [db, setDb] = useState<DB>(() => {
    const cached = readDataCache(user.id)
    if (cached) return normalizeDb(cached.db)
    const legacy = loadLegacy()
    if (legacy) return normalizeDb(legacy)
    return defaultDb()
  })
  const [syncState, setSyncState] = useState<SyncState>('loading')
  const [hydrated, setHydrated] = useState(false)

  const dbRef = useRef(db)
  dbRef.current = db
  const dirtyRef = useRef(false)
  const hydratedRef = useRef(false)
  const lastPushedRef = useRef('')
  const cacheStampRef = useRef(Date.now())
  const inFlightRef = useRef(false)
  const queuedRef = useRef<DB | null>(null)

  const flush = useCallback(async (data: DB) => {
    if (inFlightRef.current) {
      queuedRef.current = data
      return
    }
    inFlightRef.current = true
    setSyncState('saving')
    try {
      await api.putData(data)
      lastPushedRef.current = JSON.stringify(data)
      console.log('[store] putData thành công:', data.profile ? 'có profile' : 'không profile', 'foods:', data.foods.length, 'logs:', data.logs.length)
      if (!queuedRef.current) {
        dirtyRef.current = false
        setSyncState('saved')
      }
    } catch (err) {
      dirtyRef.current = true
      setSyncState('offline')
      console.error('[store] putData thất bại:', err)
    } finally {
      inFlightRef.current = false
      const next = queuedRef.current
      queuedRef.current = null
      if (next) void flush(next)
    }
  }, [])

  // Tải dữ liệu của user: ưu tiên bản mới hơn giữa server và cache offline.
  useEffect(() => {
    let cancelled = false
    const cached = readDataCache(user.id)
    setSyncState('loading')

    ;(async () => {
      let gotRemote = false
      try {
        const remote = await api.getData()
        gotRemote = true
        if (cancelled) return
        const remoteOk = isDb(remote.data)
        const remoteData = remoteOk ? (remote.data as DB) : null
        const remoteHasProfile = Boolean(remoteData?.profile)
        const localHasProfile = Boolean(cached?.db?.profile)
        const remoteNewer = remoteOk && (!cached || (remote.updatedAt ?? 0) >= (cached.updatedAt ?? 0))

        // Quyết định dùng dữ liệu nào làm cơ sở:
        // - Nếu remote có profile: luôn ưu tiên remote (không để local null ghi đè).
        // - Nếu remote không có profile nhưng local có: dùng local, sau đó push lên server.
        // - Cả hai đều không có profile: dùng local (để user tạo profile lần đầu).
        const useRemote = remoteHasProfile || (!localHasProfile && remoteNewer)

        if (useRemote && remoteData) {
          const next = normalizeDb(remoteData)
          const stamp = remote.updatedAt ?? Date.now()
          cacheStampRef.current = stamp
          lastPushedRef.current = JSON.stringify(next)
          writeDataCache(user.id, next, stamp)
          setDb(next)
          setSyncState('saved')
        } else {
          const base = cached?.db ?? loadLegacy() ?? defaultDb()
          const next = normalizeDb(base)
          cacheStampRef.current = Date.now()
          writeDataCache(user.id, next, cacheStampRef.current)
          setDb(next)
          // Chỉ push lên server khi dữ liệu có ý nghĩa (tránh ghi đè profile có sẵn bằng null).
          if (next.profile || !remoteHasProfile) {
            await api.putData(next)
          }
          if (cancelled) return
          lastPushedRef.current = JSON.stringify(next)
          setSyncState('saved')
        }

        removeLegacy()
        hydratedRef.current = true
        setHydrated(true)
      } catch {
        if (cancelled) return
        // Không có mạng: dùng dữ liệu đã cache, đồng bộ lại khi online.
        // Chỉ lấy bản hiện tại làm mốc khi chưa đọc được server; nếu đọc được
        // nhưng ghi thất bại thì vẫn phải giữ trạng thái "chưa lưu" để thử lại.
        if (!gotRemote) lastPushedRef.current = JSON.stringify(dbRef.current)
        setSyncState('offline')
        hydratedRef.current = true
        setHydrated(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user.id])

  // Lưu cache ngay, đẩy lên server sau 500ms để gộp các thay đổi liên tiếp.
  useEffect(() => {
    const serialized = JSON.stringify(db)
    if (serialized === lastPushedRef.current) {
      writeDataCache(user.id, db, cacheStampRef.current)
      dirtyRef.current = false
      if (hydrated && navigator.onLine) {
        setSyncState((prev) => (prev === 'saving' ? 'saved' : prev))
      }
      return
    }

    cacheStampRef.current = Date.now()
    writeDataCache(user.id, db, cacheStampRef.current)
    if (!hydrated) return

    dirtyRef.current = true
    setSyncState('saving')
    const timer = window.setTimeout(() => {
      void flush(db)
    }, 500)
    return () => window.clearTimeout(timer)
  }, [db, hydrated, user.id, flush])

  // Khi có mạng lại: nếu có thay đổi chưa lưu thì đẩy lên, nếu không thì
  // kiểm tra xem thiết bị khác có bản mới hơn không.
  const syncNow = useCallback(async () => {
    if (!hydratedRef.current || inFlightRef.current) return
    try {
      const remote = await api.getData()
      const cached = readDataCache(user.id)
      const remoteOk = isDb(remote.data)
      const remoteNewer = remoteOk && (!cached || (remote.updatedAt ?? 0) >= cached.updatedAt)

      if (!dirtyRef.current && remoteNewer) {
        const next = normalizeDb(remote.data as DB)
        const stamp = remote.updatedAt ?? Date.now()
        cacheStampRef.current = stamp
        lastPushedRef.current = JSON.stringify(next)
        writeDataCache(user.id, next, stamp)
        setDb(next)
        setSyncState('saved')
        return
      }
      await flush(dbRef.current)
    } catch {
      setSyncState('offline')
    }
  }, [flush, user.id])

  useEffect(() => {
    const onOnline = () => void syncNow()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [syncNow])

  // Đóng tab / chuyển trang: cố gắng gửi nốt thay đổi cuối.
  useEffect(() => {
    const flushOnExit = () => {
      if (!dirtyRef.current) return
      try {
        void fetch('/api/data', {
          method: 'PUT',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ data: dbRef.current }),
          keepalive: true,
        })
      } catch {
        // ignore
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushOnExit()
    }
    window.addEventListener('pagehide', flushOnExit)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flushOnExit)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const setProfile = useCallback((profile: Profile) => {
    console.log('[store] setProfile:', profile.sex, profile.age, profile.weightKg, 'kg')
    setDb((prev) => ({ ...prev, profile }))
  }, [])

  const upsertFood = useCallback((food: Food) => {
    setDb((prev) => {
      const exists = prev.foods.some((f) => f.id === food.id)
      return {
        ...prev,
        foods: exists ? prev.foods.map((f) => (f.id === food.id ? food : f)) : [...prev.foods, food],
      }
    })
  }, [])

  const deleteFood = useCallback((id: string) => {
    setDb((prev) => ({
      ...prev,
      foods: prev.foods.filter((f) => f.id !== id),
      logs: prev.logs.filter((l) => l.foodId !== id),
    }))
  }, [])

  const addLog = useCallback((entry: Omit<LogEntry, 'id' | 'at'>) => {
    setDb((prev) => ({
      ...prev,
      logs: [...prev.logs, { ...entry, id: uid(), at: Date.now() }],
    }))
  }, [])

  const updateLog = useCallback((id: string, grams: number) => {
    setDb((prev) => ({
      ...prev,
      logs: prev.logs.map((l) => (l.id === id ? { ...l, grams } : l)),
    }))
  }, [])

  const deleteLog = useCallback((id: string) => {
    setDb((prev) => ({ ...prev, logs: prev.logs.filter((l) => l.id !== id) }))
  }, [])

  const copyDay = useCallback((from: string, to: string) => {
    let copied = 0
    setDb((prev) => {
      const source = prev.logs.filter((l) => l.date === from)
      copied = source.length
      if (source.length === 0) return prev
      const now = Date.now()
      const copies = source.map((l, i) => ({
        ...l,
        id: uid(),
        date: to,
        at: now + i,
      }))
      return { ...prev, logs: [...prev.logs, ...copies] }
    })
    return copied
  }, [])

  const replaceAll = useCallback((next: DB) => {
    setDb(normalizeDb(next))
  }, [])

  const reset = useCallback(() => {
    setDb(defaultDb())
  }, [])

  const value = useMemo<StoreValue>(
    () => ({
      db,
      syncState,
      setProfile,
      upsertFood,
      deleteFood,
      addLog,
      updateLog,
      deleteLog,
      copyDay,
      replaceAll,
      reset,
    }),
    [
      db,
      syncState,
      setProfile,
      upsertFood,
      deleteFood,
      addLog,
      updateLog,
      deleteLog,
      copyDay,
      replaceAll,
      reset,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}
