import { useEffect, useRef, useState } from 'react'
import { downloadBackup, readBackup } from '../lib/backup'
import { useAuth } from '../lib/auth'
import { useStore } from '../lib/store'
import { Icon } from './Icon'
import { ProfileForm } from './ProfileForm'

export function ProfileView() {
  const { db, setProfile, replaceAll, reset } = useStore()
  const { user, logout } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [saved, setSaved] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!saved) return
    const t = window.setTimeout(() => setSaved(false), 2200)
    return () => window.clearTimeout(t)
  }, [saved])

  useEffect(() => {
    if (!message) return
    const t = window.setTimeout(() => setMessage(null), 3200)
    return () => window.clearTimeout(t)
  }, [message])

  if (!db.profile) return null

  const exportData = () => {
    downloadBackup(db)
    setMessage('Đã tải file sao lưu.')
  }

  const importData = async (file: File) => {
    try {
      const parsed = await readBackup(file)
      if (!window.confirm('Thay thế toàn bộ dữ liệu hiện tại bằng file sao lưu? Không thể hoàn tác.')) {
        return
      }
      replaceAll(parsed)
      setMessage('Đã khôi phục dữ liệu từ file.')
    } catch {
      setMessage('File không hợp lệ. Chọn file JSON xuất từ app này.')
    }
  }

  return (
    <div className="profile-view">
      <div className="page-head">
        <div>
          <h1>Hồ sơ</h1>
          <p>Chỉnh thông tin để cập nhật mục tiêu calo.</p>
        </div>
      </div>

      {saved && <div className="toast-inline">Đã lưu hồ sơ.</div>}
      {message && <div className="toast-inline">{message}</div>}

      <section className="card account-card">
        <div className="account-main">
          {user?.avatarUrl ? (
            <img
              className="account-avatar"
              src={user.avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="account-avatar fallback">
              <Icon name="user" size={20} />
            </span>
          )}
          <div className="account-info">
            <strong>{user?.name || user?.email || 'Tài khoản'}</strong>
            <span>{user?.email}</span>
          </div>
        </div>
        <div className="account-methods">
          {user?.hasPassword && <span className="account-badge">Mật khẩu</span>}
          {user?.hasGoogle && <span className="account-badge google">Google</span>}
        </div>
        <button className="btn ghost block" onClick={() => void logout()}>
          Đăng xuất
        </button>
      </section>

      <ProfileForm
        initial={db.profile}
        submitLabel="Lưu hồ sơ"
        onSubmit={(p) => {
          setProfile(p)
          setSaved(true)
        }}
      />

      <section className="card form-card">
        <h2 className="card-title">Dữ liệu</h2>
        <p className="hint no-top">
          Dữ liệu được lưu vào tài khoản của bạn và tự đồng bộ giữa các thiết bị khi có mạng (
          {db.logs.length} mục nhật ký, {db.foods.length} món). Máy này giữ thêm một bản offline để
          dùng khi mất mạng. Bạn vẫn nên xuất file sao lưu định kỳ.
        </p>
        <div className="row-2">
          <button className="btn ghost" onClick={exportData}>
            <Icon name="download" size={18} /> Xuất file
          </button>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={18} /> Nhập file
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void importData(file)
            e.target.value = ''
          }}
        />
        <button
          className="btn ghost danger block"
          onClick={() => {
            if (
              window.confirm(
                'Xoá toàn bộ hồ sơ, món tự thêm và nhật ký của tài khoản này? Hành động không thể hoàn tác.',
              )
            ) {
              reset()
            }
          }}
        >
          Xoá toàn bộ dữ liệu
        </button>
      </section>

      <p className="hint">
        App chỉ mang tính tham khảo, không thay thế tư vấn của bác sĩ hoặc chuyên gia dinh dưỡng.
      </p>
    </div>
  )
}
