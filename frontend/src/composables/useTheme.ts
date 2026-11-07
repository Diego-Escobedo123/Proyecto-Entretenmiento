/**
 * useTheme — tema claro/oscuro compartido entre toda la app.
 * Estado a nivel de módulo (no hace falta Pinia): cualquier componente que
 * llame a `useTheme()` lee y modifica el mismo valor.
 *
 * El valor inicial ya lo aplica un script inline en index.html, antes de
 * montar Vue, para evitar el parpadeo del tema incorrecto al cargar. Este
 * composable solo sincroniza el estado reactivo con `document.documentElement`
 * y expone cómo cambiarlo. Se persiste en localStorage.
 */
import { ref } from 'vue'

const THEME_KEY = 'mosaic:theme'
export type Theme = 'dark' | 'light'

function readInitialTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

const theme = ref<Theme>(readInitialTheme())

function applyTheme(value: Theme): void {
  document.documentElement.dataset.theme = value
  try {
    localStorage.setItem(THEME_KEY, value)
  } catch {
    // localStorage no disponible (modo privado, cuota llena, etc.) — el
    // tema sigue funcionando, solo no persiste entre sesiones.
  }
}

export function useTheme() {
  function setTheme(value: Theme): void {
    theme.value = value
    applyTheme(value)
  }

  function toggleTheme(): void {
    setTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  return { theme, setTheme, toggleTheme }
}
