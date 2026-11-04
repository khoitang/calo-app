import { useCallback, useEffect, useState } from 'react'
import type { User, Food, LogEntry, Profile } from '../types'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { calorieTarget } from '../lib/calc'
import { dayLabel } from '../lib/date'

function round(n: number) {
  return Math.round(n * 10) / 10
}

export function AdminView() {
  const { user: currentUser, logout } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState<{
    user: User
    data: { profile: unknown; foods: Food[]; logs: LogEntry[] } | null
    updatedAt: number | null
  } | null>(null)

  // Xoá xác nhận
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [confirmDeleteEmail, setConfirmDeleteEmail] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Đổi role xác nhận
  const [confirmRoleId, setConfirmRoleId] = useState<string | null>(null)
  const [confirmRoleEmail, setConfirmRoleEmail] = useState<string | null>(null)
  const [confirmRoleTo, setConfirmRoleTo] = useState<'admin' | 'user'>('user')
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null)

  const isMyself = (id: string) => Boolean(currentUser && currentUser.id === id)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { users: list } = await api.adminUsers()
      setUsers(list)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không tải được danh sách user.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const openDetail = useCallback(async (id: string) => {
    setSelectedId(id)
    setDetailLoading(true)
    try {
      const d = await api.adminUserData(id)
      setDetail({
        user: d.user,
        data: d.data ? (d.data as { profile: unknown; foods: Food[]; logs: LogEntry[] }) : null,
        updatedAt: d.updatedAt,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không tải được dữ liệu user.'
      setError(msg)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const closeDetail = useCallback(() => {
    setSelectedId(null)
    setDetail(null)
  }, [])

  const requestDelete = useCallback((id: string, email: string) => {
    if (isMyself(id)) return
    setConfirmDeleteId(id)
    setConfirmDeleteEmail(email)
  }, [isMyself])

  const cancelDelete = useCallback(() => {
    setConfirmDeleteId(null)
    setConfirmDeleteEmail(null)
  }, [])

  const doDelete = useCallback(async () => {
    if (!confirmDeleteId) return
    setDeletingId(confirmDeleteId)
    try {
      await api.adminDeleteUser(confirmDeleteId)
      await loadUsers()
      if (selectedId === confirmDeleteId) {
        closeDetail()
      }
      cancelDelete()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Xoá không thành công.'
      setError(msg)
    } finally {
      setDeletingId(null)
    }
  }, [confirmDeleteId, selectedId, closeDetail, loadUsers, cancelDelete])

  const requestRoleChange = useCallback((id: string, email: string, to: 'admin' | 'user') => {
    if (isMyself(id)) return
    setConfirmRoleId(id)
    setConfirmRoleEmail(email)
    setConfirmRoleTo(to)
  }, [isMyself])

  const cancelRoleChange = useCallback(() => {
    setConfirmRoleId(null)
    setConfirmRoleEmail(null)
    setConfirmRoleTo('user')
  }, [])

  const doRoleChange = useCallback(async () => {
    if (!confirmRoleId) return
    setChangingRoleId(confirmRoleId)
    try {
      await api.adminSetRole(confirmRoleId, confirmRoleTo)
      await loadUsers()
      cancelRoleChange()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Thay đổi quyền không thành công.'
      setError(msg)
    } finally {
      setChangingRoleId(null)
    }
  }, [confirmRoleId, confirmRoleTo, loadUsers, cancelRoleChange])

  const formatDate = (ts: number | null) => {
    if (!ts) return '-'
    return new Date(ts).toLocaleString('vi-VN')
  }

  const formatShortDate = (ts: number | null) => {
    if (!ts) return '-'
    return new Date(ts).toLocaleDateString('vi-VN')
  }

  // ---------- Tóm tắt dữ liệu ----------
  const totalKcal = (logs: LogEntry[], foods: Food[]) => {
    const map = new Map(foods.map((f) => [f.id, f.kcal]))
    return logs.reduce((sum, l) => {
      const kcalPerG = map.get(l.foodId) || 0
      return sum + Math.round((kcalPerG / 100) * l.grams)
    }, 0)
  }

  // ---------- Nhóm logs theo ngày ----------
  const logsByDate = (logs: LogEntry[]) => {
    const grouped = new Map<string, LogEntry[]>()
    for (const log of logs) {
      const arr = grouped.get(log.date) || []
      arr.push(log)
      grouped.set(log.date, arr)
    }
    return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }

  if (loading) {
    return (
      <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
        <span>Đang tải…</span>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">A</span>
          Admin · Calo Ngày
        </div>
        <div className="topbar-right">
          <span
            className={`sync-dot saved`}
            title="Đã đồng bộ"
            aria-hidden="true"
          />
          <span className="topbar-target">{users.length} tài khoản</span>
          <div className="topbar-user">
            <span className="topbar-user-name">{currentUser?.name || currentUser?.email}</span>
            <button className="btn ghost btn.small" onClick={() => void window.location.reload()}>
              Tải lại
            </button>
            <button className="btn ghost btn.small" onClick={() => void logout()}>
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      <main className="content">
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: '12px', marginBottom: 12, fontSize: '13px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: '22px', letterSpacing: '-0.03em', marginBottom: 3 }}>Quản trị người dùng</h2>
            <p style={{ fontSize: '12.5px', color: '#6b7a71' }}>
              Xem danh sách tài khoản và chi tiết nhật ký calo theo từng ngày của từng user.
            </p>
          </div>
          <p style={{ fontSize: '12px', color: '#8b998f' }}>{users.length} tài khoản</p>
        </div>

        <div className="card list-card">
          <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid #f1f4f1' }}>
            <input
              type="text"
              placeholder="Tìm theo email hoặc tên…"
              style={{
                width: '100%',
                height: 40,
                padding: '0 12px',
                border: '1px solid #e3e9e3',
                borderRadius: 11,
                background: '#f5f7f5',
                fontSize: 14,
                outline: 'none',
              }}
            />
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#6b7a71', fontWeight: 600, fontSize: '11px' }}>
                <th style={{ padding: '10px 14px', borderBottom: '1px solid #f1f4f1' }}>Email</th>
                <th style={{ padding: '10px 14px', borderBottom: '1px solid #f1f4f1' }}>Tên</th>
                <th style={{ padding: '10px 14px', borderBottom: '1px solid #f1f4f1', textAlign: 'center' }}>Vai trò</th>
                <th style={{ padding: '10px 14px', borderBottom: '1px solid #f1f4f1' }}>Tạo vào</th>
                <th style={{ padding: '10px 14px', borderBottom: '1px solid #f1f4f1', textAlign: 'right' }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isDeleting = deletingId === u.id
                const isChangingRole = changingRoleId === u.id
                const myself = isMyself(u.id)
                return (
                  <tr
                    key={u.id}
                    className="admin-row"
                    style={{ borderBottom: '1px solid #f3f6f3', cursor: 'pointer' }}
                    onClick={() => openDetail(u.id)}
                  >
                    <td style={{ padding: '10px 14px', fontWeight: 500 }}>{u.email}</td>
                    <td style={{ padding: '10px 14px', color: '#33463b' }}>{u.name || '—'}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 999,
                          fontSize: '10.5px',
                          fontWeight: 650,
                          background: u.role === 'admin' ? '#e8f6ec' : '#f4f7f4',
                          color: u.role === 'admin' ? '#0f7a37' : '#46534b',
                          border: `1px solid ${u.role === 'admin' ? '#cdebd7' : '#e3e9e3'}`,
                        }}
                      >
                        {u.role === 'admin' ? 'Admin' : 'User'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#8b998f' }}>{formatShortDate(u.createdAt ?? null)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      {!myself && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            requestRoleChange(
                              u.id,
                              u.email,
                              u.role === 'admin' ? 'user' : 'admin',
                            )
                          }}
                          disabled={isChangingRole}
                          className="btn ghost"
                          style={{
                            padding: '6px 10px',
                            fontSize: '12px',
                            opacity: isChangingRole ? 0.6 : 1,
                          }}
                        >
                          {isChangingRole
                            ? '…'
                            : u.role === 'admin'
                              ? 'Gỡ admin'
                              : 'Đặt admin'}
                        </button>
                      )}
                      {!myself && u.role !== 'admin' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            requestDelete(u.id, u.email)
                          }}
                          disabled={isDeleting}
                          className="btn danger btn.small"
                          style={{
                            padding: '6px 10px',
                            fontSize: '12px',
                            opacity: isDeleting ? 0.6 : 1,
                          }}
                        >
                          {isDeleting ? 'Đang xoá…' : 'Xoá'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 26, textAlign: 'center', color: '#6b7a71' }}>
                    Chưa có tài khoản nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Chi tiết user - xem theo từng ngày */}
      {selectedId && (
        <div className="sheet-layer" onClick={closeDetail} style={{ zIndex: 70 }}>
          <div className="sheet-backdrop" onClick={(e) => e.stopPropagation()} />
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <button className="icon-btn tiny" onClick={closeDetail}>
                ✕
              </button>
              <div>
                <h2 style={{ fontSize: '19px', letterSpacing: '-0.025em' }}>{detail?.user.email}</h2>
                <p className="sheet-sub">
                  {detail?.user.name || 'Chưa có tên'} ·
                  {detail?.user.role === 'admin' ? 'Admin' : 'User'} ·
                  ID {detail?.user.id}
                </p>
              </div>
              {detail && !isMyself(detail.user.id) && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      requestRoleChange(
                        detail.user.id,
                        detail.user.email,
                        detail.user.role === 'admin' ? 'user' : 'admin',
                      )
                    }}
                    disabled={changingRoleId === detail.user.id}
                    className="btn ghost"
                    style={{
                      padding: '6px 10px',
                      fontSize: '12px',
                      opacity: changingRoleId === detail.user.id ? 0.6 : 1,
                    }}
                  >
                    {changingRoleId === detail.user.id
                      ? '…'
                      : detail.user.role === 'admin'
                        ? 'Gỡ quyền admin'
                        : 'Đặt làm admin'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      requestDelete(detail.user.id, detail.user.email)
                    }}
                    disabled={
                      detail.user.role === 'admin' || deletingId === detail.user.id
                    }
                    className="btn danger btn.small"
                    style={{
                      padding: '6px 10px',
                      fontSize: '12px',
                      marginLeft: 6,
                      opacity: detail.user.role === 'admin' || deletingId === detail.user.id ? 0.6 : 1,
                    }}
                  >
                    {deletingId === detail.user.id ? 'Đang xoá…' : 'Xoá user này'}
                  </button>
                </>
              )}
            </div>

            <div className="sheet-body" style={{ paddingTop: 0 }}>
              {detailLoading ? (
                <div style={{ padding: 26, textAlign: 'center', color: '#6b7a71' }}>Đang tải dữ liệu…</div>
              ) : detail ? (
                <div>
                  {/* Profile */}
                  {(detail.data?.profile as Profile | null) && (
                    <div className="form-card" style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: '12px', fontWeight: 650, color: '#55645b', marginBottom: 8 }}>
                        Hồ sơ người dùng
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, fontSize: '12.5px', color: '#33463b' }}>
                        <div>
                          <div style={{ fontSize: '10.5px', color: '#8b998f', marginBottom: 2 }}>Giới tính</div>
                          <div>{(detail.data!.profile as Profile).sex === 'male' ? 'Nam' : 'Nữ'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '10.5px', color: '#8b998f', marginBottom: 2 }}>Tuổi</div>
                          <div>{(detail.data!.profile as Profile).age}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '10.5px', color: '#8b998f', marginBottom: 2 }}>Chiều cao</div>
                          <div>{(detail.data!.profile as Profile).heightCm} cm</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '10.5px', color: '#8b998f', marginBottom: 2 }}>Cân nặng</div>
                          <div>{(detail.data!.profile as Profile).weightKg} kg</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '10.5px', color: '#8b998f', marginBottom: 2 }}>Mục tiêu</div>
                          <div>
                            {(detail.data!.profile as Profile).goal === 'lose'
                              ? 'Giảm cân'
                              : (detail.data!.profile as Profile).goal === 'maintain'
                                ? 'Duy trì'
                                : 'Tăng cân'}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '10.5px', color: '#8b998f', marginBottom: 2 }}>Mục tiêu calo</div>
                          <div style={{ fontWeight: 700 }}>{calorieTarget(detail.data!.profile as Profile)} kcal/ngày</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Nhật ký theo ngày */}
                  <div style={{ fontSize: '12px', fontWeight: 650, color: '#55645b', marginBottom: 8 }}>
                    Nhật ký calo theo ngày
                  </div>

                  {!detail.data || !detail.data.logs || detail.data.logs.length === 0 ? (
                    <div style={{ padding: 26, textAlign: 'center', color: '#8b998f' }}>
                      Chưa có nhật ký calo nào.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {logsByDate(detail.data!.logs).map(([date, logs]) => {
                        const foodsMap = new Map(detail.data!.foods.map((f) => [f.id, f]))
                        const dayTotal = totalKcal(logs, detail.data!.foods)
                        return (
                          <div key={date} style={{ border: '1px solid #e3e9e3', borderRadius: 12, overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f6f9f6', borderBottom: '1px solid #e3e9e3', fontSize: '12.5px', fontWeight: 600, color: '#33463b' }}>
                              <span>{dayLabel(date)}</span>
                              <span>{dayTotal} kcal</span>
                            </div>
                            <div style={{ padding: '0 14px 10px' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                <thead>
                                  <tr style={{ textAlign: 'left', color: '#8b998f', fontSize: '10.5px' }}>
                                    <th style={{ padding: '6px 4px', borderBottom: '1px solid #f1f4f1' }}>Bữa</th>
                                    <th style={{ padding: '6px 4px', borderBottom: '1px solid #f1f4f1' }}>Món ăn</th>
                                    <th style={{ padding: '6px 4px', borderBottom: '1px solid #f1f4f1', textAlign: 'right' }}>Khẩu phần</th>
                                    <th style={{ padding: '6px 4px', borderBottom: '1px solid #f1f4f1', textAlign: 'right' }}>Calo</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {logs.map((l) => {
                                    const food = foodsMap.get(l.foodId)
                                    const kcal = food ? Math.round((food.kcal / 100) * l.grams) : 0
                                    const mealLabel = (() => {
                                      switch (l.meal) {
                                        case 'breakfast': return 'Sáng'
                                        case 'lunch': return 'Trưa'
                                        case 'dinner': return 'Tối'
                                        case 'snack': return 'Ăn vặt'
                                        default: return l.meal
                                      }
                                    })()
                                    return (
                                      <tr key={l.id} style={{ borderBottom: '1px solid #f3f6f3' }}>
                                        <td style={{ padding: '6px 4px', color: '#46534b' }}>{mealLabel}</td>
                                        <td style={{ padding: '6px 4px', color: '#33463b' }}>{food?.name || 'Không xác định'}</td>
                                        <td style={{ padding: '6px 4px', textAlign: 'right', color: '#33463b' }}>{l.grams}g</td>
                                        <td style={{ padding: '6px 4px', textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>{kcal} kcal</td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <div style={{ marginTop: 10, fontSize: '11.5px', color: '#8b998f' }}>
                    Cập nhật lần cuối: {formatDate(detail.updatedAt)}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Dialog xác nhận xoá */}
      {confirmDeleteId && (
        <div className="sheet-layer" style={{ zIndex: 80 }}>
          <div className="sheet-backdrop" onClick={cancelDelete} />
          <div className="sheet" style={{ maxWidth: 420, maxHeight: '60dvh', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: 24, textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: '20px', marginBottom: 10 }}>⚠️</div>
              <h2 style={{ fontSize: '18px', marginBottom: 8 }}>Xoá người dùng?</h2>
              <p style={{ fontSize: '13px', color: '#6b7a71', lineHeight: 1.5, marginBottom: 20 }}>
                Bạn chắc chắn muốn xoá tài khoản<br />
                <strong>{confirmDeleteEmail}</strong>?<br />
                Tất cả dữ liệu (hồ sơ, món ăn, nhật ký calo) sẽ bị xóa vĩnh viễn và không thể khôi phục.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button
                  onClick={cancelDelete}
                  className="btn ghost"
                  style={{ padding: '10px 18px', fontSize: '13px' }}
                >
                  Hủy
                </button>
                <button
                  onClick={doDelete}
                  disabled={deletingId === confirmDeleteId}
                  className="btn danger"
                  style={{ padding: '10px 20px', fontSize: '13px' }}
                >
                  {deletingId === confirmDeleteId ? 'Đang xoá…' : 'Xoá vĩnh viễn'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dialog xác nhận đổi role */}
      {confirmRoleId && (
        <div className="sheet-layer" style={{ zIndex: 80 }}>
          <div className="sheet-backdrop" onClick={cancelRoleChange} />
          <div className="sheet" style={{ maxWidth: 420, maxHeight: '60dvh', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: 24, textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: '20px', marginBottom: 10 }}>{confirmRoleTo === 'admin' ? '👑' : '👤'}</div>
              <h2 style={{ fontSize: '18px', marginBottom: 8 }}>
                {confirmRoleTo === 'admin' ? 'Đặt làm admin?' : 'Gỡ quyền admin?'}
              </h2>
              <p style={{ fontSize: '13px', color: '#6b7a71', lineHeight: 1.5, marginBottom: 20 }}>
                Bạn chắc chắn muốn<br />
                <strong>{confirmRoleTo === 'admin' ? 'Đặt' : 'Gỡ'}</strong> quyền admin cho<br />
                <strong>{confirmRoleEmail}</strong>?
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button
                  onClick={cancelRoleChange}
                  className="btn ghost"
                  style={{ padding: '10px 18px', fontSize: '13px' }}
                >
                  Hủy
                </button>
                <button
                  onClick={doRoleChange}
                  disabled={changingRoleId === confirmRoleId}
                  className="btn primary"
                  style={{ padding: '10px 20px', fontSize: '13px' }}
                >
                  {changingRoleId === confirmRoleId ? 'Đang xử lý…' : 'Xác nhận'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
