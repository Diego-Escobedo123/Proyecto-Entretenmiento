import type { MediaType } from './media'

/** Meta del reto anual: terminar `target` obras de un tipo (o de cualquiera) en un año. */
export interface Goal {
  id: string
  year: number
  type: MediaType | 'all'
  target: number
}
