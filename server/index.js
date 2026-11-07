import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const IS_PROD = process.env.NODE_ENV === 'production'

// Ở dev, đọc .env để lấy cấu hình Google. Ở production, dùng biến môi trường
// do nền tảng deploy cung cấp (Render/Railway/Fly/VPS...).
if (!IS_PROD) {
  try {
    process.loadEnvFile(path.join(ROOT, '.env'))
  } catch {
    // Không có .env thì dùng giá trị mặc định.
  }
}

const PORT = Number(process.env.PORT || 8787)
const HOST = process.env.HOST || '0.0.0.0'
const APP_URL = (process.env.APP_URL || (IS_PROD ? `http://localhost:${PORT}` : 'http://localhost:5173')).replace(/\/$/, '')
const SECURE = APP_URL.startsWith('https://')
const SESSION_DAYS = Math.max(1, Number(process.env.SESSION_DAYS || 30))
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000
const COOKIE = 'calo_session'
const STATE_COOKIE = 'calo_oauth_state'

const GOOGLE_ID = process.env.GOOGLE_CLIENT_ID || ''
const GOOGLE_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
const GOOGLE_REDIRECT = process.env.GOOGLE_REDIRECT_URI || `${APP_URL}/api/auth/google/callback`
const GOOGLE_AUTH_URL = process.env.GOOGLE_AUTH_URL || 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = process.env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = process.env.GOOGLE_USERINFO_URL || 'https://oauth2.googleapis.com/v3/userinfo'

const DIST = path.join(ROOT, 'dist')
const scrypt = promisify(crypto.scrypt)

// ---------- Database (PostgreSQL) ----------

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://khoi@localhost:5432/calo_app'

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: IS_PROD ? { rejectUnauthorized: false } : false,
})

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      google_id TEXT UNIQUE,
      name TEXT,
      avatar_url TEXT,
      role TEXT DEFAULT 'user',
      created_at BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at BIGINT NOT NULL,
      created_at BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_data (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      json TEXT NOT NULL,
      updated_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users(lower(email));
  `)
}

async function seedAdmin() {
  const email = 'admin@gmail.com'
  const password = 'tangbakhoi'
  const role = 'admin'
  const name = 'Admin'
  const now = Date.now()

  const existing = await db.get(
    'SELECT id, role FROM users WHERE lower(email) = lower($1)',
    [email],
  )

  if (existing) {
    if (existing.role !== role) {
      await db.run('UPDATE users SET role = $1 WHERE id = $2', [role, existing.id])
      console.log('[seed] Đã cập nhật role admin cho', email)
    }
    return
  }

  const id = crypto.randomUUID()
  const salt = crypto.randomBytes(16)
  const key = await scrypt(password, salt, 64)
  const passwordHash = `scrypt:${salt.toString('hex')}:${key.toString('hex')}`

  await db.run(
    `INSERT INTO users (id, email, password_hash, google_id, name, avatar_url, role, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, email, passwordHash, null, name, null, role, now],
  )

  console.log('[seed] Đã tạo user admin:', email)
}

initDb()
  .then(() => seedAdmin().catch(console.error))
  .catch((err) => {
    console.error('[db] init failed (server vẫn chạy, các API sẽ báo lỗi nếu DB không sẵn sàng):', err.message)
  })

// Wrapper helpers giống kiểu query cũ của SQLite (db.get / db.all / db.run)
const db = {
  async get(sql, params = []) {
    const { rows } = await pool.query(sql, params)
    return rows[0] ?? null
  },
  async all(sql, params = []) {
    const { rows } = await pool.query(sql, params)
    return rows
  },
  async run(sql, params = []) {
    const result = await pool.query(sql, params)
    return { changes: result.rowCount }
  },
}

// ---------- Helpers ----------

class HttpError extends Error {
  constructor(status, code) {
    super(code)
    this.status = status
    this.code = code
  }
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

function redirect(res, location) {
  res.writeHead(302, { location, 'cache-control': 'no-store' })
  res.end()
}

function appendCookie(res, cookie) {
  const previous = res.getHeader('set-cookie')
  const list = previous ? (Array.isArray(previous) ? previous : [previous]) : []
  res.setHeader('set-cookie', [...list, cookie])
}

function parseCookies(req) {
  const out = {}
  const header = req.headers.cookie
  if (!header) return out
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index === -1) continue
    const key = part.slice(0, index).trim()
    const value = part.slice(index + 1).trim()
    if (!key) continue
    try {
      out[key] = decodeURIComponent(value)
    } catch {
      out[key] = value
    }
  }
  return out
}

function readJson(req, limit = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0
    let tooLarge = false
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        tooLarge = true
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (tooLarge) return reject(new HttpError(413, 'payload_too_large'))
      if (chunks.length === 0) return resolve({})
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new HttpError(400, 'bad_json'))
      }
    })
    req.on('error', () => reject(new HttpError(400, 'bad_request')))
  })
}

function requireJson(req) {
  if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) {
    throw new HttpError(415, 'unsupported_media_type')
  }
}

function requireSameOrigin(req) {
  const origin = req.headers.origin
  if (!origin) return
  if (origin === APP_URL) return

  try {
    const parsed = new URL(origin)
    const forwarded = req.headers['x-forwarded-host']
    const host =
      (typeof forwarded === 'string' && forwarded.split(',')[0].trim()) || req.headers.host
    if (host && parsed.host.toLowerCase() === host.toLowerCase()) return
  } catch {
    // Origin không hợp lệ: rơi xuống lỗi bên dưới.
  }

  throw new HttpError(403, 'forbidden')
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) return forwarded.split(',')[0].trim()
  return req.socket.remoteAddress || 'unknown'
}

const attempts = new Map()

function rateLimit(req, bucket, max = 25, windowMs = 15 * 60 * 1000) {
  const key = `${bucket}:${clientIp(req)}`
  const now = Date.now()
  const entry = attempts.get(key)
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs })
    return
  }
  entry.count += 1
  if (entry.count > max) throw new HttpError(429, 'too_many_attempts')
}

setInterval(async () => {
  try {
    const now = Date.now()
    for (const [key, entry] of attempts) {
      if (entry.resetAt < now) attempts.delete(key)
    }
    await db.run('DELETE FROM sessions WHERE expires_at < ?', [now])
  } catch {
    // DB chưa sẵn sàng: bỏ qua, sẽ dọn dẹp sau khi kết nối lại.
  }
}, 60 * 60 * 1000).unref()

function validateEmail(value) {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  if (email.length < 5 || email.length > 254) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return email
}

function validatePassword(value) {
  if (typeof value !== 'string') return false
  return value.length >= 8 && value.length <= 200
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16)
  const key = await scrypt(password, salt, 64)
  return `scrypt:${salt.toString('hex')}:${key.toString('hex')}`
}

async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false
  const [scheme, saltHex, keyHex] = stored.split(':')
  if (scheme !== 'scrypt' || !saltHex || !keyHex) return false
  const expected = Buffer.from(keyHex, 'hex')
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length)
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url')
  const now = Date.now()
  // Fire-and-forget cho session (không await để không chặn phản hồi)
  db.run(
    'INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES ($1, $2, $3, $4)',
    [hashToken(token), userId, now + SESSION_MS, now],
  )
  appendCookie(
    res,
    `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_MS / 1000)}${SECURE ? '; Secure' : ''}`,
  )
}

async function currentSession(req) {
  const token = parseCookies(req)[COOKIE]
  if (!token) return null
  const row = await db.get(
    'SELECT u.*, s.expires_at AS session_expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1',
    [hashToken(token)],
  )
  if (!row) return null
  if (row.session_expires_at < Date.now()) {
    await db.run('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)])
    return null
  }
  return row
}

function requireUser(req) {
  // Synchronous wrapper: session sẽ được resolve trong handler async
  return null
}

async function getCurrentUser(req) {
  return currentSession(req)
}

async function requireUserAsync(req) {
  const user = await currentSession(req)
  if (!user) throw new HttpError(401, 'unauthorized')
  return user
}

async function requireAdminAsync(req) {
  const user = await requireUserAsync(req)
  if (user.role !== 'admin') throw new HttpError(403, 'forbidden')
  return user
}

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name || null,
    avatarUrl: row.avatar_url || null,
    hasPassword: Boolean(row.password_hash),
    hasGoogle: Boolean(row.google_id),
    role: row.role || 'user',
    createdAt: row.created_at ?? null,
  }
}

function isClientData(value) {
  if (!value || typeof value !== 'object') return false
  if (!Array.isArray(value.foods) || !Array.isArray(value.logs)) return false
  if (value.foods.length > 5000 || value.logs.length > 100000) return false
  if (value.profile !== null && (typeof value.profile !== 'object' || Array.isArray(value.profile))) {
    return false
  }
  return value.foods.every(
    (food) =>
      food &&
      typeof food.id === 'string' &&
      typeof food.name === 'string' &&
      Number.isFinite(food.kcal) &&
      Number.isFinite(food.servingGrams) &&
      food.servingGrams > 0,
  )
}

// ---------- Auth handlers ----------

async function register(req, res) {
  requireSameOrigin(req)
  requireJson(req)
  rateLimit(req, 'register', 10)
  const body = await readJson(req, 16 * 1024)
  const email = validateEmail(body.email)
  if (!email) throw new HttpError(400, 'invalid_email')
  if (!validatePassword(body.password)) throw new HttpError(400, 'weak_password')
  if (await db.get('SELECT * FROM users WHERE lower(email) = lower($1)', [email]))
    throw new HttpError(409, 'email_taken')

  const now = Date.now()
  const id = crypto.randomUUID()
  const passwordHash = await hashPassword(body.password)
  const name = email.split('@')[0]
  await db.run(
    'INSERT INTO users (id, email, password_hash, google_id, name, avatar_url, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [id, email, passwordHash, null, name, null, now],
  )
  createSession(res, id)
  sendJson(res, 201, { user: publicUser(await db.get('SELECT * FROM users WHERE id = $1', [id])) })
}

async function login(req, res) {
  requireSameOrigin(req)
  requireJson(req)
  rateLimit(req, 'login', 20)
  const body = await readJson(req, 16 * 1024)
  const email = validateEmail(body.email)
  if (!email || typeof body.password !== 'string') throw new HttpError(400, 'invalid_credentials')

  const row = await db.get('SELECT * FROM users WHERE lower(email) = lower($1)', [email])
  if (!row) throw new HttpError(401, 'invalid_credentials')
  if (!row.password_hash) throw new HttpError(401, 'use_google')
  if (!(await verifyPassword(body.password, row.password_hash))) {
    throw new HttpError(401, 'invalid_credentials')
  }
  createSession(res, row.id)
  sendJson(res, 200, { user: publicUser(row) })
}

async function logout(req, res) {
  const token = parseCookies(req)[COOKIE]
  if (token) await db.run('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)])
  appendCookie(res, `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${SECURE ? '; Secure' : ''}`)
  sendJson(res, 200, { ok: true })
}

async function me(req, res) {
  const user = await currentSession(req)
  sendJson(res, 200, { user: user ? publicUser(user) : null })
}

async function getData(req, res) {
  const user = await requireUserAsync(req)
  const row = await db.get('SELECT json, updated_at FROM user_data WHERE user_id = $1', [user.id])
  console.log(`[api] GET /api/data user=${user.email} (${user.id}) row=${row ? 'yes' : 'no'}`)
  if (!row) return sendJson(res, 200, { data: null, updatedAt: null })
  let data = null
  try {
    data = JSON.parse(row.json)
  } catch {
    data = null
  }
  console.log(
    `[api] GET /api/data user=${user.email} profile=${data?.profile ? 'has' : 'null'} foods=${data?.foods?.length ?? 0} logs=${data?.logs?.length ?? 0}`,
  )
  sendJson(res, 200, { data, updatedAt: row.updated_at })
}

async function putData(req, res) {
  const user = await requireUserAsync(req)
  requireSameOrigin(req)
  requireJson(req)
  const body = await readJson(req)
  if (!isClientData(body.data)) throw new HttpError(400, 'invalid_data')
  const now = Date.now()
  await db.run(
    'INSERT INTO user_data (user_id, json, updated_at) VALUES ($1, $2, $3) ON CONFLICT(user_id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at',
    [user.id, JSON.stringify(body.data), now],
  )
  console.log(
    `[api] PUT /api/data user=${user.email} profile=${body.data.profile ? 'has' : 'null'} foods=${body.data.foods?.length ?? 0} logs=${body.data.logs?.length ?? 0}`,
  )
  sendJson(res, 200, { ok: true, updatedAt: now })
}

// ---------- Admin (chỉ role admin) ----------

async function listUsers(req, res) {
  await requireAdminAsync(req)
  const rows = await db.all(
    'SELECT id, email, name, avatar_url, role, created_at FROM users ORDER BY created_at DESC',
  )
  sendJson(res, 200, { users: rows.map(publicUser) })
}

async function getUserData(req, res, url) {
  await requireAdminAsync(req)
  const id = url.pathname.slice('/api/admin/users/'.length)
  if (!id || id.includes('/')) throw new HttpError(400, 'invalid_user_id')
  const user = await db.get('SELECT * FROM users WHERE id = $1', [id])
  if (!user) throw new HttpError(404, 'user_not_found')
  const row = await db.get('SELECT json, updated_at FROM user_data WHERE user_id = $1', [id])
  let data = null
  let updatedAt = null
  if (row) {
    try {
      data = JSON.parse(row.json)
    } catch {
      data = null
    }
    updatedAt = row.updated_at
  }
  sendJson(res, 200, { user: publicUser(user), data, updatedAt })
}

async function deleteUser(req, res, url) {
  await requireAdminAsync(req)
  const id = url.pathname.slice('/api/admin/users/'.length)
  if (!id || id.includes('/')) throw new HttpError(400, 'invalid_user_id')

  const currentUser = await requireUserAsync(req)
  if (id === currentUser.id) throw new HttpError(400, 'cannot_delete_self')

  const user = await db.get('SELECT * FROM users WHERE id = $1', [id])
  if (!user) throw new HttpError(404, 'user_not_found')
  if (user.role === 'admin') throw new HttpError(403, 'cannot_delete_admin')

  await db.run('DELETE FROM user_data WHERE user_id = $1', [id])
  await db.run('DELETE FROM sessions WHERE user_id = $1', [id])
  const result = await db.run('DELETE FROM users WHERE id = $1', [id])
  if (result.changes === 0) throw new HttpError(404, 'user_not_found')

  sendJson(res, 200, { ok: true, id, email: user.email })
}

async function setUserRole(req, res, url) {
  await requireAdminAsync(req)
  const id = url.pathname.slice('/api/admin/users/'.length).replace('/role', '')
  if (!id || id.includes('/')) throw new HttpError(400, 'invalid_user_id')

  const currentUser = await requireUserAsync(req)
  if (id === currentUser.id) throw new HttpError(400, 'cannot_change_self_role')

  const user = await db.get('SELECT * FROM users WHERE id = $1', [id])
  if (!user) throw new HttpError(404, 'user_not_found')

  let body
  try {
    body = await readJson(req)
  } catch {
    throw new HttpError(400, 'bad_json')
  }

  const role = body.role
  if (role !== 'admin' && role !== 'user') {
    throw new HttpError(400, 'invalid_role')
  }

  await db.run('UPDATE users SET role = $1 WHERE id = $2', [role, id])
  const updated = await db.get('SELECT * FROM users WHERE id = $1', [id])
  sendJson(res, 200, { user: publicUser(updated) })
}

// ---------- Google OAuth ----------

function googleConfigured() {
  return Boolean(GOOGLE_ID && GOOGLE_SECRET)
}

function googleStart(req, res) {
  if (!googleConfigured()) return redirect(res, `${APP_URL}/?auth_error=google_not_configured`)
  const state = crypto.randomBytes(24).toString('base64url')
  appendCookie(
    res,
    `${STATE_COOKIE}=${state}; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=600${SECURE ? '; Secure' : ''}`,
  )
  const url = new URL(GOOGLE_AUTH_URL)
  url.searchParams.set('client_id', GOOGLE_ID)
  url.searchParams.set('redirect_uri', GOOGLE_REDIRECT)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid email profile')
  url.searchParams.set('state', state)
  url.searchParams.set('prompt', 'select_account')
  redirect(res, url.toString())
}

async function googleCallback(req, res, url) {
  const cookies = parseCookies(req)
  const state = url.searchParams.get('state')
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')

  const clearState = `${STATE_COOKIE}=; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=0${SECURE ? '; Secure' : ''}`
  appendCookie(res, clearState)

  if (error) return redirect(res, `${APP_URL}/?auth_error=google_denied`)
  if (!googleConfigured()) return redirect(res, `${APP_URL}/?auth_error=google_not_configured`)
  if (!state || !cookies[STATE_COOKIE] || state !== cookies[STATE_COOKIE] || !code) {
    return redirect(res, `${APP_URL}/?auth_error=google_failed`)
  }

  try {
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_ID,
        client_secret: GOOGLE_SECRET,
        redirect_uri: GOOGLE_REDIRECT,
        grant_type: 'authorization_code',
      }),
    })
    if (!tokenRes.ok) throw new Error('token exchange failed')
    const tokenBody = await tokenRes.json()
    if (!tokenBody.access_token) throw new Error('missing access token')

    const infoRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { authorization: `Bearer ${tokenBody.access_token}` },
    })
    if (!infoRes.ok) throw new Error('userinfo failed')
    const info = await infoRes.json()

    const email = validateEmail(info.email)
    const verified = info.email_verified === true || info.email_verified === 'true'
    if (!email || !verified || !info.sub) {
      return redirect(res, `${APP_URL}/?auth_error=google_email_unverified`)
    }

    const googleId = String(info.sub)
    const displayName = typeof info.name === 'string' ? info.name.slice(0, 120) : null
    const avatar = typeof info.picture === 'string' ? info.picture.slice(0, 500) : null

    let user = await db.get('SELECT * FROM users WHERE google_id = $1', [googleId])
    if (user) {
      await db.run(
        'UPDATE users SET google_id = $1, name = COALESCE($2, name), avatar_url = COALESCE($3, avatar_url) WHERE id = $4',
        [googleId, displayName, avatar, user.id],
      )
      user = await db.get('SELECT * FROM users WHERE id = $1', [user.id])
    } else {
      user = await db.get('SELECT * FROM users WHERE lower(email) = lower($1)', [email])
      if (user) {
        // Liên kết tài khoản email/mật khẩu sẵn có với Google
        await db.run(
          'UPDATE users SET google_id = $1, name = COALESCE($2, name), avatar_url = COALESCE($3, avatar_url) WHERE id = $4',
          [googleId, displayName, avatar, user.id],
        )
        user = await db.get('SELECT * FROM users WHERE id = $1', [user.id])
      } else {
        const id = crypto.randomUUID()
        await db.run(
          'INSERT INTO users (id, email, password_hash, google_id, name, avatar_url, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [id, email, null, googleId, displayName || email.split('@')[0], avatar, Date.now()],
        )
        user = await db.get('SELECT * FROM users WHERE id = $1', [id])
      }
    }

    createSession(res, user.id)
    redirect(res, `${APP_URL}/`)
  } catch (err) {
    console.error('[auth] Google callback failed:', err.message)
    redirect(res, `${APP_URL}/?auth_error=google_failed`)
  }
}

// ---------- Static files ----------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

function resolveStatic(pathname) {
  let decoded
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }
  const candidate = path.resolve(DIST, `.${decoded}`)
  if (candidate !== DIST && !candidate.startsWith(DIST + path.sep)) return null
  return candidate
}

async function serveStatic(req, res, pathname) {
  let file = resolveStatic(pathname)
  if (!file) return sendJson(res, 404, { error: 'not_found' })

  try {
    const stat = await fs.promises.stat(file)
    if (stat.isDirectory()) file = path.join(file, 'index.html')
  } catch {
    if (path.extname(pathname)) return sendJson(res, 404, { error: 'not_found' })
    file = path.join(DIST, 'index.html')
  }

  try {
    const stat = await fs.promises.stat(file)
    if (!stat.isFile()) throw new Error('not a file')
    const ext = path.extname(file).toLowerCase()
    const immutable = file.includes(`${path.sep}assets${path.sep}`)
    res.writeHead(200, {
      'content-type': MIME[ext] || 'application/octet-stream',
      'content-length': stat.size,
      'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    })
    if (req.method === 'HEAD') return res.end()
    fs.createReadStream(file).pipe(res)
  } catch {
    sendJson(res, 404, { error: 'not_found' })
  }
}

// ---------- Router ----------

const API_ROUTES = [
  ['POST', '/api/auth/register', register],
  ['POST', '/api/auth/login', login],
  ['POST', '/api/auth/logout', logout],
  ['GET', '/api/auth/me', me],
  ['GET', '/api/auth/google', googleStart],
  ['GET', '/api/data', getData],
  ['PUT', '/api/data', putData],
  ['GET', '/api/health', (_req, res) => sendJson(res, 200, { ok: true })],
]

async function handleApi(req, res, url) {
  if (url.pathname === '/api/auth/google/callback') {
    if (req.method !== 'GET') throw new HttpError(405, 'method_not_allowed')
    return googleCallback(req, res, url)
  }

  // Admin: xem toàn bộ user
  if (url.pathname === '/api/admin/users' && req.method === 'GET') {
    return listUsers(req, res)
  }

  // Admin: xem toàn bộ dữ liệu của một user
  const adminDataMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/data$/)
  if (adminDataMatch && req.method === 'GET') {
    url.pathname = `/api/admin/users/${adminDataMatch[1]}`
    return getUserData(req, res, url)
  }

  // Admin: xoá một user
  const adminDeleteMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)$/)
  if (adminDeleteMatch && req.method === 'DELETE') {
    url.pathname = `/api/admin/users/${adminDeleteMatch[1]}`
    return deleteUser(req, res, url)
  }

  // Admin: đặt/gỡ quyền admin cho user khác
  const adminRoleMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/role$/)
  if (adminRoleMatch && req.method === 'PATCH') {
    url.pathname = `/api/admin/users/${adminRoleMatch[1]}/role`
    return setUserRole(req, res, url)
  }

  for (const [method, routePath, handler] of API_ROUTES) {
    if (url.pathname === routePath && req.method === method) {
      return handler(req, res, url)
    }
  }
  throw new HttpError(404, 'not_found')
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  res.setHeader('x-content-type-options', 'nosniff')
  res.setHeader('x-frame-options', 'DENY')
  res.setHeader('referrer-policy', 'strict-origin-when-cross-origin')

  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url)
      return
    }
    if (!IS_PROD) {
      sendJson(res, 404, { error: 'not_found', hint: 'Dev server dùng Vite ở cổng 5173.' })
      return
    }
    await serveStatic(req, res, url.pathname)
  } catch (err) {
    if (err instanceof HttpError) {
      if (!res.headersSent) sendJson(res, err.status, { error: err.code })
      return
    }
    console.error('[server]', err)
    if (!res.headersSent) sendJson(res, 500, { error: 'server_error' })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`[api] http://localhost:${PORT}`)
  console.log(`[api] APP_URL=${APP_URL}`)
  console.log(`[api] Google OAuth: ${googleConfigured() ? 'đã cấu hình' : 'chưa cấu hình (thiếu GOOGLE_CLIENT_ID/SECRET)'}`)
  if (IS_PROD) console.log(`[api] Phục vụ frontend từ ${DIST}`)
})

function shutdown() {
  server.close(() => {
    pool.end().catch(() => {
      // ignore
    })
    process.exit(0)
  })
  setTimeout(() => process.exit(0), 3000).unref()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
