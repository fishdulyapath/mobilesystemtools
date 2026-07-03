<script setup>
import { computed, ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import AppTopbar from "@/components/common/AppTopbar.vue";
import AppSidebar from "@/components/common/AppSidebar.vue";
import Drawer from "primevue/drawer";
import { useAuthStore } from "@/stores/auth";
import { usePosStore } from "@/stores/pos";
import { getEnabledMenuGroups } from "@/utils/appScreens";

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const posStore = usePosStore();

const drawerOpen = ref(false);

const visibleNavGroups = computed(() =>
  getEnabledMenuGroups()
    .map((group) => ({
      ...group,
      items: group.items.filter(canAccessMenuItem),
    }))
    .filter((group) => group.items.length > 0),
);

function canAccessMenuItem(item) {
  if (item.anyPermissions) return item.anyPermissions.some((permission) => authStore.hasPermission(permission));
  return authStore.hasPermission(item.permission);
}

function navigate(to) {
  router.push(to);
  drawerOpen.value = false;
}

function logout() {
  drawerOpen.value = false;
  authStore.logout();
  posStore.clearPos();
  router.push("/login");
}
</script>

<template>
  <div class="app-layout">
    <AppTopbar @menu-click="drawerOpen = true" />

    <div class="app-body">
      <!-- Desktop sidebar: visible on wide screens; iPad uses drawer to keep workspace wide -->
      <aside class="desktop-sidebar">
        <AppSidebar />
      </aside>

      <main class="layout-main">
        <div class="layout-content">
          <slot />
        </div>
      </main>
    </div>

    <!-- Mobile nav drawer -->
    <Drawer :visible="drawerOpen" position="left" :pt="{ root: { class: 'mobile-nav-drawer' } }" @update:visible="drawerOpen = $event">
      <template #header>
        <span class="drawer-title">MobileTools</span>
      </template>
      <!-- ข้อมูลผู้ใช้ + POS -->
      <div class="drawer-user-card">
        <div class="drawer-user-row">
          <i class="pi pi-user drawer-user-icon" />
          <div class="drawer-user-info">
            <div class="drawer-user-name">{{ authStore.employee?.user_name || "-" }}</div>
            <div class="drawer-user-code">{{ authStore.employee?.user_code || "" }}</div>
          </div>
        </div>
        <div class="drawer-pos-row">
          <i class="pi pi-desktop drawer-pos-icon" />
          <span class="drawer-pos-label">เครื่อง POS:</span>
          <span class="drawer-pos-value">{{ posStore.posId || "-" }}</span>
          <button class="drawer-change-pos" @click="navigate('/select-pos?change=true')">เปลี่ยน</button>
        </div>
      </div>

      <div class="drawer-divider" />

      <nav class="drawer-nav">
        <div v-for="group in visibleNavGroups" :key="group.title" class="drawer-nav-group">
          <div class="drawer-nav-group-title">{{ group.title }}</div>
          <button
            v-for="item in group.items"
            :key="item.to"
            class="drawer-nav-item"
            :class="{ active: item.base ? route.path.startsWith(item.base) : route.path === item.to }"
            @click="navigate(item.to)"
          >
            <i :class="item.icon" class="nav-icon" />
            <span class="nav-label">{{ item.label }}</span>
          </button>
        </div>

        <div class="drawer-divider" />

        <button class="drawer-nav-item logout-item" @click="logout">
          <i class="pi pi-sign-out nav-icon" />
          <span class="nav-label">ออกจากระบบ</span>
        </button>
      </nav>
    </Drawer>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: var(--app-shell);
}

.app-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.desktop-sidebar {
  display: none;
}

@media (min-width: 1181px) {
  .desktop-sidebar {
    display: flex;
  }
}

.layout-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.layout-content {
  flex: 1;
  min-height: 0;
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  background: radial-gradient(circle at top right, rgba(45, 179, 244, 0.1), transparent 28rem), var(--app-shell);
}

@media (max-width: 767px) {
  .layout-content {
    padding: 1rem;
  }
}

@media (min-width: 768px) and (max-width: 1180px) {
  .layout-content {
    padding: 0.75rem;
  }
}

/* Drawer content styles (global because Drawer teleports out) */
.drawer-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--p-primary-color);
}

.drawer-user-card {
  padding: 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border: 1px solid var(--app-blue-line);
  border-radius: 8px;
  background: linear-gradient(180deg, #ffffff, #f1f9ff);
}

.drawer-user-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.drawer-user-icon {
  font-size: 1.1rem;
  color: var(--p-primary-color);
  width: 1.25rem;
  text-align: center;
  flex-shrink: 0;
}

.drawer-user-info {
  min-width: 0;
}

.drawer-user-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--p-text-color);
  line-height: 1.3;
}

.drawer-user-code {
  font-size: 0.75rem;
  color: var(--p-text-color-secondary);
}

.drawer-pos-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.drawer-pos-icon {
  font-size: 0.9rem;
  color: var(--p-text-color-secondary);
  width: 1.25rem;
  text-align: center;
  flex-shrink: 0;
}

.drawer-pos-label {
  font-size: 0.8rem;
  color: var(--p-text-color-secondary);
}

.drawer-pos-value {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--p-text-color);
}

.drawer-change-pos {
  margin-left: auto;
  border: 1px solid var(--p-primary-color);
  background: none;
  color: var(--p-primary-color);
  font-size: 0.75rem;
  font-family: inherit;
  padding: 0.2rem 0.625rem;
  border-radius: 999px;
  cursor: pointer;
  transition: background 0.12s;
  -webkit-tap-highlight-color: transparent;
}

.drawer-change-pos:hover {
  background: color-mix(in srgb, var(--p-primary-color) 10%, transparent);
}

.drawer-nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem 0;
}

.drawer-nav-group {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  margin-bottom: 0.75rem;
}

.drawer-nav-group-title {
  padding: 0.5rem 1rem 0.25rem;
  color: #49718e;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0;
}

.drawer-nav-item {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  width: 100%;
  padding: 0.75rem 1rem;
  border: none;
  background: none;
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.9rem;
  color: var(--p-text-color);
  text-align: left;
  transition: background 0.12s;
  -webkit-tap-highlight-color: transparent;
}

.drawer-nav-item:hover {
  background: var(--app-blue-soft);
}

.drawer-nav-item.active {
  background: linear-gradient(90deg, #dff1ff, #eff8ff);
  color: var(--p-primary-color);
  font-weight: 600;
}

.nav-icon {
  font-size: 1.1rem;
  width: 1.25rem;
  text-align: center;
  flex-shrink: 0;
}

.drawer-divider {
  height: 1px;
  background: var(--p-surface-border);
  margin: 0.5rem 0;
}

.logout-item {
  color: #dc2626;
}

.logout-item:hover {
  background: #fef2f2;
}
</style>
