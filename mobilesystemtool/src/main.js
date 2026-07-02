import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import { definePreset } from '@primeuix/themes'
import ToastService from 'primevue/toastservice'
import DialogService from 'primevue/dialogservice'
import ConfirmationService from 'primevue/confirmationservice'
import 'primeicons/primeicons.css'

import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import { usePosStore } from './stores/pos'
import './assets/main.css'

const MobileToolsPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#eff8ff',
      100: '#dff1ff',
      200: '#b9e3ff',
      300: '#78ccff',
      400: '#2db3f4',
      500: '#0695d7',
      600: '#0278b8',
      700: '#065f92',
      800: '#0a5079',
      900: '#0d4466',
      950: '#092b44',
    },
  },
})

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
    preset: MobileToolsPreset,
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
