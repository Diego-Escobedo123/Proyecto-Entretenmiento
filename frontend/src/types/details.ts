/** Ficha extendida de una obra del catálogo externo (backend `/details`). */

export interface CastMember {
  name: string
  character: string
  photo: string | null
}

/** Un lugar donde consumir la obra (plataforma, tienda…), con su enlace. */
export interface WorkLink {
  name: string
  logo: string | null
  url: string
}

export interface Track {
  name: string
  /** Segundos. */
  duration: number | null
}

export interface WorkDetails {
  overview: string
  /** Datos cortos ya formateados: "5 temporadas", "320 páginas"… */
  facts: string[]
  /** Dirección, Creación, Editorial, Desarrollo… */
  people: { label: string; names: string[] }[]
  cast: CastMember[]
  tracks: Track[]
  /** Datos para el seguimiento del formulario. */
  pages: number | null
  /** Sólo series: episodios de cada temporada regular. */
  seasons: { number: number; episodes: number }[]
  platforms: string[]
  /** `region` sólo viene cuando la disponibilidad depende del país (películas/series). */
  where: {
    region: string | null
    groups: { label: string; items: WorkLink[] }[]
    credit: string | null
  } | null
}
