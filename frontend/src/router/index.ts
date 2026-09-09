import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

/**
 * Rutas de la app. Las screens se cargan de forma diferida (code-splitting).
 * El chrome (sidebar/topbar) lo aporta DefaultLayout desde App.vue para las
 * rutas normales; las rutas con `meta.public` usan AuthLayout en su lugar
 * (ver App.vue). Las screens sólo definen su contenido.
 */
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('../Screens/login.vue'), meta: { public: true } },
    { path: '/register', name: 'register', component: () => import('../Screens/register.vue'), meta: { public: true } },
    { path: '/', name: 'home', component: () => import('../Screens/home.vue') },
    { path: '/explore', name: 'explore', component: () => import('../Screens/explore.vue') },
    { path: '/collection', name: 'collection', component: () => import('../Screens/collection.vue') },
    { path: '/lists', name: 'lists', component: () => import('../Screens/lists.vue') },
    { path: '/profile', name: 'profile', component: () => import('../Screens/profile.vue') },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../Screens/not-found.vue') },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

/**
 * Guard de autenticación (hardcodeado, ver stores/auth.ts).
 * TODO(backend): cuando el login sea real, este guard no cambia — sigue
 * leyendo auth.isAuthenticated, solo que ese valor vendrá de un token
 * verificado contra el backend en vez de localStorage.
 */
router.beforeEach((to) => {
  const auth = useAuthStore()

  if (!to.meta.public && !auth.isAuthenticated) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  if (to.meta.public && auth.isAuthenticated) {
    return { path: '/' }
  }

  return true
})