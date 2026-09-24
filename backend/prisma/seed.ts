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

  await prisma.discoverItem.deleteMany()
  await prisma.discoverItem.createMany({
    data: [
      {
        type: 'movie',
        title: 'The Melancholy of Space',
        description:
          'Una obra maestra olvidada del sci-fi soviético, que explora el pavor existencial a través de paisajes glaciales.',
        cover: 'https://picsum.photos/seed/mosaic-melancholy/500/600',
        year: 1973,
        rating: 4.5,
        genres: ['ciencia ficción', 'Surrealismo'],
        featured: true,
      },
      {
        type: 'book',
        title: 'Fragments of Time',
        cover: 'https://picsum.photos/seed/mosaic-fragments/300/300',
        rating: 4,
        genres: ['Filosofía'],
      },
      {
        type: 'music',
        title: 'Midnight Sessions',
        cover: 'https://picsum.photos/seed/mosaic-midnight/300/300',
        rating: 4,
        genres: ['Jazz'],
      },
      {
        type: 'movie',
        title: 'The Architecture...',
        cover: 'https://picsum.photos/seed/mosaic-award1/300/300',
        award: "Palme d'Or · 2023",
        rating: 4.5,
        genres: ['Film Noir'],
      },
      {
        type: 'movie',
        title: 'Concrete Brutali...',
        cover: 'https://picsum.photos/seed/mosaic-award2/300/300',
        award: 'Best Doc · 2022',
        rating: 4,
        genres: [],
      },
      {
        type: 'movie',
        title: 'Echoes of Dali',
        cover: 'https://picsum.photos/seed/mosaic-award3/300/300',
        award: 'Visual Arts Prize',
        rating: 4.5,
        genres: ['Surrealismo'],
      },
      {
        type: 'book',
        title: 'Blue Period Revi...',
        cover: 'https://picsum.photos/seed/mosaic-award4/300/300',
        award: "Curator's Choice",
        rating: 4,
        genres: [],
      },
    ],
  })

  console.log('Seed listo. Catálogo de descubrimiento cargado.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
