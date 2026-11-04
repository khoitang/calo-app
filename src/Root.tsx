import { useAuth } from './lib/auth'
import { StoreProvider } from './lib/store'
import App from './App'
import { AuthScreen } from './components/AuthScreen'
import { Icon } from './components/Icon'

export function Root() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="app">
        <div className="splash">
          <div className="hero-mark">
            <Icon name="bowl" size={30} />
          </div>
          <span>Đang tải…</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="app">
        <AuthScreen />
      </div>
    )
  }

  return (
    <StoreProvider key={user.id} user={user}>
      <App />
    </StoreProvider>
  )
}
