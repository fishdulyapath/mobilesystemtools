<script setup>
import { computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { usePosStore } from "@/stores/pos";
import { PERMISSIONS } from "@/utils/permissions";

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const posStore = usePosStore();

const menuGroups = [
  {
    title: "ภาพรวม",
    items: [
      { label: "แดชบอร์ด", icon: "pi pi-home", to: "/dashboard" },
    ],
  },
  {
    title: "ธุรกรรม",
    items: [
      { label: "ตะกร้าสินค้า", icon: "pi pi-shopping-cart", to: "/sell", permission: PERMISSIONS.sellView },
      { label: "ซื้อ/ตั้งหนี้", icon: "pi pi-file-import", to: "/purchase/pu", base: "/purchase/pu", permission: PERMISSIONS.purchasePuView },
      { label: "รับคืนสินค้า/ลดหนี้", icon: "pi pi-undo", to: "/sales/return", permission: PERMISSIONS.salesReturnView },
      { label: "รับเงินล่วงหน้า", icon: "pi pi-wallet", to: "/sales/advance-payment", permission: PERMISSIONS.salesAdvancePaymentView },
      { label: "ใบวางบิล (ลูกหนี้)", icon: "pi pi-file-check", to: "/sales/ar-billing", permission: PERMISSIONS.salesArBillingView },
      { label: "รับชำระหนี้/ใบเสร็จ", icon: "pi pi-receipt", to: "/sales/ar-debt-payment", permission: PERMISSIONS.salesArDebtPaymentView },
      { label: "ค่าใช้จ่ายอื่นๆ", icon: "pi pi-receipt", to: "/cash/other-expense", permission: PERMISSIONS.cashOtherExpenseCreate },
    ],
  },
  {
    title: "ประวัติ / รายงาน",
    items: [
      { label: "ประวัติขายเงินสด", icon: "pi pi-money-bill", to: "/sales-history/cash", permission: PERMISSIONS.salesCashView },
      { label: "ประวัติขายเงินเชื่อ", icon: "pi pi-credit-card", to: "/sales-history/credit", permission: PERMISSIONS.salesCreditView },
      { label: "ประวัติขายตามสินค้า", icon: "pi pi-list", to: "/sales-history/by-product", permission: PERMISSIONS.salesProductHistoryView },
      { label: "สินค้าขายหมด", icon: "pi pi-exclamation-circle", to: "/sold-out", permission: PERMISSIONS.soldOutView },
      { label: "ดูสต๊อกสินค้าเพื่อสั่งซื้อ", icon: "pi pi-list-check", to: "/purchase/stock-reorder", permission: PERMISSIONS.purchaseStockReorderView },
      { label: "ประวัติรับเงินล่วงหน้า", icon: "pi pi-history", to: "/sales/advance-payment/history", permission: PERMISSIONS.salesAdvancePaymentHistoryView },
      { label: "ประวัติใบวางบิล", icon: "pi pi-list", to: "/sales/ar-billing/history", permission: PERMISSIONS.salesArBillingView },
      { label: "ประวัติรับชำระหนี้", icon: "pi pi-history", to: "/sales/ar-debt-payment/history", permission: PERMISSIONS.salesArDebtPaymentHistoryView },
      { label: "ประวัติค่าใช้จ่ายอื่นๆ", icon: "pi pi-receipt", to: "/cash/other-expense/history", permission: PERMISSIONS.cashOtherExpenseView },
    ],
  },
  {
    title: "สินค้า / คลัง",
    items: [
      { label: "คลังสินค้า", icon: "pi pi-box", to: "/inventory", permission: PERMISSIONS.inventoryView },
      { label: "จัดการสินค้า", icon: "pi pi-tag", to: "/products", base: "/products", permission: PERMISSIONS.productView },
    ],
  },
  {
    title: "ระบบ",
    items: [
      { label: "กำหนดสิทธิ์", icon: "pi pi-lock", to: "/permissions", permission: PERMISSIONS.permissionManage },
    ],
  },
];

const activeMenuPaths = new Set([
  "/sell",
  "/sales-history",
  "/sales-history/reserve-order",
  "/sales-history/sale-order",
  "/inventory",
  "/permissions",
]);

const menuLabelOverrides = {
  "/inventory": "จัดการคลัง",
};

const visibleMenuGroups = computed(() =>
  menuGroups
    .map((group) => normalizeMenuGroup(group, group.items
      .filter((item) => activeMenuPaths.has(item.to))
      .filter(canAccessMenuItem)
      .map((item) => ({
        ...item,
        label: menuLabelOverrides[item.to] || item.label,
      })),
    ))
    .filter((group) => group.items.length > 0),
);

function normalizeMenuGroup(group, items) {
  const firstPath = items[0]?.to || "";
  if (firstPath === "/sell") return { ...group, title: "ตะกร้าสินค้า", items };
  if (firstPath.startsWith("/sales-history")) return { ...group, title: "ประวัติ", items };
  if (firstPath === "/inventory") return { ...group, title: "จัดการคลัง", items };
  return { ...group, items };
}

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

