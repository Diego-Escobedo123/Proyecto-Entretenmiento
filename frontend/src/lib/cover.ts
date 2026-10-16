/**
 * Portadas (y fotos) que vienen de catálogos externos: a veces el enlace deja
 * de existir y el navegador mostraría su ícono de imagen rota.
 *
 * - `coverOk(url)`: hay portada y no falló. Va en el v-if del <img>; su v-else
 *   es el mismo placeholder que cuando la obra no tiene portada.
 * - `v-cover="url"`: en el <img>. Si falla, la marca como rota (el v-if pasa
 *   al placeholder en toda la app); si carga, aparece con un fundido en vez
 *   de "de golpe".
 *
 * Uso:
 *   import { coverOk, vCover } from '../lib/cover'
 *   <img v-if="coverOk(entry.cover)" v-cover="entry.cover" :src="entry.cover" alt="" />
 *   <div v-else class="placeholder">…</div>
 */
import { reactive, type Directive } from 'vue'

/** URLs que ya fallaron en esta sesión (compartido: una vez rota, rota en todas partes). */
const broken = reactive(new Set<string>())

export function coverOk(url: string | null | undefined): url is string {
  return !!url && !broken.has(url)
}

function watchImage(el: HTMLImageElement, url: string | null | undefined) {
  el.classList.add('mosaic-cover')
  const markBroken = () => url && broken.add(url)
  // Ya estaba en caché: se muestra directo, sin fundido.
  if (el.complete) {
    if (el.naturalWidth) el.classList.add('is-loaded')
    else if (el.currentSrc) markBroken()
    if (el.naturalWidth || el.currentSrc) return
  }
  el.classList.remove('is-loaded')
  el.addEventListener('load', () => el.classList.add('is-loaded'), { once: true })
  el.addEventListener('error', markBroken, { once: true })
}

export const vCover: Directive<HTMLImageElement, string | null | undefined> = {
  mounted(el, { value }) {
    watchImage(el, value)
  },
  updated(el, { value, oldValue }) {
    if (value !== oldValue) watchImage(el, value)
  },
}
