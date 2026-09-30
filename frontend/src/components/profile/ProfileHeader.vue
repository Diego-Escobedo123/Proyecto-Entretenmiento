<script setup lang="ts">
/**
 * ProfileHeader — cabecera del perfil: el mosaico del higo a la izquierda con
 * el avatar en su centro, y a la derecha nombre, visibilidad, @usuario, frase,
 * cita y los contadores (cada uno con su tesela de color). Arriba a la
 * derecha, "Editar perfil" (propio) o seguir (ajeno), y compartir.
 *
 * Uso:
 *   <ProfileHeader :profile="profile" :can-see-collection="puedeVer" @follow-change="…" />
 */
import { computed, ref } from 'vue'
import BaseIcon from '../BaseIcon.vue'
import UserAvatar from '../social/UserAvatar.vue'
import FollowButton from '../social/FollowButton.vue'
import mosaicArt from '../../assets/profile-mosaic.svg'
import { useUiStore } from '../../stores/ui'
import type { PublicProfile } from '../../types/review'
import type { FollowStatus } from '../../types/social'

const props = defineProps<{ profile: PublicProfile; canSeeCollection: boolean }>()
const emit = defineEmits<{ 'follow-change': [status: FollowStatus, followers: number | null] }>()

const ui = useUiStore()
const isSelf = computed(() => props.profile.isSelf)
const nf = (n: number) => n.toLocaleString('es')

/** La cita sin las comillas que haya escrito la persona: las tipográficas las pone la plantilla. */
const quote = computed(() => props.profile.quote.trim().replace(/^["“”'«»]+|["“”'«»]+$/g, '').trim())

/** Contadores con su tesela de color (los mismos tonos del mosaico). */
const stats = computed(() => {
  const p = props.profile
  const items: { key: string; value: number; label: string; to: string | null; color: string; muted?: boolean }[] = [
    { key: 'works', value: p.counts.works, label: 'obras', to: isSelf.value ? '/collection' : null, color: 'var(--golden-fig)', muted: !props.canSeeCollection },
    { key: 'year', value: p.counts.finishedThisYear, label: 'este año', to: isSelf.value ? '/diary?tab=review' : null, color: 'var(--burnt-copper)', muted: !props.canSeeCollection },
    { key: 'lists', value: p.counts.lists, label: p.counts.lists === 1 ? 'lista' : 'listas', to: isSelf.value ? '/lists' : null, color: 'var(--rose)' },
  ]
  // Cuenta privada que no se puede ver: el servidor no manda seguidores ni seguidos.
  if (p.followers != null && p.following != null) {
    items.push(
      { key: 'followers', value: p.followers, label: p.followers === 1 ? 'seguidor' : 'seguidores', to: `/users/${p.user.id}/followers`, color: '#b98f2e' },
      { key: 'following', value: p.following, label: p.following === 1 ? 'seguido' : 'seguidos', to: `/users/${p.user.id}/following`, color: 'var(--deep-raspberry)' },
    )
  }
  return items
})

// --- Compartir: en pantallas táctiles, el menú del sistema; en la computadora, copiar el enlace ---
const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined

async function share() {
  const url = `${window.location.origin}/users/${props.profile.user.id}`
  const title = `${props.profile.user.name} en Mosaic`
  try {
    // En Windows/Mac el navegador también trae navigator.share, pero ahí se espera copiar.
    const touch = window.matchMedia('(pointer: coarse)').matches
    if (touch && navigator.share) {
      await navigator.share({ title, url })
      return
    }
    await navigator.clipboard.writeText(url)
    copied.value = true
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => (copied.value = false), 2000)
  } catch {
    // Canceló el menú de compartir, o el navegador no dejó copiar: no hay nada que avisar.
  }
}
</script>

<template>
  <header class="profile-head">
    <!-- Mosaico decorativo; el avatar va en su centro libre -->
    <div class="profile-head__art" aria-hidden="true">
      <img :src="mosaicArt" alt="" class="profile-head__mosaic" />
      <UserAvatar :user="profile.user" :size="150" :link="false" class="profile-head__avatar" />
    </div>

    <div class="profile-head__body">
      <div class="profile-head__identity">
        <div class="profile-head__title">
          <h1 class="profile-head__name">{{ profile.user.name }}</h1>
          <component
            :is="isSelf ? 'button' : 'span'"
            :type="isSelf ? 'button' : undefined"
            class="profile-head__visibility"
            :title="isSelf ? 'Cambiar en Editar perfil' : undefined"
            @click="isSelf && ui.openSettings()"
          >
            <BaseIcon :name="profile.isPublic ? 'globe' : 'lock'" />
            {{ profile.isPublic ? 'Perfil público' : 'Perfil privado' }}
          </component>
        </div>
        <p class="profile-head__handle">
          <template v-if="profile.user.handle">@{{ profile.user.handle }}</template>
          <template v-if="profile.memberSince"> · En Mosaic desde {{ profile.memberSince }}</template>
        </p>
        <p v-if="profile.tagline" class="profile-head__tagline">{{ profile.tagline }}</p>
        <blockquote v-if="quote" class="profile-head__quote">“{{ quote }}”</blockquote>
        <p v-else-if="isSelf && !profile.tagline" class="profile-head__empty">
          Agrega una frase que te describa desde
          <button type="button" class="profile-head__inline" @click="ui.openSettings()">Editar perfil</button>.
        </p>
      </div>

      <div class="profile-head__actions">
        <button
          v-if="isSelf"
          type="button"
          class="profile-head__edit"
          aria-label="Editar perfil"
          title="Editar perfil"
          @click="ui.openSettings()"
        >
          <BaseIcon name="pencil" />
        </button>
        <FollowButton
          v-else
          :user-id="profile.user.id"
          :following="profile.isFollowing"
          :requested="profile.requested"
          @change="(status, followers) => emit('follow-change', status, followers)"
        />
        <button
          type="button"
          class="profile-head__share"
          :aria-label="copied ? 'Enlace copiado' : 'Compartir perfil'"
          :title="copied ? 'Enlace copiado' : 'Compartir perfil'"
          @click="share"
        >
          <BaseIcon :name="copied ? 'check2' : 'share'" />
        </button>
        <span v-if="copied" class="profile-head__copied" role="status">Enlace copiado</span>
      </div>

      <nav class="profile-stats" aria-label="Números del perfil">
        <component
          :is="s.to ? 'RouterLink' : 'span'"
          v-for="s in stats"
          :key="s.key"
          :to="s.to ?? undefined"
          class="profile-stats__item"
          :class="{ 'is-muted': s.muted }"
        >
          <span class="profile-stats__tile" :style="{ background: s.color }" aria-hidden="true" />
          <span class="profile-stats__text">
            <strong>{{ nf(s.value) }}</strong>
            <span>{{ s.label }}</span>
          </span>
        </component>
      </nav>
    </div>
  </header>
</template>

<style scoped>
/*
 * El mosaico ocupa todo el alto de la tarjeta, cortado por el borde
 * izquierdo; el contenido empieza donde termina. En pantallas angostas el
 * mosaico pasa arriba, centrado, y el contenido debajo.
 */
.profile-head {
  --art-height: 100%;
  position: relative;
  display: flex;
  min-height: 320px;
  overflow: hidden;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.profile-head__art {
  position: absolute;
  top: 50%;
  left: 0;
  height: 100%;
  min-height: 320px;
  aspect-ratio: 480 / 440;
  transform: translate(-22%, -50%);
}

.profile-head__mosaic {
  display: block;
  width: 100%;
  height: 100%;
}

/* Centro libre del SVG: (240, 220) de 480 × 440. Más grande que el hueco: tapa los anillos de colores del centro. */
.profile-head__avatar {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 32% !important;
  height: auto !important;
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 0 5px var(--color-bg);
}

.profile-head__body {
  position: relative;
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    'identity actions'
    'stats stats';
  align-content: center;
  gap: var(--space-lg) var(--space-md);
  /* El texto empieza donde termina el mosaico visible. */
  padding: var(--space-xl) var(--space-xl) var(--space-xl) clamp(260px, 30%, 340px);
}

.profile-head__identity {
  grid-area: identity;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.profile-head__title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-sm) var(--space-md);
}

.profile-head__name {
  margin: 0;
  font-family: var(--font-serif);
  font-size: clamp(1.25rem, 4vw, 2.25rem);
  font-weight: 900;
  line-height: 1;
  color: var(--color-text);
  overflow-wrap: anywhere;
}

.profile-head__visibility {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border: none;
  border-radius: 999px;
  background: var(--color-surface-2);
  font: inherit;
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

button.profile-head__visibility {
  cursor: pointer;
}

button.profile-head__visibility:hover {
  color: var(--color-text);
}

.profile-head__handle {
  margin: 4px 0 0;
  font-family: var(--font-sans);
  font-size: 0.9375rem;
  color: var(--color-text-muted);
}

.profile-head__tagline {
  margin: var(--space-sm) 0 0;
  font-family: var(--font-sans);
  font-size: 1.1875rem;
  font-weight: 700;
  color: var(--color-accent);
}

.profile-head__quote {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 0.9rem;
  font-style: italic;
  color: var(--color-text);
}

.profile-head__empty {
  margin: 4px 0 0;
  font-size: 0.875rem;
  color: var(--color-text-subtle);
}

.profile-head__inline {
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-weight: 600;
  color: var(--color-accent);
  cursor: pointer;
}

.profile-head__actions {
  grid-area: actions;
  align-self: start;
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

/* Editar: sólo el lápiz, del mismo tamaño que compartir, en dorado. */
.profile-head__edit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  border: none;
  border-radius: var(--radius-md);
  background: var(--color-accent);
  color: var(--color-accent-contrast);
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.profile-head__edit:hover,
.profile-head__edit:focus-visible {
  background: var(--color-accent-hover);
  color: var(--color-accent-hover-contrast);
}

.profile-head__share {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text);
  font-size: 0.7rem;
  cursor: pointer;
}

.profile-head__share:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

/* Aviso bajo el botón de compartir. */
.profile-head__copied {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  background: var(--fig-cream);
  color: var(--fig-purple);
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
}

/* --- Contadores: tesela de color + número grande + texto --- */
.profile-stats {
  grid-area: stats;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md) var(--space-xl);
  padding-top: var(--space-lg);
  border-top: 1px dashed var(--color-border);
}

.profile-stats__item {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--color-text-muted);
}

.profile-stats__tile {
  width: 16px;
  height: 22px;
  flex-shrink: 0;
  border-radius: 50%;
  transform: rotate(18deg);
}

.profile-stats__text {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
  font-family: var(--font-sans);
  font-size: 0.875rem;
}

.profile-stats__text strong {
  font-family: var(--font-serif);
  font-size: 1.3rem;
  font-weight: 900;
  color: var(--color-text);
}

a.profile-stats__item:hover span,
a.profile-stats__item:hover strong {
  color: var(--color-accent);
}

.profile-stats__item.is-muted {
  opacity: 0.6;
}

/* Tablet: el mosaico se achica. */
@media (max-width: 1100px) {
  .profile-head__body {
    padding-left: clamp(220px, 32%, 280px);
  }

  .profile-head__art {
    transform: translate(-30%, -50%);
  }
}

/* Teléfono: mosaico arriba (centrado, sin cortar) y el contenido debajo. */
@media (max-width: 720px) {
  .profile-head {
    flex-direction: column;
    min-height: 0;
  }

  .profile-head__art {
    position: relative;
    top: auto;
    left: auto;
    height: 240px;
    min-height: 0;
    margin: -12px auto -24px;
    transform: none;
  }

  .profile-head__body {
    grid-template-columns: 1fr;
    grid-template-areas:
      'identity'
      'actions'
      'stats';
    padding: 0 var(--space-lg) var(--space-lg);
  }

  .profile-head__title {
    justify-content: flex-start;
  }

  .profile-stats {
    gap: var(--space-md) var(--space-lg);
  }
}
</style>
