/**
 * Da (o quita) el rol de administrador a un usuario que ya existe.
 *
 *   bun run make-admin tu@correo.com          -> lo vuelve ADMIN
 *   bun run make-admin tu@correo.com --user   -> lo regresa a USER
 *
 * Sirve para crear el primer admin: desde el panel solo un admin puede
 * nombrar a otros, así que el primero hay que hacerlo desde aquí.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]?.trim()
  const role = process.argv.includes('--user') ? 'USER' : 'ADMIN'

  if (!email || !email.includes('@')) {
    console.error('Uso: bun run make-admin <correo> [--user]')
    process.exitCode = 1
    return
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    console.error(`No existe ninguna cuenta con el correo ${email}. Regístrate primero en la app.`)
    process.exitCode = 1
    return
  }

  await prisma.user.update({ where: { email }, data: { role } })
  console.log(`Listo: ${user.name} <${email}> ahora es ${role}.`)
}

main().finally(() => prisma.$disconnect())