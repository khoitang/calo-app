import { useEffect, useState, type FormEvent } from 'react'
import { AUTH_MESSAGES, authErrorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Icon } from './Icon'

type Mode = 'login' | 'register'

export function AuthScreen() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(() => {
    const code = new URLSearchParams(window.location.search).get('auth_error')
    return code ? (AUTH_MESSAGES[code] ?? AUTH_MESSAGES.request_failed) : null
  })

  useEffect(() => {
    if (window.location.search) {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
    setPassword('')
    setConfirm('')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    if (mode === 'register' && password !== confirm) {
      setError('Mật khẩu nhập lại không khớp.')
      return
    }
    setBusy(true)
    try {
      if (mode === 'login') await login(email.trim(), password)
      else await register(email.trim(), password)
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-screen">
      <header className="auth-brand">
        <span className="brand-mark large">
          <Icon name="bowl" size={24} />
        </span>
        <div>
          <h1>Calo Ngày</h1>
          <p>Ăn có chủ đích, không cần đếm từng hạt gạo.</p>
        </div>
      </header>

      <section className="card auth-card">
        <div className="segment auth-tabs">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => switchMode('login')}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'active' : ''}
            onClick={() => switchMode('register')}
          >
            Đăng ký
          </button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <label className="field">
            <span>Email</span>
            <input
              className="text-input"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="ban@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="field">
            <span>Mật khẩu</span>
            <div className="password-wrap">
              <input
                className="text-input"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder={mode === 'register' ? 'Ít nhất 8 ký tự' : '••••••••'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? 'Ẩn' : 'Hiện'}
              </button>
            </div>
          </label>

          {mode === 'register' && (
            <label className="field">
              <span>Nhập lại mật khẩu</span>
              <input
                className="text-input"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={8}
                required
              />
            </label>
          )}

          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}

          <button className="btn primary block large" type="submit" disabled={busy}>
            {busy ? 'Đang xử lý…' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
          </button>
        </form>

        <div className="divider">
          <span>hoặc</span>
        </div>

        <a className="btn google block" href="/api/auth/google">
          <GoogleIcon />
          Tiếp tục với Google
        </a>

        <p className="hint center">
          {mode === 'register'
            ? 'Tạo tài khoản để dữ liệu được lưu riêng và đồng bộ giữa các thiết bị.'
            : 'Chưa có tài khoản? Chọn Đăng ký ở trên.'}
        </p>
      </section>

      <p className="auth-foot">
        Mỗi tài khoản có nhật ký riêng. App vẫn mở được offline sau lần đăng nhập đầu.
      </p>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41.1 35.2 44 30 44 24c0-1.3-.1-2.3-.4-3.5z"
      />
    </svg>
  )
}
