import { Hono } from 'hono'
import type { List, ListItem } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { requireAuth, type AuthEnv } from '../middleware/auth'
import { upgradeBookCover } from '../lib/externalSearch'
import { toPublicUserDTO } from '../lib/serialize'

export const listRoutes = new Hono<AuthEnv>()

listRoutes.use('*', requireAuth)

const MAX_TITLE = 100
const MAX_DESCRIPTION = 1000
const MAX_NOTE = 500
const COLLAGE = 4
const MEDIA_TYPES = new Set(['movie', 'series', 'book', 'game', 'music'])

type ListWithPreview = List & { items: Pick<ListItem, 'cover'>[]; _count: { items: number } }

/** Resumen para tarjetas: sin las obras, sólo cuántas son y las primeras portadas. */
export function toListSummaryDTO(row: ListWithPreview) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    isPublic: row.isPublic,
    ranked: row.ranked,
    itemCount: row._count.items,
    covers: row.items.map((i) => upgradeBookCover(i.cover)).filter((c): c is string => Boolean(c)),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** Include de Prisma para `toListSummaryDTO`. */
export const LIST_SUMMARY_INCLUDE = {
  items: { select: { cover: true }, where: { cover: { not: null } }, orderBy: { position: 'asc' }, take: COLLAGE },
  _count: { select: { items: true } },
} as const

function toItemDTO(item: ListItem) {
  return {
    id: item.id,
    position: item.position,
    type: item.type,
    title: item.title,
    creator: item.creator,
    year: item.year,
    cover: upgradeBookCover(item.cover),
    genres: item.genres,
    externalId: item.externalId,
    note: item.note,
    addedAt: item.addedAt.toISOString(),
  }
}

/** Datos editables de la lista, validados. `partial` = sólo los que vienen (PATCH). */
function readListInput(body: Record<string, unknown>, partial: boolean) {
  const data: { title?: string; description?: string; isPublic?: boolean; ranked?: boolean } = {}
  if (!partial || 'title' in body) {
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) return { error: 'El nombre de la lista es obligatorio.' }
    data.title = title.slice(0, MAX_TITLE)
  }
  if ('description' in body) data.description = String(body.description ?? '').trim().slice(0, MAX_DESCRIPTION)
  if ('isPublic' in body) data.isPublic = Boolean(body.isPublic)
  if ('ranked' in body) data.ranked = Boolean(body.ranked)
  return { data }
}

async function findOwnedList(id: string, userId: string) {
  return prisma.list.findFirst({ where: { id, userId } })
}

/** Misma obra: por id de catálogo si lo hay; si no, por tipo + título. */
function sameWorkWhere(listId: string, work: { type: string; title: string; externalId: string | null }) {
  return work.externalId
    ? { listId, type: work.type, externalId: work.externalId }
    : { listId, type: work.type, externalId: null, title: { equals: work.title, mode: 'insensitive' as const } }
}

// GET /lists?type=&externalId=&title= -> resúmenes de mis listas.
// Si viene una obra, cada lista trae `workItemId`: el id de esa obra dentro de
// la lista, o null si no está (para el menú "Agregar a lista").
listRoutes.get('/', async (c) => {
  const rows = await prisma.list.findMany({
    where: { userId: c.get('userId') },
    include: LIST_SUMMARY_INCLUDE,
    orderBy: { updatedAt: 'desc' },
  })

  const type = c.req.query('type')
  const title = c.req.query('title') ?? ''
  const externalId = c.req.query('externalId') || null
  const itemByList = new Map<string, string>()
  if (type && (externalId || title)) {
    const matches = await prisma.listItem.findMany({
      where: {
        listId: { in: rows.map((r) => r.id) },
        type,
        ...(externalId ? { externalId } : { externalId: null, title: { equals: title, mode: 'insensitive' } }),
      },
      select: { id: true, listId: true },
    })
    for (const m of matches) itemByList.set(m.listId, m.id)
  }

  return c.json(
    rows.map((r) => ({ ...toListSummaryDTO(r), ...(type && { workItemId: itemByList.get(r.id) ?? null }) })),
  )
})

// POST /lists { title, description?, isPublic?, ranked? } -> resumen
listRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const input = readListInput(body, false)
  if ('error' in input) return c.json({ message: input.error }, 400)
  const row = await prisma.list.create({
    data: { ...input.data, title: input.data.title!, userId: c.get('userId') },
    include: LIST_SUMMARY_INCLUDE,
  })
  return c.json(toListSummaryDTO(row), 201)
})

// GET /lists/:id -> lista con sus obras. La ve su dueño, o cualquiera si es pública.
listRoutes.get('/:id', async (c) => {
  const row = await prisma.list.findUnique({
    where: { id: c.req.param('id') },
    include: {
      items: { orderBy: { position: 'asc' } },
      user: { select: { id: true, name: true, profile: { select: { handle: true, avatar: true } } } },
    },
  })
  const isOwner = row?.userId === c.get('userId')
  if (!row || (!row.isPublic && !isOwner)) return c.json({ message: 'No existe la lista.' }, 404)

  return c.json({
    id: row.id,
    title: row.title,
    description: row.description,
    isPublic: row.isPublic,
    ranked: row.ranked,
    isOwner,
    owner: toPublicUserDTO(row.user),
    items: row.items.map(toItemDTO),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  })
})

// PATCH /lists/:id { title?, description?, isPublic?, ranked? } -> resumen
listRoutes.patch('/:id', async (c) => {
  const owned = await findOwnedList(c.req.param('id'), c.get('userId'))
  if (!owned) return c.json({ message: 'No existe la lista.' }, 404)
  const body = await c.req.json().catch(() => ({}))
  const input = readListInput(body, true)
  if ('error' in input) return c.json({ message: input.error }, 400)
  const row = await prisma.list.update({ where: { id: owned.id }, data: input.data, include: LIST_SUMMARY_INCLUDE })
  return c.json(toListSummaryDTO(row))
})

// DELETE /lists/:id -> 204
listRoutes.delete('/:id', async (c) => {
  const owned = await findOwnedList(c.req.param('id'), c.get('userId'))
  if (!owned) return c.json({ message: 'No existe la lista.' }, 404)
  await prisma.list.delete({ where: { id: owned.id } })
  return c.body(null, 204)
})

// POST /lists/:id/items { type, title, creator?, year?, cover?, genres?, externalId?, note? } -> obra
// Se agrega al final. 409 si la obra ya está en la lista.
listRoutes.post('/:id/items', async (c) => {
  const owned = await findOwnedList(c.req.param('id'), c.get('userId'))
  if (!owned) return c.json({ message: 'No existe la lista.' }, 404)

  const body = await c.req.json().catch(() => ({}))
  const type = String(body.type ?? '')
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!MEDIA_TYPES.has(type) || !title) return c.json({ message: 'Falta el tipo o el título de la obra.' }, 400)
  const externalId = typeof body.externalId === 'string' && body.externalId ? body.externalId : null

  const existing = await prisma.listItem.findFirst({ where: sameWorkWhere(owned.id, { type, title, externalId }) })
  if (existing) return c.json({ message: 'Esa obra ya está en la lista.' }, 409)

  const last = await prisma.listItem.findFirst({ where: { listId: owned.id }, orderBy: { position: 'desc' } })
  const [item] = await prisma.$transaction([
    prisma.listItem.create({
      data: {
        listId: owned.id,
        position: (last?.position ?? -1) + 1,
        type,
        title,
        creator: typeof body.creator === 'string' ? body.creator : '',
        year: Number.isInteger(body.year) ? body.year : null,
        cover: typeof body.cover === 'string' && body.cover ? body.cover : null,
        genres: Array.isArray(body.genres) ? body.genres.filter((g: unknown) => typeof g === 'string') : [],
        externalId,
        note: String(body.note ?? '').trim().slice(0, MAX_NOTE),
      },
    }),
    // Toca la lista para que suba en "más recientes".
    prisma.list.update({ where: { id: owned.id }, data: { updatedAt: new Date() } }),
  ])
  return c.json(toItemDTO(item), 201)
})

// PATCH /lists/:id/items/:itemId { note } -> obra
listRoutes.patch('/:id/items/:itemId', async (c) => {
  const owned = await findOwnedList(c.req.param('id'), c.get('userId'))
  if (!owned) return c.json({ message: 'No existe la lista.' }, 404)
  const item = await prisma.listItem.findFirst({ where: { id: c.req.param('itemId'), listId: owned.id } })
  if (!item) return c.json({ message: 'Esa obra no está en la lista.' }, 404)

  const body = await c.req.json().catch(() => ({}))
  const updated = await prisma.listItem.update({
    where: { id: item.id },
    data: { note: String(body.note ?? '').trim().slice(0, MAX_NOTE) },
  })
  return c.json(toItemDTO(updated))
})

// DELETE /lists/:id/items/:itemId -> 204 (las demás se reacomodan sin huecos)
listRoutes.delete('/:id/items/:itemId', async (c) => {
  const owned = await findOwnedList(c.req.param('id'), c.get('userId'))
  if (!owned) return c.json({ message: 'No existe la lista.' }, 404)
  const item = await prisma.listItem.findFirst({ where: { id: c.req.param('itemId'), listId: owned.id } })
  if (!item) return c.json({ message: 'Esa obra no está en la lista.' }, 404)

  await prisma.$transaction([
    prisma.listItem.delete({ where: { id: item.id } }),
    prisma.listItem.updateMany({
      where: { listId: owned.id, position: { gt: item.position } },
      data: { position: { decrement: 1 } },
    }),
    prisma.list.update({ where: { id: owned.id }, data: { updatedAt: new Date() } }),
  ])
  return c.body(null, 204)
})

// POST /lists/:id/order { itemIds: string[] } -> 204   (nuevo orden completo)
listRoutes.post('/:id/order', async (c) => {
  const owned = await findOwnedList(c.req.param('id'), c.get('userId'))
  if (!owned) return c.json({ message: 'No existe la lista.' }, 404)

  const body = await c.req.json().catch(() => ({}))
  const ids: unknown[] = Array.isArray(body.itemIds) ? body.itemIds : []
  const current = await prisma.listItem.findMany({ where: { listId: owned.id }, select: { id: true } })
  const currentIds = new Set(current.map((i) => i.id))
  const sameSet = ids.length === currentIds.size && ids.every((id) => typeof id === 'string' && currentIds.has(id))
  if (!sameSet) return c.json({ message: 'El nuevo orden debe incluir todas las obras de la lista.' }, 400)

  await prisma.$transaction(
    (ids as string[]).map((id, position) => prisma.listItem.update({ where: { id }, data: { position } })),
  )
  return c.body(null, 204)
})
