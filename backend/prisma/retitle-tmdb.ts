/**
 * Pasa a español latinoamericano (es-MX) los títulos de películas y series
 * que se guardaron con el de España (la búsqueda antes pedía es-ES):
 * "Crónicas vampíricas" -> "Diario de vampiros".
 *
 *   bun run db:retitle            -> sólo muestra qué cambiaría
 *   bun run db:retitle --apply    -> lo guarda
 *
 * Toca las obras de las colecciones (MediaEntry) y los elementos de listas
 * (ListItem) con id de TMDB. Las obras escritas a mano no tienen id: no cambian.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const apply = process.argv.includes('--apply')
/** Pedidos simultáneos a TMDB (su límite es ~50 por segundo). */
const CONCURRENCY = 5

/** "tmdb:123" -> /movie/123, "tmdb-tv:456" -> /tv/456. */
function tmdbPath(externalId: string): string | null {
  const match = /^(tmdb|tmdb-tv):(\d+)$/.exec(externalId)
  if (!match) return null
  return `${match[1] === 'tmdb' ? 'movie' : 'tv'}/${match[2]}`
}

async function latamTitle(apiKey: string, externalId: string): Promise<string | null> {
  const path = tmdbPath(externalId)
  if (!path) return null
  const res = await fetch(`https://api.themoviedb.org/3/${path}?api_key=${apiKey}&language=es-MX`)
  if (!res.ok) return null
  const data = (await res.json()) as { title?: string; name?: string }
  return (data.title ?? data.name ?? '').trim() || null
}

async function main() {
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) {
    console.error('Falta TMDB_API_KEY en el .env.')
    process.exitCode = 1
    return
  }

  const tmdbOnly = { externalId: { startsWith: 'tmdb' } }
  const [entries, items] = await Promise.all([
    prisma.mediaEntry.findMany({ where: tmdbOnly, select: { externalId: true, title: true } }),
    prisma.listItem.findMany({ where: tmdbOnly, select: { externalId: true, title: true } }),
  ])
  const ids = [...new Set([...entries, ...items].map((r) => r.externalId!))]
  console.log(`${ids.length} obras de TMDB distintas (${entries.length} en colecciones, ${items.length} en listas).`)

  // Título es-MX de cada obra, de a CONCURRENCY pedidos.
  const titles = new Map<string, string>()
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const batch = ids.slice(i, i + CONCURRENCY)
    const found = await Promise.all(batch.map((id) => latamTitle(apiKey, id).catch(() => null)))
    batch.forEach((id, j) => found[j] && titles.set(id, found[j]!))
  }

  let changed = 0
  for (const [externalId, title] of titles) {
    const where = { externalId, title: { not: title } }
    const [inEntries, inItems] = await Promise.all([
      prisma.mediaEntry.findMany({ where, select: { title: true } }),
      prisma.listItem.findMany({ where, select: { title: true } }),
    ])
    const rows = inEntries.length + inItems.length
    if (!rows) continue

    const before = [...new Set([...inEntries, ...inItems].map((r) => r.title))].join(' / ')
    console.log(`  ${externalId}: "${before}" -> "${title}" (${rows})`)
    changed += rows
    if (apply) {
      await prisma.mediaEntry.updateMany({ where, data: { title } })
      await prisma.listItem.updateMany({ where, data: { title } })
    }
  }

  const missing = ids.length - titles.size
  if (missing) console.log(`${missing} obras no se encontraron en TMDB: se quedan como están.`)
  console.log(
    changed === 0
      ? 'Todo ya está en es-MX.'
      : apply
        ? `Listo: ${changed} registros actualizados.`
        : `${changed} registros cambiarían. Corre con --apply para guardarlo.`,
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
