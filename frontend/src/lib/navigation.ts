/**
 * Ítems de la navegación lateral. `to` debe coincidir con un path del router.
 * `icon` es un nombre de Bootstrap Icons (sin el prefijo `bi-`).
 */
export interface NavItem {
  label: string
  icon: string
  to: string
}

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Inicio', icon: 'house', to: '/' },
  { label: 'Explorar', icon: 'compass', to: '/explore' },
  { label: 'Mi colección', icon: 'collection', to: '/collection' },
  { label: 'Listas', icon: 'card-list', to: '/lists' },
  { label: 'Perfil', icon: 'person', to: '/profile' },
] as const
