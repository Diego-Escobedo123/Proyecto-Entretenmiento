/**
 * Ítems de la navegación lateral. `to` debe coincidir con un path del router.
 */
export interface NavItem {
  label: string
  icon: string
  to: string
}

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Inicio', icon: '🏠', to: '/' },
  { label: 'Explorar', icon: '🧭', to: '/explore' },
  { label: 'Mi colección', icon: '🗂️', to: '/collection' },
  { label: 'Listas', icon: '📋', to: '/lists' },
  { label: 'Perfil', icon: '👤', to: '/profile' },
] as const
