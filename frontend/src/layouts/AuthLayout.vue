<script setup lang="ts">
/**
 * AuthLayout — pantalla completa para Login/Register, sin sidebar ni topbar
 * (nadie ha iniciado sesión todavía). Logo con una animación sutil de
 * flotación para que la pantalla no se sienta tan estática.
 */
import figLogo from '../assets/fig-logo.png'
</script>

<template>
  <div class="auth-layout">
    <div class="auth-layout__backdrop" aria-hidden="true" />

    <div class="auth-layout__panel">
      <div class="auth-layout__brand">
        <img class="auth-layout__logo" :src="figLogo" alt="" aria-hidden="true" />
        <h1 class="auth-layout__title">MOSAIC</h1>
        <p class="auth-layout__tagline">Every piece shapes your identity</p>
      </div>

      <div class="auth-layout__card">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-layout {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  background: var(--color-bg);
  padding: var(--space-lg);
}

.auth-layout__backdrop {
  position: absolute;
  inset: -20%;
  background:
    radial-gradient(circle at 20% 20%, var(--deep-raspberry) 0%, transparent 45%),
    radial-gradient(circle at 80% 75%, var(--fig-stem-green) 0%, transparent 40%);
  opacity: 0.18;
  filter: blur(60px);
}

.auth-layout__panel {
  position: relative;
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-lg);
}

.auth-layout__brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.auth-layout__logo {
  width: 96px;
  height: 96px;
  object-fit: contain;
  animation: auth-logo-float 4s ease-in-out infinite;
}

.auth-layout__title {
  color: var(--fig-stem-green);
  font-size: 2.25rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  margin: var(--space-sm) 0 0 0;
}

.auth-layout__tagline {
  color: var(--color-text-subtle);
  font-size: 0.875rem;
  margin: 2px 0 0 0;
}

.auth-layout__card {
  width: 100%;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
  box-sizing: border-box;
}

@keyframes auth-logo-float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

@media (max-width: 480px) {
  .auth-layout__card {
    padding: var(--space-lg);
  }
}
</style>