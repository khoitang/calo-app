import { useRef, useState } from 'react'
import { readBackup } from '../lib/backup'
import { useAuth } from '../lib/auth'
import { useStore } from '../lib/store'
import { Icon } from './Icon'
import { ProfileForm } from './ProfileForm'

export function Onboarding() {
  const { setProfile, replaceAll } = useStore()
  const { user, logout } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)

  const restore = async (file: File) => {
    try {
      const db = await readBackup(file)
      if (!db.profile) throw new Error('no profile')
      if (!window.confirm('Khôi phục dữ liệu từ file sao lưu? Dữ liệu hiện tại sẽ bị thay thế.')) {
        return
      }
      replaceAll(db)
      setMessage(null)
    } catch {
      setMessage('File không hợp lệ. Chọn file JSON đã xuất từ app này.')
    }
  }

  return (
    <div className="onboarding">
      <div className="hero">
        <div className="hero-mark">
          <Icon name="bowl" size={32} />
        </div>
        <h1>Biết mình ăn bao nhiêu</h1>
        <p>
          Nhập vài thông tin để tính nhu cầu calo mỗi ngày. Ghi bữa ăn mất chưa tới 10 giây.
        </p>
      </div>

      {message && <div className="toast-inline">{message}</div>}

      <ProfileForm submitLabel="Bắt đầu theo dõi" onSubmit={setProfile} />

      <button className="restore-link" onClick={() => fileRef.current?.click()}>
        Đã có file sao lưu? Khôi phục dữ liệu
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void restore(file)
          e.target.value = ''
        }}
      />

      <p className="hint center">
        Dữ liệu lưu theo tài khoản · Tự đồng bộ khi có mạng · Vẫn dùng được offline
      </p>

      <div className="onboarding-account">
        <span>{user?.email}</span>
        <button className="link-btn" onClick={() => void logout()}>
          Đăng xuất
        </button>
      </div>
    </div>
  )
}
