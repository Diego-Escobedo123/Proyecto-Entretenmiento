/**
 * Base de datos de las pruebas de integración (EXP-074).
 *
 * Se configura con TEST_DATABASE_URL (en backend/.env o en CI). Por seguridad,
 * el nombre de la base tiene que incluir "test": así nunca se borran por
 * error los datos de la base de desarrollo o de producción.
 */
export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL
  if (!url) {
    throw new Error(
      'Falta TEST_DATABASE_URL. Ejemplo en backend/.env:\n' +
        'TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/mosaic_test"',
    )
  }
  const dbName = new URL(url).pathname.slice(1)
  if (!dbName.includes('test')) {
    throw new Error(`TEST_DATABASE_URL apunta a "${dbName}". La base de pruebas debe tener "test" en el nombre.`)
  }
  return url
}

// `bun scripts/test-db.ts`: aplica las migraciones a la base de pruebas.
if (import.meta.main) {
  const url = testDatabaseUrl()
  console.log(`Aplicando migraciones a la base de pruebas (${new URL(url).pathname.slice(1)})...`)
  const result = Bun.spawnSync([process.execPath, 'x', 'prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url },
    stdout: 'inherit',
    stderr: 'inherit',
  })
  process.exit(result.exitCode ?? 1)
}
