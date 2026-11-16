// PhishGuard — Live Activity Feed WebSocket mini-service.
//
// Two listeners:
//   1. Port 3003 — socket.io server for browser dashboards.
//      Clients connect via io('/?XTransformPort=3003') and receive:
//        - 'recent-events'  : ring-buffer backfill on connect
//        - 'live-event'     : real-time tracked event broadcasts
//   2. Port 3004 — internal-only plain HTTP endpoint for the Next.js backend
//      (POST /emit, GET /health). Socket.io intercepts every request on
//      path '/', so the ingest endpoint needs its own listener.

import { createServer } from 'http'
import { Server } from 'socket.io'

interface LiveEvent {
  eventId: string
  enrollmentId: string
  campaignId: string
  campaignName: string
  participantName: string
  department: string
  templateName: string
  templateCategory: string
  templateDifficulty: string
  type: string
  note: string | null
  createdAt: string
}

const RING_SIZE = 50
const ring: LiveEvent[] = []

const ingestServer = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, clients: io.engine.clientsCount, buffered: ring.length }))
    return
  }

  if (req.method === 'POST' && req.url === '/emit') {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 256 * 1024) req.destroy() // defensive payload cap
    })
    req.on('end', () => {
      try {
        const event = JSON.parse(body) as LiveEvent
        if (!event || typeof event.eventId !== 'string' || typeof event.type !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Invalid event payload' }))
          return
        }
        // Keep the newest event at the front of the ring buffer.
        ring.unshift(event)
        if (ring.length > RING_SIZE) ring.pop()
        io.emit('live-event', event)
        console.log(`[emit] ${event.type} — ${event.participantName} (${event.department}) via "${event.campaignName}"`)
        res.writeHead(202, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, clients: io.engine.clientsCount }))
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Malformed JSON' }))
      }
    })
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

const io = new Server(createServer(), {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

io.on('connection', (socket) => {
  console.log(`Dashboard connected: ${socket.id} (clients: ${io.engine.clientsCount})`)

  // Backfill the most recent events so a new dashboard is instantly populated.
  socket.emit('recent-events', ring)

  socket.on('disconnect', () => {
    console.log(`Dashboard disconnected: ${socket.id} (clients: ${io.engine.clientsCount})`)
  })

  socket.on('error', (error) => {
    console.error(`Socket error (${socket.id}):`, error)
  })
})

const SOCKET_PORT = 3003
const INGEST_PORT = 3004

// Bind ingest to loopback only — it is a server-to-server channel.
ingestServer.listen(INGEST_PORT, '127.0.0.1', () => {
  console.log(`PhishGuard ingest endpoint listening on http://127.0.0.1:${INGEST_PORT}`)
})

io.listen(SOCKET_PORT)
console.log(`PhishGuard live-feed WebSocket server running on port ${SOCKET_PORT}`)

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM signal, shutting down server...')
  ingestServer.close()
  io.close(() => process.exit(0))
})

process.on('SIGINT', () => {
  console.log('Received SIGINT signal, shutting down server...')
  ingestServer.close()
  io.close(() => process.exit(0))
})
