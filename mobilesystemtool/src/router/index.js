import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePosStore } from '@/stores/pos'
import { PERMISSIONS } from '@/utils/permissions'

const routes = [
  { path: '/', redirect: '/sell' },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/LoginView.vue'),
    meta: { requiresAuth: false, layout: 'AuthLayout' },
  },
  {
    path: '/select-pos',
    name: 'SelectPos',
    component: () => import('@/views/SelectPosView.vue'),
    meta: { requiresAuth: true, layout: 'AuthLayout' },
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { requiresAuth: true, requiresPos: true, layout: 'AppLayout' },
  },
  {
    path: '/sales-history',
    name: 'SalesHistory',
    component: () => import('@/views/SalesHistoryView.vue'),
    props: { documentType: 'sale', title: 'ประวัติการขาย' },
    meta: { requiresAuth: true, requiresPos: true, anyPermissions: [PERMISSIONS.salesCashView, PERMISSIONS.salesCreditView], layout: 'AppLayout' },
  },
  { path: '/sales-history/cash', redirect: { path: '/sales-history', query: { sale_kind: 'cash' } } },
  { path: '/sales-history/credit', redirect: { path: '/sales-history', query: { sale_kind: 'credit' } } },
  {
    path: '/sales-history/reserve-order',
    name: 'ReserveOrderHistory',
    component: () => import('@/views/SalesHistoryView.vue'),
    props: { documentType: 'reserve_order', title: 'ประวัติใบสั่งซื้อ-สั่งจอง' },
    meta: { requiresAuth: true, requiresPos: true, permission: PERMISSIONS.sellView, layout: 'AppLayout' },
  },
  {
    path: '/sales-history/sale-order',
    name: 'SaleOrderHistory',
    component: () => import('@/views/SalesHistoryView.vue'),
    props: { documentType: 'sale_order', title: 'ประวัติใบสั่งขาย' },
    meta: { requiresAuth: true, requiresPos: true, permission: PERMISSIONS.sellView, layout: 'AppLayout' },
  },
  {
    path: '/sales-history/by-product',
    name: 'ProductSaleHistory',
    component: () => import('@/views/ProductSaleHistoryView.vue'),
    meta: { requiresAuth: true, requiresPos: true, permission: PERMISSIONS.salesProductHistoryView, layout: 'AppLayout' },
  },
  {
    path: '/sales/return',
    name: 'SalesReturn',
    component: () => import('@/views/SalesReturnView.vue'),
    meta: { requiresAuth: true, requiresPos: true, permission: PERMISSIONS.salesReturnView, layout: 'AppLayout' },
  },
  {
    path: '/sales/advance-payment',
    name: 'AdvancePayment',
    component: () => import('@/views/AdvancePaymentView.vue'),
    meta: { requiresAuth: true, requiresPos: true, permission: PERMISSIONS.salesAdvancePaymentView, layout: 'AppLayout' },
  },
  {
    path: '/sales/advance-payment/history',
    name: 'AdvancePaymentHistory',
    component: () => import('@/views/AdvancePaymentHistoryView.vue'),
    meta: { requiresAuth: true, requiresPos: true, permission: PERMISSIONS.salesAdvancePaymentHistoryView, layout: 'AppLayout' },
  },
  {
    path: '/sales/ar-billing',
    name: 'ArBilling',
    component: () => import('@/views/ArBillingView.vue'),
    meta: { requiresAuth: true, requiresPos: true, permission: PERMISSIONS.salesArBillingView, layout: 'AppLayout' },
  },
  {
    path: '/sales/ar-billing/history',
    name: 'ArBillingHistory',
    component: () => import('@/views/ArBillingHistoryView.vue'),
    meta: { requiresAuth: true, requiresPos: true, permission: PERMISSIONS.salesArBillingView, layout: 'AppLayout' },
  },
  {
    path: '/sales/ar-debt-payment',
    name: 'ArDebtPayment',
    component: () => import('@/views/ArDebtPaymentView.vue'),
    meta: { requiresAuth: true, requiresPos: true, permission: PERMISSIONS.salesArDebtPaymentView, layout: 'AppLayout' },
  },
  {
    path: '/sales/ar-debt-payment/history',
    name: 'ArDebtPaymentHistory',
    component: () => import('@/views/ArDebtPaymentHistoryView.vue'),
    meta: { requiresAuth: true, requiresPos: true, permission: PERMISSIONS.salesArDebtPaymentHistoryView, layout: 'AppLayout' },
  },
  {
    path: '/cash/other-expense',
    name: 'OtherExpense',
    component: () => import('@/views/OtherExpenseView.vue'),
    meta: { requiresAuth: true, requiresPos: true, permission: PERMISSIONS.cashOtherExpenseCreate, layout: 'AppLayout' },
  },
  {
    path: '/cash/other-expense/history',
    name: 'OtherExpenseHistory',
    component: () => import('@/views/OtherExpenseHistoryView.vue'),
    meta: { requiresAuth: true, requiresPos: true, permission: PERMISSIONS.cashOtherExpenseView, layout: 'AppLayout' },
  },
  {
    path: '/sell',
    name: 'Sell',
    component: () => import('@/views/SellView.vue'),
    meta: { requiresAuth: true, requiresPos: true, permission: PERMISSIONS.sellView, layout: 'AppLayout' },
  },
  {
    path: '/inventory',
    name: 'Inventory',
    component: () => import('@/views/InventoryView.vue'),
    meta: { requiresAuth: true, requiresPos: true, permission: PERMISSIONS.inventoryView, layout: 'AppLayout' },
  },
  {
    path: '/sold-out',
    name: 'SoldOut',
    component: () => import('@/views/SoldOutView.vue'),
    meta: { requiresAuth: true, requiresPos: true, permission: PERMISSIONS.soldOutView, layout: 'AppLayout' },
  },
  {
    path: '/purchase/stock-reorder',
    name: 'PurchaseStockReorder',
    component: () => import('@/views/PurchaseStockReorderView.vue'),
    meta: { requiresAuth: true, requiresPos: false, permission: PERMISSIONS.purchaseStockReorderView, layout: 'AppLayout' },
  },
  {
    path: '/purchase/pu',
    name: 'PurchasePU',
    component: () => import('@/views/PurchasePUView.vue'),
    meta: { requiresAuth: true, requiresPos: false, permission: PERMISSIONS.purchasePuView, layout: 'AppLayout' },
  },
  {
    path: '/purchase/pu/create',
    name: 'PurchasePUCreate',
    component: () => import('@/views/PurchasePUView.vue'),
    meta: { requiresAuth: true, requiresPos: false, permissions: [PERMISSIONS.purchasePuView, PERMISSIONS.purchasePuCreate], layout: 'AppLayout' },
  },
  {
    path: '/purchase/pu/:docNo/edit',
    name: 'PurchasePUEdit',
    component: () => import('@/views/PurchasePUView.vue'),
    meta: { requiresAuth: true, requiresPos: false, permissions: [PERMISSIONS.purchasePuView, PERMISSIONS.purchasePuEdit], layout: 'AppLayout' },
  },
  {
    path: '/purchase/premium',
    name: 'PurchasePremium',
    component: () => import('@/views/PurchasePermiumView.vue'),
    meta: { requiresAuth: true, requiresPos: false, permission: PERMISSIONS.purchasePremiumManage, layout: 'AppLayout' },
  },
  {
    path: '/receipt',
    name: 'Receipt',
    component: () => import('@/views/ReceiptView.vue'),
    meta: { requiresAuth: false, layout: 'BlankLayout' },
  },
  {
    path: '/products',
    name: 'ProductManage',
    component: () => import('@/views/ProductManageView.vue'),
    meta: { requiresAuth: true, requiresPos: false, permission: PERMISSIONS.productView, layout: 'AppLayout' },
  },
  {
    path: '/permissions',
    name: 'PermissionManage',
    component: () => import('@/views/PermissionManageView.vue'),
    meta: { requiresAuth: true, requiresPos: false, permission: PERMISSIONS.permissionManage, layout: 'AppLayout' },
  },
  {
    path: '/products/:code/edit',
    name: 'ProductManageEdit',
    component: () => import('@/views/ProductManageEditView.vue'),
    meta: { requiresAuth: true, requiresPos: false, permission: PERMISSIONS.productView, layout: 'AppLayout' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { layout: 'AppLayout' },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

function firstAllowedRoute(authStore) {
  return firstAllowedRouteForPos(authStore, true)
}

function routeRequiresPos(name) {
  return routes.find((route) => route.name === name)?.meta?.requiresPos === true
}

function canAccessRouteCandidate(authStore, item) {
  if (item.anyPermissions) return item.anyPermissions.some((permission) => authStore.hasPermission(permission))
  return authStore.hasPermission(item.permission)
}

function firstAllowedRouteForPos(authStore, hasPos) {
  const candidates = [
    { name: 'Sell', permission: PERMISSIONS.sellView },
    { name: 'SalesHistory', anyPermissions: [PERMISSIONS.salesCashView, PERMISSIONS.salesCreditView] },
    { name: 'ReserveOrderHistory', permission: PERMISSIONS.sellView },
    { name: 'SaleOrderHistory', permission: PERMISSIONS.sellView },
    { name: 'Inventory', permission: PERMISSIONS.inventoryView },
    { name: 'PermissionManage', permission: PERMISSIONS.permissionManage },
  ]
  return candidates.find((item) =>
    canAccessRouteCandidate(authStore, item) && (hasPos || !routeRequiresPos(item.name))
  ) || (hasPos ? { name: 'Dashboard' } : { name: 'SelectPos' })
}

router.beforeEach((to) => {
  const authStore = useAuthStore()
  const posStore = usePosStore()

  const isValid = authStore.checkAndExpire()

  if (to.meta.requiresAuth && !isValid) {
    return { name: 'Login' }
  }

  if (to.meta.requiresPos && !posStore.hasPos) {
    return { name: 'SelectPos' }
  }

  if (to.meta.permission && !authStore.hasPermission(to.meta.permission)) {
    return firstAllowedRouteForPos(authStore, posStore.hasPos)
  }

  if (to.meta.anyPermissions && !to.meta.anyPermissions.some((permission) => authStore.hasPermission(permission))) {
    return firstAllowedRouteForPos(authStore, posStore.hasPos)
  }

  if (to.meta.permissions && !authStore.hasAllPermissions(to.meta.permissions)) {
    return firstAllowedRouteForPos(authStore, posStore.hasPos)
  }

  if (to.name === 'Login' && isValid) {
    return firstAllowedRouteForPos(authStore, posStore.hasPos)
  }
})

export default router
