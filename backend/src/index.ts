import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { authRoutes } from './routes/auth'
import { mediaRoutes } from './routes/media'
import { profileRoutes } from './routes/profile'

const app = new Hono()

app.use('*', logger())
app.use(
  '*',
  cors({
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(','),
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }),
)

app.get('/', (c) => c.json({ name: 'mosaic-api', status: 'ok' }))
app.get('/health', (c) => c.json({ status: 'ok' }))

app.route('/auth', authRoutes)
app.route('/media', mediaRoutes)
app.route('/profile', profileRoutes)

app.notFound((c) => c.json({ message: 'Ruta no encontrada.' }, 404))
app.onError((err, c) => {
  console.error(err)
  return c.json({ message: 'Error interno del servidor.' }, 500)
})

const port = Number(process.env.PORT ?? 3000)
console.log(`mosaic-api escuchando en http://localhost:${port}`)

export default { port, fetch: app.fetch }
