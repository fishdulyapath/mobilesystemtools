import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePosStore } from '@/stores/pos'
import { PERMISSIONS } from '@/utils/permissions'
import { SCREEN_IDS, getEnabledRouteCandidates, isScreenEnabled } from '@/utils/appScreens'

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
    meta: { requiresAuth: true, requiresPos: true, permission: PERMISSIONS.dashboardView, screen: SCREEN_IDS.dashboard, layout: 'AppLayout' },
  },
  {
    path: '/sales-history',
    name: 'SalesHistory',
    component: () => import('@/views/SalesHistoryView.vue'),
    props: { documentType: 'sale', title: 'ประวัติการขาย' },
    meta: { requiresAuth: true, requiresPos: true, anyPermissions: [PERMISSIONS.salesCashView, PERMISSIONS.salesCreditView], screen: SCREEN_IDS.salesHistory, layout: 'AppLayout' },
  },
  { path: '/sales-history/cash', redirect: { path: '/sales-history', query: { sale_kind: 'cash' } } },
  { path: '/sales-history/credit', redirect: { path: '/sales-history', query: { sale_kind: 'credit' } } },
  {
    path: '/sales-history/reserve-order',
    name: 'ReserveOrderHistory',
    component: () => import('@/views/SalesHistoryView.vue'),
    props: { documentType: 'reserve_order', title: 'ประวัติใบสั่งซื้อ-สั่งจอง' },
    meta: { requiresAuth: true, requiresPos: true, permission: PERMISSIONS.salesReserveOrderHistoryView, screen: SCREEN_IDS.reserveOrderHistory, layout: 'AppLayout' },
  },
  {
    path: '/sales-history/sale-order',
    name: 'SaleOrderHistory',
    component: () => import('@/views/SalesHistoryView.vue'),
    props: { documentType: 'sale_order', title: 'ประวัติใบสั่งขาย' },
    meta: { requiresAuth: true, requiresPos: true, permission: PERMISSIONS.salesSaleOrderHistoryView, screen: SCREEN_IDS.saleOrderHistory, layout: 'AppLayout' },
  },
  {
    path: '/sales-history/by-product',
    name: 'ProductSaleHistory',
    component: () => import('@/views/ProductSaleHistoryView.vue'),
    meta: { requiresAuth: true, requiresPos: true, permission: PERMISSIONS.salesProductHistoryView, screen: SCREEN_IDS.salesProductHistory, layout: 'AppLayout' },
  },
  {
    path: '/sales/return',
    name: 'SalesReturn',
    component: () => import('@/views/SalesReturnView.vue'),
    meta: { requiresAuth: true, requiresPos: true, permission: PERMISSIONS.salesReturnView, screen: SCREEN_IDS.salesReturn, layout: 'AppLayout' },
  },
  {
    path: '/sales/advance-payment',
    name: 'AdvancePayment',
    component: () => import('@/views/AdvancePaymentView.vue'),
    meta: { requiresAuth: true, requiresPos: true, permission: PERMISSIONS.salesAdvancePaymentView, screen: SCREEN_IDS.salesAdvancePayment, layout: 'AppLayout' },
  },
  {
    path: '/sales/advance-payment/history',
    name: 'AdvancePaymentHistory',
    component: () => import('@/views/AdvancePaymentHistoryView.vue'),
    meta: { requiresAuth: true, requiresPos: true, permission: PERMISSIONS.salesAdvancePaymentHistoryView, screen: SCREEN_IDS.salesAdvancePaymentHistory, layout: 'AppLayout' },
  },
  {
    path: '/sales/ar-billing',
    name: 'ArBilling',
    component: () => import('@/views/ArBillingView.vue'),
    meta: { requiresAuth: true, requiresPos: true, permission: PERMISSIONS.salesArBillingView, screen: SCREEN_IDS.salesArBilling, layout: 'AppLayout' },
  },
  {
    path: '/sales/ar-billing/history',
    name: 'ArBillingHistory',
    component: () => import('@/views/ArBillingHistoryView.vue'),
    meta: { requiresAuth: true, requiresPos: true, permission: PERMISSIONS.salesArBillingView, screen: SCREEN_IDS.salesArBillingHistory, layout: 'AppLayout' },
  },
  {
    path: '/sales/ar-debt-payment',
    name: 'ArDebtPayment',
    component: () => import('@/views/ArDebtPaymentView.vue'),
    meta: { requiresAuth: true, requiresPos: true, permission: PERMISSIONS.salesArDebtPaymentView, screen: SCREEN_IDS.salesArDebtPayment, layout: 'AppLayout' },
  },
  {
    path: '/sales/ar-debt-payment/history',
    name: 'ArDebtPaymentHistory',
    component: () => import('@/views/ArDebtPaymentHistoryView.vue'),
    meta: { requiresAuth: true, requiresPos: true, permission: PERMISSIONS.salesArDebtPaymentHistoryView, screen: SCREEN_IDS.salesArDebtPaymentHistory, layout: 'AppLayout' },
  },
  {
    path: '/cash/other-expense',
    name: 'OtherExpense',
    component: () => import('@/views/OtherExpenseView.vue'),
    meta: { requiresAuth: true, requiresPos: true, permission: PERMISSIONS.cashOtherExpenseCreate, screen: SCREEN_IDS.cashOtherExpense, layout: 'AppLayout' },
  },
  {
    path: '/cash/other-expense/history',
    name: 'OtherExpenseHistory',
    component: () => import('@/views/OtherExpenseHistoryView.vue'),
    meta: { requiresAuth: true, requiresPos: true, permission: PERMISSIONS.cashOtherExpenseView, screen: SCREEN_IDS.cashOtherExpenseHistory, layout: 'AppLayout' },
  },
  {
    path: '/sell',
    name: 'Sell',
    component: () => import('@/views/SellView.vue'),
    meta: { requiresAuth: true, requiresPos: true, permission: PERMISSIONS.sellView, screen: SCREEN_IDS.sell, layout: 'AppLayout' },
  },
  {
    path: '/inventory',
    name: 'Inventory',
    component: () => import('@/views/InventoryView.vue'),
    meta: { requiresAuth: true, requiresPos: true, permission: PERMISSIONS.inventoryView, screen: SCREEN_IDS.inventory, layout: 'AppLayout' },
  },
  {
    path: '/sold-out',
    name: 'SoldOut',
    component: () => import('@/views/SoldOutView.vue'),
    meta: { requiresAuth: true, requiresPos: true, permission: PERMISSIONS.soldOutView, screen: SCREEN_IDS.soldOut, layout: 'AppLayout' },
  },
  {
    path: '/purchase/stock-reorder',
    name: 'PurchaseStockReorder',
    component: () => import('@/views/PurchaseStockReorderView.vue'),
    meta: { requiresAuth: true, requiresPos: false, permission: PERMISSIONS.purchaseStockReorderView, screen: SCREEN_IDS.purchaseStockReorder, layout: 'AppLayout' },
  },
  {
    path: '/purchase/pu',
    name: 'PurchasePU',
    component: () => import('@/views/PurchasePUView.vue'),
    meta: { requiresAuth: true, requiresPos: false, permission: PERMISSIONS.purchasePuView, screen: SCREEN_IDS.purchasePu, layout: 'AppLayout' },
  },
  {
    path: '/purchase/pu/create',
    name: 'PurchasePUCreate',
    component: () => import('@/views/PurchasePUView.vue'),
    meta: { requiresAuth: true, requiresPos: false, permissions: [PERMISSIONS.purchasePuView, PERMISSIONS.purchasePuCreate], screen: SCREEN_IDS.purchasePu, layout: 'AppLayout' },
  },
  {
    path: '/purchase/pu/:docNo/edit',
    name: 'PurchasePUEdit',
    component: () => import('@/views/PurchasePUView.vue'),
    meta: { requiresAuth: true, requiresPos: false, permissions: [PERMISSIONS.purchasePuView, PERMISSIONS.purchasePuEdit], screen: SCREEN_IDS.purchasePu, layout: 'AppLayout' },
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
    meta: { requiresAuth: true, requiresPos: false, permission: PERMISSIONS.productView, screen: SCREEN_IDS.products, layout: 'AppLayout' },
  },
  {
    path: '/permissions',
    name: 'PermissionManage',
    component: () => import('@/views/PermissionManageView.vue'),
    meta: { requiresAuth: true, requiresPos: false, permission: PERMISSIONS.permissionManage, screen: SCREEN_IDS.permissions, layout: 'AppLayout' },
  },
  {
    path: '/products/:code/edit',
    name: 'ProductManageEdit',
    component: () => import('@/views/ProductManageEditView.vue'),
    meta: { requiresAuth: true, requiresPos: false, permission: PERMISSIONS.productView, screen: SCREEN_IDS.products, layout: 'AppLayout' },
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
  const candidates = getEnabledRouteCandidates().map((item) => ({
    name: item.routeName,
    permission: item.permission,
    anyPermissions: item.anyPermissions,
  }))
  const allowed = candidates.find((item) =>
    canAccessRouteCandidate(authStore, item) && (hasPos || !routeRequiresPos(item.name))
  )
  return allowed || { name: 'SelectPos' }
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

  if (to.meta.screen && !isScreenEnabled(to.meta.screen)) {
    return firstAllowedRouteForPos(authStore, posStore.hasPos)
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
