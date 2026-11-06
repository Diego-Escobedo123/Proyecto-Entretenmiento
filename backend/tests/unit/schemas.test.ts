import { describe, expect, test } from 'bun:test'
import { createMediaSchema, loginSchema, registerSchema, updateMediaSchema } from '../../src/lib/schemas'

/** Mensaje del primer error, como lo vería el usuario. */
function firstError(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.success ? null : result.error!.issues[0]!.message
}

describe('registro', () => {
  test('limpia el nombre y deja el correo en minúsculas', () => {
    const r = registerSchema.parse({ name: '  Ana  ', email: ' ANA@Correo.COM ', password: '12345678' })
    expect(r).toEqual({ name: 'Ana', email: 'ana@correo.com', password: '12345678' })
  })

  test('pide nombre, correo válido y contraseña de 8 a 72 caracteres', () => {
    const base = { name: 'Ana', email: 'ana@correo.com', password: '12345678' }
    expect(firstError(registerSchema.safeParse({ ...base, name: '   ' }))).toBe('Ingresa tu nombre.')
    expect(firstError(registerSchema.safeParse({ ...base, email: 'no-es-correo' }))).toBe('Ingresa un correo válido.')
    expect(firstError(registerSchema.safeParse({ ...base, password: '1234567' }))).toBe(
      'La contraseña debe tener al menos 8 caracteres.',
    )
    expect(registerSchema.safeParse({ ...base, password: 'x'.repeat(73) }).success).toBe(false)
  })
})

describe('login', () => {
  test('acepta contraseñas viejas cortas, pero no vacías', () => {
    expect(loginSchema.safeParse({ email: 'ana@correo.com', password: '123' }).success).toBe(true)
    expect(firstError(loginSchema.safeParse({ email: 'ana@correo.com', password: '' }))).toBe('Ingresa tu contraseña.')
  })
})

describe('registro de obras', () => {
  test('solo tipo y título son obligatorios', () => {
    const r = createMediaSchema.parse({ type: 'book', title: '  Dune  ' })
    expect(r).toEqual({ type: 'book', title: 'Dune' })
  })

  test('rechaza tipo inválido y título vacío', () => {
    expect(firstError(createMediaSchema.safeParse({ type: 'podcast', title: 'X' }))).toBe('El tipo de obra no es válido.')
    expect(firstError(createMediaSchema.safeParse({ type: 'book', title: '  ' }))).toBe('El título es obligatorio.')
  })

  test('valida la calificación de 0 a 5 y la fecha AAAA-MM-DD', () => {
    expect(createMediaSchema.safeParse({ type: 'movie', title: 'X', rating: 6 }).success).toBe(false)
    expect(createMediaSchema.safeParse({ type: 'movie', title: 'X', rating: 4.5 }).success).toBe(true)
    expect(firstError(createMediaSchema.safeParse({ type: 'movie', title: 'X', logDate: '29/09/2026' }))).toBe(
      'Fecha inválida, usa AAAA-MM-DD.',
    )
  })

  test('redondea los contadores y descarta campos desconocidos', () => {
    const r = createMediaSchema.parse({ type: 'book', title: 'X', pagesRead: 10.6, userId: 'hack' })
    expect(r.pagesRead).toBe(11)
    expect(r).not.toHaveProperty('userId')
  })

  test('al editar todo es opcional, pero lo que venga debe ser válido', () => {
    expect(updateMediaSchema.safeParse({}).success).toBe(true)
    expect(updateMediaSchema.safeParse({ status: 'completed' }).success).toBe(true)
    expect(firstError(updateMediaSchema.safeParse({ status: 'terminado' }))).toBe('El estado no es válido.')
  })

  test('una reseña de más de 5000 caracteres se rechaza', () => {
    expect(firstError(updateMediaSchema.safeParse({ review: 'a'.repeat(5001) }))).toBe('La reseña es demasiado larga.')
  })
})
