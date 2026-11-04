import type { DB, User } from '../types'

export class ApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string) {
    super(code)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }

  let response: Response
  try {
    response = await fetch(path, {
      credentials: 'same-origin',
      ...init,
      headers,
    })
  } catch {
    throw new ApiError(0, 'network')
  }

  const text = await response.text()
  let body: unknown = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = null
    }
  }

  if (!response.ok) {
    const code =
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : 'request_failed'
    throw new ApiError(response.status, code)
  }

  return body as T
}

export const api = {
  me: () => request<{ user: User | null }>('/api/auth/me'),
  login: (email: string, password: string) =>
    request<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string) =>
    request<{ user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
  getData: () => request<{ data: unknown; updatedAt: number | null }>('/api/data'),
  putData: (data: DB) =>
    request<{ ok: true; updatedAt: number }>('/api/data', {
      method: 'PUT',
      body: JSON.stringify({ data }),
    }),
  adminUsers: () => request<{ users: User[] }>('/api/admin/users'),
  adminUserData: (userId: string) =>
    request<{ user: User; data: unknown; updatedAt: number | null }>(
      `/api/admin/users/${encodeURIComponent(userId)}/data`,
    ),
  adminDeleteUser: (userId: string) =>
    request<{ ok: true; id: string; email: string }>(
      `/api/admin/users/${encodeURIComponent(userId)}`,
      { method: 'DELETE' },
    ),
  adminSetRole: (userId: string, role: 'admin' | 'user') =>
    request<{ user: User }>(
      `/api/admin/users/${encodeURIComponent(userId)}/role`,
      { method: 'PATCH', body: JSON.stringify({ role }) },
    ),
}

export const AUTH_MESSAGES: Record<string, string> = {
  network: 'Không kết nối được server. Kiểm tra mạng rồi thử lại.',
  invalid_credentials: 'Email hoặc mật khẩu không đúng.',
  email_taken: 'Email này đã được đăng ký. Hãy chuyển sang Đăng nhập.',
  use_google: 'Email này được tạo bằng Google. Hãy đăng nhập bằng Google.',
  invalid_email: 'Email không hợp lệ.',
  weak_password: 'Mật khẩu cần ít nhất 8 ký tự.',
  too_many_attempts: 'Bạn đã thử quá nhiều lần. Chờ vài phút rồi thử lại.',
  google_not_configured: 'Đăng nhập Google chưa được cấu hình trên server.',
  google_denied: 'Bạn đã huỷ đăng nhập Google.',
  google_failed: 'Không đăng nhập được bằng Google. Thử lại sau.',
  google_email_unverified: 'Email Google chưa được xác minh nên không thể đăng nhập.',
  forbidden: 'Yêu cầu bị từ chối. Tải lại trang rồi thử lại.',
  request_failed: 'Có lỗi xảy ra. Thử lại sau.',
}

export function authErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return AUTH_MESSAGES[error.code] ?? AUTH_MESSAGES.request_failed
  }
  return AUTH_MESSAGES.network
}
