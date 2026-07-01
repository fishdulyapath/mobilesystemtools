import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePosStore } from '@/stores/pos'
import { PERMISSIONS } from '@/utils/permissions'

const routes = [
  { path: '/', redirect: '/dashboard' },
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
  { path: '/sales-history', redirect: '/sales-history/cash' },
  {
    path: '/sales-history/cash',
    name: 'SalesHistoryCash',
    component: () => import('@/views/SalesHistoryView.vue'),
    props: { saleKind: 'cash', title: 'ประวัติการขายเงินสด' },
    meta: { requiresAuth: true, requiresPos: true, permission: PERMISSIONS.salesCashView, layout: 'AppLayout' },
  },
  {
    path: '/sales-history/credit',
    name: 'SalesHistoryCredit',
    component: () => import('@/views/SalesHistoryView.vue'),
    props: { saleKind: 'credit', title: 'ประวัติการขายเงินเชื่อ' },
    meta: { requiresAuth: true, requiresPos: true, permission: PERMISSIONS.salesCreditView, layout: 'AppLayout' },
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

function firstAllowedRouteForPos(authStore, hasPos) {
  const candidates = [
    { name: 'Dashboard' },
    { name: 'Sell', permission: PERMISSIONS.sellView },
    { name: 'Inventory', permission: PERMISSIONS.inventoryView },
    { name: 'SalesHistoryCash', permission: PERMISSIONS.salesCashView },
    { name: 'SalesHistoryCredit', permission: PERMISSIONS.salesCreditView },
    { name: 'ProductSaleHistory', permission: PERMISSIONS.salesProductHistoryView },
    { name: 'SalesReturn', permission: PERMISSIONS.salesReturnView },
    { name: 'AdvancePayment', permission: PERMISSIONS.salesAdvancePaymentView },
    { name: 'AdvancePaymentHistory', permission: PERMISSIONS.salesAdvancePaymentHistoryView },
    { name: 'ArBilling', permission: PERMISSIONS.salesArBillingView },
    { name: 'ArBillingHistory', permission: PERMISSIONS.salesArBillingView },
    { name: 'ArDebtPayment', permission: PERMISSIONS.salesArDebtPaymentView },
    { name: 'ArDebtPaymentHistory', permission: PERMISSIONS.salesArDebtPaymentHistoryView },
    { name: 'OtherExpense', permission: PERMISSIONS.cashOtherExpenseCreate },
    { name: 'OtherExpenseHistory', permission: PERMISSIONS.cashOtherExpenseView },
    { name: 'SoldOut', permission: PERMISSIONS.soldOutView },
    { name: 'PurchaseStockReorder', permission: PERMISSIONS.purchaseStockReorderView },
    { name: 'PurchasePU', permission: PERMISSIONS.purchasePuView },
    { name: 'ProductManage', permission: PERMISSIONS.productView },
    { name: 'PermissionManage', permission: PERMISSIONS.permissionManage },
  ]
  return candidates.find((item) =>
    authStore.hasPermission(item.permission) && (hasPos || !routeRequiresPos(item.name))
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

  if (to.meta.permissions && !authStore.hasAllPermissions(to.meta.permissions)) {
    return firstAllowedRouteForPos(authStore, posStore.hasPos)
  }

  if (to.name === 'Login' && isValid) {
    return firstAllowedRouteForPos(authStore, posStore.hasPos)
  }
})

export default router
