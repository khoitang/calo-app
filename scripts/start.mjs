process.env.NODE_ENV = 'production'
process.env.APP_URL ||= `http://localhost:${process.env.PORT || 8787}`
await import('../server/index.js')
