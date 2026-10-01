import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { authRoutes } from './routes/auth'
import { mediaRoutes } from './routes/media'
import { profileRoutes } from './routes/profile'
import { searchRoutes } from './routes/search'
import { reviewRoutes } from './routes/reviews'
import { userRoutes } from './routes/users'
import { detailsRoutes } from './routes/details'
import { logRoutes } from './routes/logs'
import { goalRoutes } from './routes/goals'
import { listRoutes } from './routes/lists'
import { exploreRoutes } from './routes/explore'
import { feedRoutes } from './routes/feed'
import { adminRoutes } from './routes/admin'

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
app.route('/search', searchRoutes)
app.route('/reviews', reviewRoutes)
app.route('/users', userRoutes)
app.route('/details', detailsRoutes)
app.route('/logs', logRoutes)
app.route('/goals', goalRoutes)
app.route('/lists', listRoutes)
app.route('/explore', exploreRoutes)
app.route('/feed', feedRoutes)
app.route('/admin', adminRoutes)

app.notFound((c) => c.json({ message: 'Ruta no encontrada.' }, 404))
app.onError((err, c) => {
  console.error(err)
  return c.json({ message: 'Error interno del servidor.' }, 500)
})

const port = Number(process.env.PORT ?? 3000)
console.log(`mosaic-api escuchando en http://localhost:${port}`)

export default { port, fetch: app.fetch }