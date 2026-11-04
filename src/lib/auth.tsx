import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '../types'
import { api, ApiError } from './api'
import { clearDataCache } from './cache'

const USER_CACHE_KEY = 'calo-ngay.auth.user'

function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<User>
    if (!parsed || typeof parsed.id !== 'string' || typeof parsed.email !== 'string') return null
    return parsed as User
  } catch {
    return null
  }
}

function writeCachedUser(user: User | null): void {
  try {
    if (user) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user))
    else localStorage.removeItem(USER_CACHE_KEY)
  } catch {
    // ignore
  }
}

interface AuthValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const applyUser = useCallback((next: User | null) => {
    setUser(next)
    writeCachedUser(next)
  }, [])

  useEffect(() => {
    let cancelled = false
    api
      .me()
      .then(({ user: sessionUser }) => {
        if (!cancelled) applyUser(sessionUser)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        // Mất mạng: dùng phiên đã cache để app vẫn mở được offline.
        if (error instanceof ApiError && error.status === 401) {
          applyUser(null)
          return
        }
        const cached = readCachedUser()
        setUser(cached)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [applyUser])

  const login = useCallback(
    async (email: string, password: string) => {
      const { user: next } = await api.login(email, password)
      applyUser(next)
    },
    [applyUser],
  )

  const register = useCallback(
    async (email: string, password: string) => {
      const { user: next } = await api.register(email, password)
      applyUser(next)
    },
    [applyUser],
  )

  const logout = useCallback(async () => {
    const current = user
    try {
      await api.logout()
    } catch {
      // Server không phản hồi vẫn cho đăng xuất ở phía client.
    }
    if (current) clearDataCache(current.id)
    applyUser(null)
  }, [applyUser, user])

  const value = useMemo<AuthValue>(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
