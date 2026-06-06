// App bootstrap. Install order matters (notes/frontend-architecture.md §7):
//   createApp → use(pinia) → use(PiniaColada) [AFTER pinia] → use(router)
//   → installGuards() → mount.
// The session store calls useSession() inside setup, so it must resolve within a
// pinia + app context — the guard instantiates it lazily via useSessionStore().
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { PiniaColada } from '@pinia/colada'
import App from '@/App.vue'
import { router } from '@/router'
import { installGuards } from '@/router/guard'
import '@/assets/main.css'

const app = createApp(App)

app.use(createPinia())
app.use(PiniaColada, {})
app.use(router)

installGuards()

app.mount('#app')
