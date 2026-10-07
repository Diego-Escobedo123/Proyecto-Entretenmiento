import { z } from 'zod'

/**
 * Esquemas de Zod para validar lo que el frontend manda a los endpoints
 * principales. Los mensajes de error son los que ve el usuario.
 *
 * Zod además limpia los datos: recorta espacios (`trim`), redondea los números
 * enteros y descarta cualquier campo que no esté en el esquema.
 */

export const MEDIA_TYPES = ['movie', 'series', 'book', 'game', 'music'] as const
export const MEDIA_STATUSES = ['want', 'in-progress', 'completed', 'mastered', 'abandoned'] as const
export const GOAL_TYPES = ['all', ...MEDIA_TYPES] as const

// --- Piezas reutilizables -------------------------------------------------

/** Día "AAAA-MM-DD". Vacío o null = sin fecha. */
const day = z.preprocess(
  (value) => (value === '' ? null : value),
  z.string({ error: 'Fecha inválida.' }).regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida, usa AAAA-MM-DD.').nullable(),
)

/** Número entero >= 0 (páginas, episodios...). Los decimales se redondean. null = vacío. */
const count = (label: string) =>
  z
    .number({ error: `${label} debe ser un número.` })
    .min(0, `${label} no puede ser negativo.`)
    .transform(Math.round)
    .nullable()

/** Calificación de 0 a 5 estrellas. null = sin calificar. */
const rating = z
  .number({ error: 'La calificación debe ser un número.' })
  .min(0, 'La calificación va de 0.5 a 5.')
  .max(5, 'La calificación va de 0.5 a 5.')
  .nullable()

/** Texto opcional: vacío se guarda como null. */
const optionalText = (max: number, label: string) =>
  z.preprocess(
    (value) => (typeof value === 'string' && !value.trim() ? null : value),
    z.string({ error: `${label} debe ser texto.` }).trim().max(max, `${label} es demasiado largo.`).nullable(),
  )

const genres = z
  .array(z.string({ error: 'Cada género debe ser texto.' }).trim(), { error: 'Los géneros deben ser una lista.' })
  .max(20, 'Máximo 20 géneros.')

// --- Autenticación ----------------------------------------------------------

export const registerSchema = z.object({
  name: z.string({ error: 'Ingresa tu nombre.' }).trim().min(1, 'Ingresa tu nombre.').max(80, 'El nombre es demasiado largo.'),
  email: z.string({ error: 'Ingresa un correo válido.' }).trim().pipe(z.email('Ingresa un correo válido.')),
  password: z
    .string({ error: 'Ingresa una contraseña.' })
    .min(6, 'La contraseña debe tener al menos 6 caracteres.')
    .max(72, 'La contraseña es demasiado larga (máximo 72 caracteres).'),
})

export const loginSchema = z.object({
  email: z.string({ error: 'Ingresa tu correo.' }).trim().min(1, 'Ingresa tu correo.'),
  password: z.string({ error: 'Ingresa tu contraseña.' }).min(1, 'Ingresa tu contraseña.'),
})

export const googleLoginSchema = z.object({
  idToken: z.string({ error: 'Falta el token de Google.' }).min(1, 'Falta el token de Google.'),
})

// --- Obras (/media) ---------------------------------------------------------

/** Campos de una obra que el usuario puede escribir. */
const mediaFields = {
  type: z.enum(MEDIA_TYPES, { error: 'El tipo de obra no es válido.' }),
  title: z.string({ error: 'El título es obligatorio.' }).trim().min(1, 'El título es obligatorio.').max(300, 'El título es demasiado largo.'),
  creator: z.string({ error: 'El creador debe ser texto.' }).trim().max(200, 'El creador es demasiado largo.'),
  status: z.enum(MEDIA_STATUSES, { error: 'El estado no es válido.' }),
  year: z
    .number({ error: 'El año debe ser un número.' })
    .int('El año debe ser un número entero.')
    .min(0, 'El año no es válido.')
    .max(3000, 'El año no es válido.')
    .nullable(),
  rating,
  progress: count('El progreso').pipe(z.number().max(100, 'El progreso va de 0 a 100.').nullable()),
  pagesRead: count('Las páginas leídas'),
  pagesTotal: count('Las páginas totales'),
  season: count('La temporada'),
  episode: count('El episodio'),
  hoursPlayed: z.number({ error: 'Las horas deben ser un número.' }).min(0, 'Las horas no pueden ser negativas.').nullable(),
  platform: optionalText(100, 'La plataforma'),
  favorite: z.boolean({ error: 'Favorita debe ser verdadero o falso.' }),
  genres,
  review: z.string({ error: 'La reseña debe ser texto.' }).max(5000, 'La reseña es demasiado larga.'),
  notes: z.string({ error: 'Las notas deben ser texto.' }).max(5000, 'Las notas son demasiado largas.'),
  notesPublic: z.boolean({ error: 'notesPublic debe ser verdadero o falso.' }),
  cover: optionalText(2000, 'La portada'),
  externalId: optionalText(200, 'El id externo'),
}

/** Datos del diario que acompañan al guardado de una obra (no se guardan en la obra). */
const diaryOptions = {
  logDate: day.optional(),
  startDate: day.optional(),
}

/** POST /media: tipo y título obligatorios, lo demás opcional. */
export const createMediaSchema = z.object({
  ...z.object(mediaFields).partial().shape,
  type: mediaFields.type,
  title: mediaFields.title,
  ...diaryOptions,
})

/** PATCH /media/:id: todo opcional, pero lo que venga debe ser válido. */
export const updateMediaSchema = z.object({
  ...z.object(mediaFields).partial().shape,
  ...diaryOptions,
})

// --- Diario (/logs) ---------------------------------------------------------

export const createLogSchema = z.object({
  entryId: z.string({ error: 'Falta la obra.' }).min(1, 'Falta la obra.'),
  startedAt: day.optional(),
  finishedAt: day.optional(),
  rating: rating.optional(),
})

export const updateLogSchema = z.object({
  startedAt: day.optional(),
  finishedAt: day.optional(),
  rating: rating.optional(),
  abandoned: z.boolean({ error: 'abandoned debe ser verdadero o falso.' }).optional(),
})

// --- Metas anuales (/goals) ---------------------------------------------------

export const createGoalSchema = z.object({
  year: z.coerce
    .number({ error: 'Año inválido.' })
    .int('Año inválido.')
    .min(1900, 'Año inválido.')
    .max(3000, 'Año inválido.'),
  type: z.enum(GOAL_TYPES, { error: 'Tipo inválido.' }),
  target: z.coerce
    .number({ error: 'La meta debe ser un número entre 1 y 10000.' })
    .int('La meta debe ser un número entre 1 y 10000.')
    .min(1, 'La meta debe ser un número entre 1 y 10000.')
    .max(10000, 'La meta debe ser un número entre 1 y 10000.'),
})

// --- Listas (/lists) ----------------------------------------------------------

const listFields = {
  title: z
    .string({ error: 'El nombre de la lista es obligatorio.' })
    .trim()
    .min(1, 'El nombre de la lista es obligatorio.')
    .max(100, 'El nombre de la lista es demasiado largo (máximo 100).'),
  description: z
    .string({ error: 'La descripción debe ser texto.' })
    .trim()
    .max(1000, 'La descripción es demasiado larga (máximo 1000).'),
  isPublic: z.boolean({ error: 'isPublic debe ser verdadero o falso.' }),
  ranked: z.boolean({ error: 'ranked debe ser verdadero o falso.' }),
}

const listNote = z.string({ error: 'La nota debe ser texto.' }).trim().max(500, 'La nota es demasiado larga (máximo 500).')

export const createListSchema = z.object({
  ...z.object(listFields).partial().shape,
  title: listFields.title,
})

export const updateListSchema = z.object(listFields).partial()

export const addListItemSchema = z.object({
  type: z.enum(MEDIA_TYPES, { error: 'Falta el tipo o el título de la obra.' }),
  title: z
    .string({ error: 'Falta el tipo o el título de la obra.' })
    .trim()
    .min(1, 'Falta el tipo o el título de la obra.')
    .max(300, 'El título es demasiado largo.'),
  creator: z.string().trim().max(200).catch(''),
  year: z.number().int().nullable().catch(null),
  cover: optionalText(2000, 'La portada').catch(null),
  genres: genres.catch([]),
  externalId: optionalText(200, 'El id externo').catch(null),
  note: listNote.optional(),
})

export const updateListItemSchema = z.object({
  note: listNote,
})

export const reorderListSchema = z.object({
  itemIds: z.array(z.string(), { error: 'El nuevo orden debe ser una lista de ids.' }),
})