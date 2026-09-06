import { createRouter, createWebHistory } from 'vue-router'

/**
 * Rutas de la app. Las screens se cargan de forma diferida (code-splitting).
 * El chrome (sidebar/topbar) lo aporta DefaultLayout desde App.vue, así que
 * las screens sólo definen su contenido.
 */
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('../Screens/home.vue') },
    { path: '/explore', name: 'explore', component: () => import('../Screens/explore.vue') },
    { path: '/collection', name: 'collection', component: () => import('../Screens/collection.vue') },
    { path: '/lists', name: 'lists', component: () => import('../Screens/lists.vue') },
    { path: '/profile', name: 'profile', component: () => import('../Screens/profile.vue') },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../Screens/not-found.vue') },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
