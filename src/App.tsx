import { useEffect, useRef, useState } from 'react'
import { calorieTarget } from './lib/calc'
import { todayKey } from './lib/date'
import { useStore } from './lib/store'
import { useAuth } from './lib/auth'
import { Icon } from './components/Icon'
import { LibraryView } from './components/LibraryView'
import { Onboarding } from './components/Onboarding'
import { ProfileView } from './components/ProfileView'
import { TodayView } from './components/TodayView'
import { AdminView } from './components/AdminView'

type Tab = 'today' | 'library' | 'profile' | 'admin'

const TABS: { id: Tab; label: string; icon: 'bowl' | 'book' | 'user' | 'shield' }[] = [
  { id: 'today', label: 'Hôm nay', icon: 'bowl' },
  { id: 'library', label: 'Thư viện', icon: 'book' },
  { id: 'profile', label: 'Hồ sơ', icon: 'user' },
]

export default function App() {
  const { db, syncState } = useStore()
  const { user, logout } = useAuth()
  const [tab, setTab] = useState<Tab>('today')
  const [date, setDate] = useState(todayKey())
  const hadProfile = useRef(false)

  const visibleTabs = user?.role === 'admin'
    ? [...TABS, { id: 'admin', label: 'Quản trị', icon: 'shield' }]
    : TABS

  // Khi có hồ sơ mới (onboarding hoặc khôi phục file), đưa về tab Hôm nay.
  useEffect(() => {
    if (!db.profile) {
      hadProfile.current = false
      return
    }
    if (!hadProfile.current) {
      hadProfile.current = true
      setTab('today')
    }
  }, [db.profile])

  if (!db.profile) {
    return (
      <div className="app">
        <Onboarding />
      </div>
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="bowl" size={17} />
          </span>
          Calo Ngày
        </div>
        <div className="topbar-right">
          <span
            className={`sync-dot ${syncState}`}
            title={
              syncState === 'offline'
                ? 'Ngoại tuyến'
                : syncState === 'saving'
                  ? 'Đang lưu'
                  : syncState === 'loading'
                    ? 'Đang tải dữ liệu'
                    : 'Đã đồng bộ'
            }
            aria-hidden="true"
          />
          <span className="topbar-target">{calorieTarget(db.profile)} kcal/ngày</span>
          <div className="topbar-user">
            <span className="topbar-user-name">{user?.name || user?.email}</span>
            <button className="btn ghost btn.small" onClick={() => void logout()}>
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      <main className="content">
        {syncState === 'offline' && (
          <div className="sync-banner">Ngoại tuyến · thay đổi sẽ đồng bộ khi có mạng</div>
        )}
        {tab === 'today' && <TodayView date={date} onDateChange={setDate} />}
        {tab === 'library' && <LibraryView />}
        {tab === 'profile' && <ProfileView />}
        {tab === 'admin' && <AdminView />}
      </main>

      <nav className="tabbar" aria-label="Điều hướng chính">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id as Tab)}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            <Icon name={t.icon as 'bowl' | 'book' | 'user' | 'shield'} size={21} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
