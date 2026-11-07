import { Pool } from 'pg'
import crypto from 'node:crypto'
import { promisify } from 'node:util'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Load .env nếu có (chạy local)
try {
  process.loadEnvFile(path.join(ROOT, '.env'))
} catch {
  // Bỏ qua nếu không có .env
}

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://khoi@localhost:5432/calo_app'

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: false,
})

const scrypt = promisify(crypto.scrypt)

async function hashPassword(password) {
  const salt = crypto.randomBytes(16)
  const key = await scrypt(password, salt, 64)
  return `scrypt:${salt.toString('hex')}:${key.toString('hex')}`
}

async function main() {
  const email = 'admin@gmail.com'
  const password = 'tangbakhoi'
  const role = 'admin'
  const name = 'Admin'
  const now = Date.now()

  // Kiểm tra user đã tồn tại chưa
  const existing = await pool.query(
    'SELECT id FROM users WHERE lower(email) = lower($1)',
    [email],
  )

  if (existing.rows.length > 0) {
    console.log(`⚠️  User ${email} đã tồn tại (id: ${existing.rows[0].id})`)
    // Cập nhật role thành admin nếu chưa phải
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [
      role,
      existing.rows[0].id,
    ])
    console.log(`✅ Đã cập nhật role thành '${role}'`)
    await pool.end()
    return
  }

  const id = crypto.randomUUID()
  const passwordHash = await hashPassword(password)

  await pool.query(
    `INSERT INTO users (id, email, password_hash, google_id, name, avatar_url, role, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, email, passwordHash, null, name, null, role, now],
  )

  console.log(`✅ Đã tạo user admin:`)
  console.log(`   Email: ${email}`)
  console.log(`   Mật khẩu: ${password}`)
  console.log(`   Role: ${role}`)
  console.log(`   ID: ${id}`)

  await pool.end()
}

main().catch((err) => {
  console.error('❌ Lỗi seed admin:', err.message)
  process.exit(1)
})
