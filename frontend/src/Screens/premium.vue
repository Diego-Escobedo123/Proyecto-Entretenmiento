<script setup lang="ts">
/**
 * Premium — planes de Mosaic (modelo freemium). Todos los usuarios están en
 * el plan Gratis: Premium todavía no se puede comprar. "Mejorar a Premium"
 * sólo avisa que los pagos llegan en la siguiente fase; no pide datos de
 * pago ni cambia la cuenta. Los beneficios de Premium se listan, pero aún no
 * existen en la app.
 */
import { computed, ref } from 'vue'
import BaseButton from '../components/BaseButton.vue'
import BaseIcon from '../components/BaseIcon.vue'
import BaseModal from '../components/BaseModal.vue'

type Billing = 'monthly' | 'yearly'

/** Precios en dólares; el monto en quetzales es aproximado. */
const PRICE_MONTHLY_USD = 2
const PRICE_YEARLY_USD = 18
const GTQ_PER_USD = 7.7

const billing = ref<Billing>('monthly')
const comingSoonOpen = ref(false)

const yearlySavings = Math.round((1 - PRICE_YEARLY_USD / (PRICE_MONTHLY_USD * 12)) * 100)

const price = computed(() => {
  const usd = billing.value === 'monthly' ? PRICE_MONTHLY_USD : PRICE_YEARLY_USD
  return {
    usd,
    gtq: Math.round(usd * GTQ_PER_USD),
    period: billing.value === 'monthly' ? 'mes' : 'año',
  }
})

const FREE_FEATURES = [
  'Registra películas, series, libros, juegos y música',
  'Diario, calificaciones y reseñas',
  'Listas y metas anuales',
  'Sigue perfiles y mira su actividad',
  'Tu ADN cultural',
]

const PREMIUM_FEATURES = [
  'Todo lo del plan Gratis',
  'ADN cultural avanzado: estadísticas por año y comparación con amigos',
  'Resumen de tu año cultural',
  'Insignia Premium en tu perfil',
  'Temas de color extra',
]
</script>

<template>
  <div class="premium">
    <header class="premium__head">
      <div class="premium__icon" aria-hidden="true"><BaseIcon name="gem" /></div>
      <div>
        <h1 class="premium__title">Mosaic Premium</h1>
        <p class="premium__subtitle">
          Todo lo que ya usas sigue siendo gratis. Premium suma extras para quien quiere ir más a fondo en su
          identidad cultural.
        </p>
        <p class="premium__current">
          Tu plan actual: <span class="premium__tag">Gratis</span>
        </p>
      </div>
    </header>

    <div class="premium__billing" role="group" aria-label="Forma de pago">
      <button
        type="button"
        class="premium__billing-option"
        :class="{ 'premium__billing-option--active': billing === 'monthly' }"
        :aria-pressed="billing === 'monthly'"
        @click="billing = 'monthly'"
      >
        Mensual
      </button>
      <button
        type="button"
        class="premium__billing-option"
        :class="{ 'premium__billing-option--active': billing === 'yearly' }"
        :aria-pressed="billing === 'yearly'"
        @click="billing = 'yearly'"
      >
        Anual <span class="premium__save">Ahorra {{ yearlySavings }} %</span>
      </button>
    </div>

    <div class="premium__plans">
      <section class="plan" aria-labelledby="plan-free">
        <h2 id="plan-free" class="plan__name">Gratis</h2>
        <p class="plan__price"><span class="plan__amount">US$0</span> <span class="plan__period">para siempre</span></p>
        <ul class="plan__features">
          <li v-for="f in FREE_FEATURES" :key="f"><BaseIcon name="check2" class="plan__check" /> {{ f }}</li>
        </ul>
        <BaseButton variant="outline" class="plan__cta" disabled>Tu plan actual</BaseButton>
      </section>

      <section class="plan plan--premium" aria-labelledby="plan-premium">
        <span class="plan__badge">Recomendado</span>
        <h2 id="plan-premium" class="plan__name"><BaseIcon name="gem" /> Premium</h2>
        <p class="plan__price">
          <span class="plan__amount">US${{ price.usd }}</span>
          <span class="plan__period">/ {{ price.period }}</span>
        </p>
        <p class="plan__local">
          ≈ Q{{ price.gtq }}
          <template v-if="billing === 'yearly'"> · equivale a 3 meses gratis</template>
        </p>
        <ul class="plan__features">
          <li v-for="f in PREMIUM_FEATURES" :key="f"><BaseIcon name="check2" class="plan__check" /> {{ f }}</li>
        </ul>
        <BaseButton class="plan__cta" @click="comingSoonOpen = true">Mejorar a Premium</BaseButton>
      </section>
    </div>

    <p class="premium__note">Precios en dólares estadounidenses. El monto en quetzales es aproximado.</p>

    <BaseModal v-if="comingSoonOpen" title="Los pagos llegan muy pronto" @close="comingSoonOpen = false">
      <div class="premium__soon">
        <div class="premium__soon-icon" aria-hidden="true"><BaseIcon name="hourglass-split" /></div>
        <p>
          Todavía no aceptamos pagos: Mosaic Premium llega en la siguiente fase. Mientras tanto, todo Mosaic sigue
          siendo gratis para ti.
        </p>
      </div>
      <template #footer>
        <BaseButton @click="comingSoonOpen = false">Entendido</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.premium {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  max-width: 960px;
}

.premium__head {
  display: flex;
  align-items: flex-start;
  gap: var(--space-md);
}

.premium__icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: var(--radius-lg);
  background: var(--color-accent-bg);
  color: var(--color-accent);
  font-size: 1.75rem;
}

.premium__title {
  margin: 0;
  font-size: 2.25rem;
  font-weight: 800;
  color: var(--color-text);
}

.premium__subtitle {
  margin: var(--space-xs) 0 0 0;
  max-width: 60ch;
  color: var(--color-text-muted);
}

.premium__current {
  margin: var(--space-sm) 0 0 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.premium__tag {
  padding: 1px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  background: var(--color-surface-2);
  color: var(--color-success);
}

/* Mensual / Anual */
.premium__billing {
  align-self: flex-start;
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  border-radius: 999px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}

.premium__billing-option {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: 6px 16px;
  border: none;
  border-radius: 999px;
  background: none;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.premium__billing-option--active {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
}

.premium__save {
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 0.6875rem;
  font-weight: 700;
  background: var(--color-surface-2);
  color: var(--color-success);
}

/* Planes */
.premium__plans {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-md);
}

.plan {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-lg);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}

.plan--premium {
  border-color: var(--color-accent);
  background:
    linear-gradient(160deg, var(--color-accent-bg), transparent 60%),
    var(--color-surface);
}

.plan__badge {
  position: absolute;
  top: var(--space-md);
  right: var(--space-md);
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: var(--color-accent);
  color: var(--color-accent-contrast);
}

.plan__name {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--color-text);
}

.plan--premium .plan__name {
  color: var(--color-accent);
}

.plan__price {
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: var(--space-xs);
}

.plan__amount {
  font-size: 2.25rem;
  font-weight: 800;
  color: var(--color-text);
}

.plan__period,
.plan__local {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.plan__local {
  margin: -4px 0 0 0;
}

.plan__features {
  list-style: none;
  margin: var(--space-sm) 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  flex: 1;
}

.plan__features li {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  font-size: 0.9375rem;
  color: var(--color-text);
}

.plan__check {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--color-success);
}

.plan__cta {
  align-self: stretch;
}

.premium__note {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-subtle);
}

.premium__soon {
  display: flex;
  align-items: flex-start;
  gap: var(--space-md);
}

.premium__soon p {
  margin: 0;
  color: var(--color-text);
  line-height: 1.55;
}

.premium__soon-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--color-accent-bg);
  color: var(--color-accent);
  font-size: 1.25rem;
}

@media (max-width: 720px) {
  .premium__plans {
    grid-template-columns: 1fr;
  }

  .premium__title {
    font-size: 1.75rem;
  }
}
</style>
