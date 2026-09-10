/**
 * Datos de ejemplo para desarrollo. Correr con: bun run db:seed
 * Crea un usuario demo (demo@mosaic.app / demo123) con algunas obras.
 */
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/auth'

const prisma = new PrismaClient()

async function main() {
  await prisma.user.deleteMany({ where: { email: 'demo@mosaic.app' } })

  const user = await prisma.user.create({
    data: {
      email: 'demo@mosaic.app',
      name: 'Demo',
      passwordHash: await hashPassword('demo123'),
      profile: { create: { handle: 'demo', memberSince: 2024, tagline: 'Explorando historias' } },
      entries: {
        create: [
          {
            type: 'movie',
            title: 'Dune: Parte Dos',
            creator: 'Denis Villeneuve',
            status: 'completed',
            year: 2024,
            rating: 5,
            favorite: true,
            genres: ['ciencia ficción', 'aventura'],
            notes: 'La escena del gusano.',
          },
          {
            type: 'book',
            title: 'El nombre del viento',
            creator: 'Patrick Rothfuss',
            status: 'in-progress',
            year: 2007,
            progress: 40,
            genres: ['fantasía'],
          },
          {
            type: 'game',
            title: 'Hollow Knight: Silksong',
            creator: 'Team Cherry',
            status: 'want',
            genres: ['metroidvania'],
          },
        ],
      },
    },
  })

  console.log(`Seed listo. Usuario demo: ${user.email} / demo123`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
