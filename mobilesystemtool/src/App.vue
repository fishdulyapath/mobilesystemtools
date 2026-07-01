<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import Toast from 'primevue/toast'
import ConfirmDialog from 'primevue/confirmdialog'
import AuthLayout from '@/layouts/AuthLayout.vue'
import AppLayout from '@/layouts/AppLayout.vue'
import BlankLayout from '@/layouts/BlankLayout.vue'

const route = useRoute()

const layout = computed(() => {
  if (route.meta.layout === 'AuthLayout') return AuthLayout
  if (route.meta.layout === 'BlankLayout') return BlankLayout
  if (route.meta.layout === 'AppLayout') return AppLayout
  return AppLayout
})
</script>

<template>
  <div>
    <component :is="layout">
      <router-view />
    </component>
    <Toast />
    <ConfirmDialog />
  </div>
</template>
