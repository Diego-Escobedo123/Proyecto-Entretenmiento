<script setup lang="ts">
/**
 * Inicio — feed social: obra en progreso, actividad de la comunidad,
 * tendencias y perfiles sugeridos.
 *
 * TODO(backend): todo este contenido está hardcodeado a propósito porque
 * todavía no existe el backend. Cuando exista, reemplazar cada bloque por
 * su fetch correspondiente:
 *   - continueConsuming -> GET /me/in-progress (la obra más reciente)
 *   - latestReview / latestRelease -> GET /feed
 *   - trending -> GET /trending
 *   - suggestedProfiles -> GET /users/suggested
 */
import SectionHeader from '../components/SectionHeader.vue'
import ContinueConsumingCard from '../components/home/ContinueConsumingCard.vue'
import ActivityReviewCard from '../components/home/ActivityReviewCard.vue'
import NewReleaseCard from '../components/home/NewReleaseCard.vue'
import TrendingCard from '../components/home/TrendingCard.vue'
import SuggestedProfileRow from '../components/home/SuggestedProfileRow.vue'

const continueConsuming = {
  typeLabel: 'Libro',
  progress: 64,
  title: 'The Architecture of Happiness',
  author: 'Alain de Botton',
  cover: 'https://picsum.photos/seed/mosaic-book1/200/260',
}

const latestReview = {
  userName: 'Sarah J.',
  userAvatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=sarah',
  timeAgo: 'hace 2 horas',
  rating: 4,
  workTitle: 'Umbra: The Fog Within',
  workAuthor: 'Elara Vance',
  workYear: 2024,
  tags: ['Sci-Fi', 'Cine'],
  cover: 'https://picsum.photos/seed/mosaic-umbra/200/280',
  quote: 'Una obra maestra visual. El diseño de sonido solo ya vale la experiencia en IMAX.',
}

const latestRelease = {
  category: 'música',
  title: 'Loss of Life',
  artist: 'MGMT',
  description:
    'El dúo indie-pop regresa con un álbum introspectivo y de raíz acústica que despoja la producción.',
  cover: 'https://picsum.photos/seed/mosaic-album1/200/200',
}

const trending = [
  { kind: 'Serie', title: 'Shōgun', cover: 'https://picsum.photos/seed/mosaic-shogun/400/300', rating: 4.8, badge: '#1' },
  { kind: 'Película', title: 'Perfect Days', cover: 'https://picsum.photos/seed/mosaic-perfectdays/200/200' },
  { kind: 'Juego', title: 'Elden Ring: SotE', cover: 'https://picsum.photos/seed/mosaic-eldenring/200/200' },
]

const suggestedProfiles = [
  { name: 'Marcus Webb', avatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=marcus', interests: 'Cine · Arquitectura' },
  { name: 'Elena Rostova', avatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=elena', interests: 'Literatura · Jazz' },
]
</script>

<template>
  <div class="home">
    <section class="home__main">
      <div>
        <SectionHeader title="Continuar consumiendo" />
        <ContinueConsumingCard v-bind="continueConsuming" />
      </div>

      <div>
        <SectionHeader title="Personalizado para ti" />
        <div class="home__feed">
          <ActivityReviewCard v-bind="latestReview" />
          <NewReleaseCard v-bind="latestRelease" />
        </div>
      </div>
    </section>

    <aside class="home__side">
      <div>
        <SectionHeader title="Tendencias ahora" link-text="Ver todo" />
        <div class="home__trending">
          <TrendingCard v-bind="trending[0]" size="lg" />
          <div class="home__trending-grid">
            <TrendingCard v-for="item in trending.slice(1)" :key="item.title" v-bind="item" />
          </div>
        </div>
      </div>

      <div class="home__suggested">
        <SectionHeader title="Perfiles sugeridos" />
        <div class="home__suggested-list">
          <SuggestedProfileRow v-for="profile in suggestedProfiles" :key="profile.name" v-bind="profile" />
        </div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.home {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: var(--space-xl);
  align-items: start;
}

.home__main {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
  min-width: 0;
}

.home__feed {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.home__side {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

.home__trending {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.home__trending-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-sm);
}

.home__suggested {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-md);
}

.home__suggested-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

@media (max-width: 960px) {
  .home {
    grid-template-columns: 1fr;
  }
}
</style>