<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePosStore } from '@/stores/pos'
import Avatar from 'primevue/avatar'
import Tag from 'primevue/tag'
import Menu from 'primevue/menu'

const router = useRouter()
const authStore = useAuthStore()
const posStore = usePosStore()

const emit = defineEmits(['menu-click'])

const menu = ref(null)
const menuItems = [
  {
    label: 'เปลี่ยนเครื่อง POS',
    icon: 'pi pi-desktop',
    command: () => router.push('/select-pos?change=true'),
  },
  { separator: true },
  {
    label: 'ออกจากระบบ',
    icon: 'pi pi-sign-out',
    command: () => {
      authStore.logout()
      posStore.clearPos()
      router.push('/login')
    },
  },
]

const initials = computed(() => {
  const name = authStore.employee?.user_name || ''
  return name.slice(0, 2) || 'U'
})

function toggleMenu(event) {
  menu.value.toggle(event)
}
</script>

<template>
  <header class="topbar">
    <div class="topbar-left">
      <button class="hamburger" aria-label="เมนู" @click="emit('menu-click')">
        <i class="pi pi-bars" />
      </button>
      <span class="topbar-brand">
        <span>
          <img src="@/assets/applogo.png" alt="MobileTools" class="brand-mark" /> 
        </span>
        MobileTools
      </span>
    </div>

    <div class="topbar-right">
      <Tag v-if="posStore.posId" :value="posStore.posId" severity="info" class="pos-tag" />
      <span class="topbar-username">{{ authStore.employee?.user_name }}</span>
      <Avatar
        :label="initials"
        shape="circle"
        size="normal"
        class="avatar-btn"
        @click="toggleMenu"
      />
      <Menu ref="menu" :model="menuItems" popup />
    </div>
  </header>
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1rem;
  height: 56px;
  background: rgba(255, 255, 255, 0.92);
  border-bottom: 1px solid var(--app-blue-line);
  box-shadow: 0 8px 26px rgba(8, 47, 73, 0.08);
  backdrop-filter: blur(12px);
  position: sticky;
  top: 0;
  z-index: 100;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.hamburger {
  display: none;
  width: 2rem;
  height: 2rem;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 1.1rem;
  color: var(--app-blue-ink);
  border-radius: 6px;
  align-items: center;
  justify-content: center;
  -webkit-tap-highlight-color: transparent;
}

.hamburger:hover {
  background: var(--app-blue-soft);
}

@media (max-width: 1180px) {
  .hamburger {
    display: flex;
  }
}

.topbar-brand {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--p-primary-color);
}

.brand-mark {
  width: 1.8rem;
  height: 1.8rem;
  object-fit: contain;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.topbar-username {
  font-size: 0.875rem;
  color: var(--p-text-color-secondary);
}

.avatar-btn {
  cursor: pointer;
  background: var(--p-primary-color);
  color: #ffffff;
}

.avatar-btn:hover {
  opacity: 0.85;
}

@media (max-width: 767px) {
  .topbar-username {
    display: none;
  }

  .pos-tag {
    display: none;
  }
}
</style>
