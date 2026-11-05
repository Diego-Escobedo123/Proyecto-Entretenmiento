/**
 * Cobertura mínima de los módulos críticos (EXP-073 / EXP-078).
 *
 * Lee coverage/lcov.info (lo genera `bun test --coverage`) y falla si alguno
 * de los módulos de auth, registro de obras o reseñas queda por debajo del
 * mínimo acordado. Los demás archivos se muestran en el reporte, pero no
 * bloquean.
 */
const MIN_LINES = 70 // % de líneas

const CRITICAL = [
  'src/lib/auth.ts',
  'src/lib/schemas.ts',
  'src/routes/auth.ts',
  'src/routes/media.ts',
  'src/routes/reviews.ts',
]

const lcov = await Bun.file('coverage/lcov.info').text()
const lines = new Map<string, { hit: number; found: number }>()
for (const block of lcov.split('end_of_record')) {
  const file = block.match(/^SF:(.+)$/m)?.[1]?.replaceAll('\\', '/')
  if (!file) continue
  const found = Number(block.match(/^LF:(\d+)$/m)?.[1] ?? 0)
  const hit = Number(block.match(/^LH:(\d+)$/m)?.[1] ?? 0)
  lines.set(file, { hit, found })
}

let failed = false
console.log(`\nCobertura de módulos críticos (mínimo ${MIN_LINES}% de líneas):`)
for (const file of CRITICAL) {
  const entry = [...lines].find(([path]) => path.endsWith(file))?.[1]
  const pct = entry && entry.found ? (entry.hit / entry.found) * 100 : 0
  const ok = pct >= MIN_LINES
  if (!ok) failed = true
  console.log(`  ${ok ? '✅' : '❌'} ${file.padEnd(24)} ${pct.toFixed(1)}%`)
}

if (failed) {
  console.error(`\nAlgún módulo crítico quedó por debajo del ${MIN_LINES}%.`)
  process.exit(1)
}
