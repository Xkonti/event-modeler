// Routes + meta. `meta.layout` selects the shell in App.vue; `meta.public:true`
// marks routes reachable without auth (the auth pages). Everything else
// requires auth (guard.js default). createWebHistory → clean URLs (the dev
// server + prod must serve index.html for unknown paths / SPA fallback).
// See notes/frontend-architecture.md §7.
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/Login.vue'),
    meta: { layout: 'auth', public: true },
  },
  {
    path: '/signup',
    name: 'signup',
    component: () => import('@/pages/Signup.vue'),
    meta: { layout: 'auth', public: true },
  },
  {
    path: '/',
    name: 'home',
    component: () => import('@/pages/Home.vue'),
    meta: { layout: 'app' }, // requires auth (default)
  },
  // Unknown paths → home; the guard then redirects to /login if unauthenticated.
  { path: '/:pathMatch(.*)*', redirect: { name: 'home' } },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})
