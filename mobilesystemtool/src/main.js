import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import ToastService from 'primevue/toastservice'
import DialogService from 'primevue/dialogservice'
import ConfirmationService from 'primevue/confirmationservice'
import 'primeicons/primeicons.css'

import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import { usePosStore } from './stores/pos'
import './assets/main.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

const authStore = useAuthStore()
const posStore = usePosStore()
authStore.restoreSession()
posStore.restorePos()

app.use(router)
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      prefix: 'p',
      darkModeSelector: '.dark',
      cssLayer: false,
    },
  },
})
app.use(ToastService)
app.use(DialogService)
app.use(ConfirmationService)

app.mount('#app')
