import { Hono } from 'hono'
import type { DiscoverItem, Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'

export const discoverRoutes = new Hono()

/** Etiqueta en español para el `type` de MediaEntry/DiscoverItem. */
const KIND_LABEL: Record<string, string> = {
  movie: 'Cine',
  book: 'Literatura',
  game: 'Videojuegos',
  music: 'Música',
}

function toHiddenGemDTO(row: DiscoverItem, size: 'lg' | 'sm') {
  return {
    id: row.id,
    kind: KIND_LABEL[row.type] ?? row.type,
    year: row.year ?? undefined,
    title: row.title,
    description: row.description || undefined,
    cover: row.cover,
    size,
  }
}

function toAwardDTO(row: DiscoverItem) {
  return {
    id: row.id,
    title: row.title,
    award: row.award,
    cover: row.cover,
  }
}

/** Filtros comunes a partir de la querystring: ?genres=a,b&minRating=4&q=texto */
function buildWhere(c: { req: { query: (key: string) => string | undefined } }): Prisma.DiscoverItemWhereInput {
  const where: Prisma.DiscoverItemWhereInput = {}

  const q = c.req.query('q')?.trim()
  if (q) where.title = { contains: q, mode: 'insensitive' }

  const genres = c.req.query('genres')
    ?.split(',')
    .map((g) => g.trim())
    .filter(Boolean)
  if (genres?.length) where.genres = { hasSome: genres }

  const minRating = Number(c.req.query('minRating'))
  if (Number.isFinite(minRating) && minRating > 0) where.rating = { gte: minRating }

  return where
}

// GET /discover?genres=a,b&minRating=4&q=texto -> { hiddenGems, awardWinners }
discoverRoutes.get('/', async (c) => {
  const where = buildWhere(c)

  const [gems, awards] = await Promise.all([
    prisma.discoverItem.findMany({
      where: { ...where, award: null },
      orderBy: [{ featured: 'desc' }, { updatedAt: 'desc' }],
      take: 6,
    }),
    prisma.discoverItem.findMany({
      where: { ...where, award: { not: null } },
      orderBy: { updatedAt: 'desc' },
      take: 4,
    }),
  ])

  return c.json({
    hiddenGems: gems.map((row, i) => toHiddenGemDTO(row, i === 0 ? 'lg' : 'sm')),
    awardWinners: awards.map(toAwardDTO),
  })
})
