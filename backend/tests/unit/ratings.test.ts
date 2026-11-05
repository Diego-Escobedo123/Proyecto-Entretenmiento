import { describe, expect, test } from 'bun:test'
import { ratingSummary } from '../../src/lib/ratings'

// Prueba de ejemplo (EXP-072): confirma que `bun test` corre con TypeScript.
describe('ratingSummary', () => {
  test('sin calificaciones devuelve promedio null y conteo 0', () => {
    const r = ratingSummary([])
    expect(r.average).toBeNull()
    expect(r.count).toBe(0)
    expect(r.histogram).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  })

  test('calcula el promedio con un decimal e ignora null y 0', () => {
    const r = ratingSummary([5, 4, 3.5, null, 0])
    expect(r.count).toBe(3)
    expect(r.average).toBe(4.2)
  })

  test('cada calificación cae en su barra del histograma', () => {
    const r = ratingSummary([0.5, 5, 5])
    expect(r.histogram[0]).toBe(1) // ½ estrella
    expect(r.histogram[9]).toBe(2) // 5 estrellas
  })
})