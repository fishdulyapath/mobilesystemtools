<script setup>
import { computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { usePosStore } from "@/stores/pos";
import { getEnabledMenuGroups } from "@/utils/appScreens";

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const posStore = usePosStore();

const visibleMenuGroups = computed(() =>
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
}

function logout() {
  authStore.logout();
  posStore.clearPos();
  router.push("/login");
}
</script>

<template>
  <nav class="sidebar-nav">
    <ul class="sidebar-menu">
      <li v-for="group in visibleMenuGroups" :key="group.title" class="sidebar-group">
        <div class="sidebar-group-title">{{ group.title }}</div>
        <ul class="sidebar-group-list">
          <li v-for="item in group.items" :key="item.to" class="sidebar-item" :class="{ active: item.base ? route.path.startsWith(item.base) : route.path === item.to }" @click="navigate(item.to)">
            <i :class="item.icon" />
            <span>{{ item.label }}</span>
          </li>
        </ul>
      </li>
    </ul>

    <div class="sidebar-footer">
      <div class="sidebar-item logout" @click="logout">
        <i class="pi pi-sign-out" />
        <span>ออกจากระบบ</span>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.sidebar-nav {
  width: 240px;
  background:
    linear-gradient(180deg, #ffffff 0%, #f5fbff 100%);
  border-right: 1px solid var(--app-blue-line);
  display: flex;
  flex-direction: column;
  height: 100%;
  padding-top: 0.5rem;
}

.sidebar-menu {
  list-style: none;
  margin: 0;
  padding: 0.5rem 0;
  flex: 1;
  overflow-y: auto;
}

.sidebar-group {
  list-style: none;
  margin: 0 0 0.75rem;
}

.sidebar-group-title {
  padding: 0.5rem 1rem 0.25rem;
  color: #49718e;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0;
}

.sidebar-group-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  cursor: pointer;
  border-radius: 8px;
  margin: 0.125rem 0.5rem;
  color: #526d82;
  transition:
    background 0.15s,
    color 0.15s;
  font-size: 0.9375rem;
}

.sidebar-item i {
  width: 1.25rem;
  text-align: center;
  flex-shrink: 0;
}

.sidebar-item:hover {
  background: var(--app-blue-soft);
  color: var(--app-blue-ink);
}

.sidebar-item.active {
  background: linear-gradient(90deg, #dff1ff, #eff8ff);
  color: var(--p-primary-color);
  font-weight: 600;
  box-shadow: inset 3px 0 0 var(--p-primary-color);
}

.sidebar-footer {
  padding: 0.5rem 0;
  border-top: 1px solid var(--p-surface-border);
}

.sidebar-item.logout:hover {
  color: var(--p-red-500);
  background: var(--p-red-50);
}
</style>

