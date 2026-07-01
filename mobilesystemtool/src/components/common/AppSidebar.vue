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
    title: "บันทึก Transaction",
    items: [
      { label: "ขายสินค้า", icon: "pi pi-shopping-cart", to: "/sell", permission: PERMISSIONS.sellView },
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
      { label: "ของแถมซื้อ", icon: "pi pi-gift", to: "/purchase/premium", permission: PERMISSIONS.purchasePremiumManage },
    ],
  },
  {
    title: "ระบบ",
    items: [
      { label: "กำหนดสิทธิ์", icon: "pi pi-lock", to: "/permissions", permission: PERMISSIONS.permissionManage },
    ],
  },
];

const visibleMenuGroups = computed(() =>
  menuGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => authStore.hasPermission(item.permission)),
    }))
    .filter((group) => group.items.length > 0),
);

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
  background-color: #ffffff;
  background-color: var(--p-surface-0, #ffffff);
  border-right: 1px solid var(--p-surface-border);
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
  color: var(--p-text-color-secondary);
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
  border-radius: 6px;
  margin: 0.125rem 0.5rem;
  color: var(--p-text-color-secondary);
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
  background: var(--p-surface-hover);
  color: var(--p-text-color);
}

.sidebar-item.active {
  background: var(--p-primary-50);
  color: var(--p-primary-color);
  font-weight: 600;
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
