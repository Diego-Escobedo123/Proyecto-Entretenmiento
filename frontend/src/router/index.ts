import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import LoginScreen from '../Screens/login.vue'
import RegisterScreen from '../Screens/register.vue'
import HomeScreen from '../Screens/home.vue'
import ExploreScreen from '../Screens/explore.vue'
import CollectionScreen from '../Screens/collection.vue'
import DiaryScreen from '../Screens/diary.vue'
import ListsScreen from '../Screens/lists.vue'
import ListDetailScreen from '../Screens/list-detail.vue'
import ProfileScreen from '../Screens/profile.vue'
import PeopleScreen from '../Screens/people.vue'
import FollowsScreen from '../Screens/follows.vue'
import NotFoundScreen from '../Screens/not-found.vue'

/**
 * Rutas de la app. Importaciones normales (no lazy) a propósito: mezclar
 * componentes asíncronos con <Transition mode="out-in"> en App.vue causaba
 * un placeholder intermedio que Vue no puede animar y se quedaba trabado.
 * El chrome (sidebar/topbar) lo aporta DefaultLayout desde App.vue para las
 * rutas normales; las rutas con `meta.public` usan AuthLayout en su lugar.
 */
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginScreen, meta: { public: true } },
    { path: '/register', name: 'register', component: RegisterScreen, meta: { public: true } },
    { path: '/', name: 'home', component: HomeScreen },
    { path: '/explore', name: 'explore', component: ExploreScreen },
    { path: '/collection', name: 'collection', component: CollectionScreen },
    { path: '/diary', name: 'diary', component: DiaryScreen },
    { path: '/lists', name: 'lists', component: ListsScreen },
    { path: '/lists/:id', name: 'list-detail', component: ListDetailScreen },
    { path: '/profile', name: 'profile', component: ProfileScreen },
    // Una sola página de perfil: /users/me es el propio (misma vista que /profile).
    { path: '/users/me', redirect: '/profile' },
    { path: '/users/:id', name: 'user-profile', component: ProfileScreen },
    { path: '/users/:id/:tab(followers|following)', name: 'follows', component: FollowsScreen },
    { path: '/people', name: 'people', component: PeopleScreen },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundScreen },
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