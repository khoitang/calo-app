import { spawn } from 'node:child_process'
import path from 'node:path'

const root = process.cwd()
const bin = (name) => path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? `${name}.cmd` : name)

const children = []
let stopping = false

function run(label, command, args, color) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, FORCE_COLOR: '1' },
  })
  child.label = label
  child.color = color
  children.push(child)
  child.on('exit', (code, signal) => {
    if (stopping) return
    console.error(`\n[dev] ${label} đã dừng (code ${code ?? signal}). Đang tắt tiến trình còn lại...`)
    shutdown(code ?? 1)
  })
  child.on('error', (err) => {
    console.error(`[dev] Không chạy được ${label}:`, err.message)
    shutdown(1)
  })
  return child
}

function shutdown(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM')
  }
  setTimeout(() => process.exit(code), 400)
}

run('api', process.execPath, ['--watch', 'server/index.js'], 'green')
run('web', bin('vite'), [], 'cyan')

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
