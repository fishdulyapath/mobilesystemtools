import { PERMISSIONS } from '@/utils/permissions'
import { getEnabledSaleDocumentTypePermissions } from '@/utils/saleDocumentTypes'

export const SCREEN_IDS = {
  dashboard: 'dashboard',
  sell: 'sell',
  purchasePu: 'purchase-pu',
  salesReturn: 'sales-return',
  salesAdvancePayment: 'sales-advance-payment',
  salesArBilling: 'sales-ar-billing',
  salesArDebtPayment: 'sales-ar-debt-payment',
  cashOtherExpense: 'cash-other-expense',
  salesHistory: 'sales-history',
  reserveOrderHistory: 'reserve-order-history',
  saleOrderHistory: 'sale-order-history',
  salesProductHistory: 'sales-product-history',
  soldOut: 'sold-out',
  purchaseStockReorder: 'purchase-stock-reorder',
  salesAdvancePaymentHistory: 'sales-advance-payment-history',
  salesArBillingHistory: 'sales-ar-billing-history',
  salesArDebtPaymentHistory: 'sales-ar-debt-payment-history',
  cashOtherExpenseHistory: 'cash-other-expense-history',
  inventory: 'inventory',
  products: 'products',
  permissions: 'permissions',
}

const DEFAULT_ENABLED_SCREENS = [
  SCREEN_IDS.sell,
  SCREEN_IDS.salesHistory,
  SCREEN_IDS.reserveOrderHistory,
  SCREEN_IDS.saleOrderHistory,
  SCREEN_IDS.inventory,
  SCREEN_IDS.permissions,
]

const ENV_SCREEN_ALIASES = {
  all: 'all',
  '*': 'all',
  dashboard: SCREEN_IDS.dashboard,
  home: SCREEN_IDS.dashboard,
  dashboardview: SCREEN_IDS.dashboard,
  'dashboard-view': SCREEN_IDS.dashboard,
  sell: SCREEN_IDS.sell,
  sale: SCREEN_IDS.sell,
  sales: SCREEN_IDS.sell,
  cart: SCREEN_IDS.sell,
  basket: SCREEN_IDS.sell,
  purchase: SCREEN_IDS.purchasePu,
  pu: SCREEN_IDS.purchasePu,
  purchasepu: SCREEN_IDS.purchasePu,
  'purchase-pu': SCREEN_IDS.purchasePu,
  'purchase/pu': SCREEN_IDS.purchasePu,
  buy: SCREEN_IDS.purchasePu,
  'purchase-debt': SCREEN_IDS.purchasePu,
  return: SCREEN_IDS.salesReturn,
  'sale-return': SCREEN_IDS.salesReturn,
  'sales-return': SCREEN_IDS.salesReturn,
  'sales/return': SCREEN_IDS.salesReturn,
  advance: SCREEN_IDS.salesAdvancePayment,
  'advance-payment': SCREEN_IDS.salesAdvancePayment,
  'sales-advance-payment': SCREEN_IDS.salesAdvancePayment,
  'sales/advance-payment': SCREEN_IDS.salesAdvancePayment,
  billing: SCREEN_IDS.salesArBilling,
  'ar-billing': SCREEN_IDS.salesArBilling,
  'sales-ar-billing': SCREEN_IDS.salesArBilling,
  'sales/ar-billing': SCREEN_IDS.salesArBilling,
  receipt: SCREEN_IDS.salesArDebtPayment,
  'debt-payment': SCREEN_IDS.salesArDebtPayment,
  'ar-debt-payment': SCREEN_IDS.salesArDebtPayment,
  'sales-ar-debt-payment': SCREEN_IDS.salesArDebtPayment,
  'sales/ar-debt-payment': SCREEN_IDS.salesArDebtPayment,
  expense: SCREEN_IDS.cashOtherExpense,
  'other-expense': SCREEN_IDS.cashOtherExpense,
  'cash-other-expense': SCREEN_IDS.cashOtherExpense,
  'cash/other-expense': SCREEN_IDS.cashOtherExpense,
  'sales-history': SCREEN_IDS.salesHistory,
  history: SCREEN_IDS.salesHistory,
  'sale-history': SCREEN_IDS.salesHistory,
  'cash-history': SCREEN_IDS.salesHistory,
  'credit-history': SCREEN_IDS.salesHistory,
  'sales-history-cash': SCREEN_IDS.salesHistory,
  'sales-history-credit': SCREEN_IDS.salesHistory,
  'sales-history/cash': SCREEN_IDS.salesHistory,
  'sales-history/credit': SCREEN_IDS.salesHistory,
  'reserve-order': SCREEN_IDS.reserveOrderHistory,
  'reserve-history': SCREEN_IDS.reserveOrderHistory,
  'reserve-order-history': SCREEN_IDS.reserveOrderHistory,
  'sales-history/reserve-order': SCREEN_IDS.reserveOrderHistory,
  'sale-order': SCREEN_IDS.saleOrderHistory,
  'sale-order-history': SCREEN_IDS.saleOrderHistory,
  'sales-order-history': SCREEN_IDS.saleOrderHistory,
  'sales-history/sale-order': SCREEN_IDS.saleOrderHistory,
  'by-product': SCREEN_IDS.salesProductHistory,
  'product-history': SCREEN_IDS.salesProductHistory,
  'product-sale-history': SCREEN_IDS.salesProductHistory,
  'sales-product-history': SCREEN_IDS.salesProductHistory,
  'sales-history-by-product': SCREEN_IDS.salesProductHistory,
  'sales-history/by-product': SCREEN_IDS.salesProductHistory,
  soldout: SCREEN_IDS.soldOut,
  'sold-out': SCREEN_IDS.soldOut,
  'sold-out-products': SCREEN_IDS.soldOut,
  'stock-reorder': SCREEN_IDS.purchaseStockReorder,
  'purchase-stock-reorder': SCREEN_IDS.purchaseStockReorder,
  'purchase/stock-reorder': SCREEN_IDS.purchaseStockReorder,
  'advance-history': SCREEN_IDS.salesAdvancePaymentHistory,
  'advance-payment-history': SCREEN_IDS.salesAdvancePaymentHistory,
  'sales-advance-payment-history': SCREEN_IDS.salesAdvancePaymentHistory,
  'sales/advance-payment/history': SCREEN_IDS.salesAdvancePaymentHistory,
  'billing-history': SCREEN_IDS.salesArBillingHistory,
  'ar-billing-history': SCREEN_IDS.salesArBillingHistory,
  'sales-ar-billing-history': SCREEN_IDS.salesArBillingHistory,
  'sales/ar-billing/history': SCREEN_IDS.salesArBillingHistory,
  'receipt-history': SCREEN_IDS.salesArDebtPaymentHistory,
  'debt-payment-history': SCREEN_IDS.salesArDebtPaymentHistory,
  'ar-debt-payment-history': SCREEN_IDS.salesArDebtPaymentHistory,
  'sales-ar-debt-payment-history': SCREEN_IDS.salesArDebtPaymentHistory,
  'sales/ar-debt-payment/history': SCREEN_IDS.salesArDebtPaymentHistory,
  'expense-history': SCREEN_IDS.cashOtherExpenseHistory,
  'other-expense-history': SCREEN_IDS.cashOtherExpenseHistory,
  'cash-other-expense-history': SCREEN_IDS.cashOtherExpenseHistory,
  'cash/other-expense/history': SCREEN_IDS.cashOtherExpenseHistory,
  inventory: SCREEN_IDS.inventory,
  stock: SCREEN_IDS.inventory,
  warehouse: SCREEN_IDS.inventory,
  product: SCREEN_IDS.products,
  products: SCREEN_IDS.products,
  productmanage: SCREEN_IDS.products,
  'product-manage': SCREEN_IDS.products,
  permission: SCREEN_IDS.permissions,
  permissions: SCREEN_IDS.permissions,
  'user-permission': SCREEN_IDS.permissions,
  'user-permissions': SCREEN_IDS.permissions,
}

export const APP_MENU_GROUPS = [
  {
    title: 'ภาพรวม',
    items: [
      {
        id: SCREEN_IDS.dashboard,
        label: 'แดชบอร์ด',
        icon: 'pi pi-home',
        to: '/dashboard',
        routeName: 'Dashboard',
        permission: PERMISSIONS.dashboardView,
        permissionKeys: [
          PERMISSIONS.dashboardView,
          PERMISSIONS.dashboardSoldOutReport,
          PERMISSIONS.dashboardMonthlySummary,
        ],
      },
    ],
  },
  {
    title: 'ธุรกรรม',
    items: [
      {
        id: SCREEN_IDS.sell,
        label: 'ตะกร้าสินค้า',
        icon: 'pi pi-shopping-cart',
        to: '/sell',
        routeName: 'Sell',
        permission: PERMISSIONS.sellView,
        permissionKeys: [PERMISSIONS.sellView, ...getEnabledSaleDocumentTypePermissions()],
      },
      {
        id: SCREEN_IDS.purchasePu,
        label: 'ซื้อ/ตั้งหนี้',
        icon: 'pi pi-file-import',
        to: '/purchase/pu',
        base: '/purchase/pu',
        routeName: 'PurchasePU',
        permission: PERMISSIONS.purchasePuView,
        permissionKeys: [
          PERMISSIONS.purchasePuView,
          PERMISSIONS.purchasePuCreate,
          PERMISSIONS.purchasePuEdit,
          PERMISSIONS.purchasePuPrint,
        ],
      },
      {
        id: SCREEN_IDS.salesReturn,
        label: 'รับคืนสินค้า/ลดหนี้',
        icon: 'pi pi-undo',
        to: '/sales/return',
        routeName: 'SalesReturn',
        permission: PERMISSIONS.salesReturnView,
        permissionKeys: [
          PERMISSIONS.salesReturnView,
          PERMISSIONS.salesReturnCreate,
          PERMISSIONS.salesReturnPrint,
        ],
      },
      {
        id: SCREEN_IDS.salesAdvancePayment,
        label: 'รับเงินล่วงหน้า',
        icon: 'pi pi-wallet',
        to: '/sales/advance-payment',
        routeName: 'AdvancePayment',
        permission: PERMISSIONS.salesAdvancePaymentView,
        permissionKeys: [PERMISSIONS.salesAdvancePaymentView, PERMISSIONS.salesAdvancePaymentCreate],
      },
      {
        id: SCREEN_IDS.salesArBilling,
        label: 'ใบวางบิล (ลูกหนี้)',
        icon: 'pi pi-file-check',
        to: '/sales/ar-billing',
        routeName: 'ArBilling',
        permission: PERMISSIONS.salesArBillingView,
        permissionKeys: [PERMISSIONS.salesArBillingView, PERMISSIONS.salesArBillingCreate],
      },
      {
        id: SCREEN_IDS.salesArDebtPayment,
        label: 'รับชำระหนี้/ใบเสร็จ',
        icon: 'pi pi-receipt',
        to: '/sales/ar-debt-payment',
        routeName: 'ArDebtPayment',
        permission: PERMISSIONS.salesArDebtPaymentView,
        permissionKeys: [PERMISSIONS.salesArDebtPaymentView, PERMISSIONS.salesArDebtPaymentCreate],
      },
      {
        id: SCREEN_IDS.cashOtherExpense,
        label: 'ค่าใช้จ่ายอื่นๆ',
        icon: 'pi pi-receipt',
        to: '/cash/other-expense',
        routeName: 'OtherExpense',
        permission: PERMISSIONS.cashOtherExpenseCreate,
      },
    ],
  },
  {
    title: 'ประวัติ',
    items: [
      {
        id: SCREEN_IDS.salesHistory,
        label: 'ประวัติการขาย',
        icon: 'pi pi-receipt',
        to: '/sales-history',
        routeName: 'SalesHistory',
        anyPermissions: [PERMISSIONS.salesCashView, PERMISSIONS.salesCreditView],
        permissionKeys: [PERMISSIONS.salesCashView, PERMISSIONS.salesCreditView],
      },
      {
        id: SCREEN_IDS.reserveOrderHistory,
        label: 'ประวัติใบสั่งซื้อ-สั่งจอง',
        icon: 'pi pi-bookmark',
        to: '/sales-history/reserve-order',
        routeName: 'ReserveOrderHistory',
        permission: PERMISSIONS.salesReserveOrderHistoryView,
      },
      {
        id: SCREEN_IDS.saleOrderHistory,
        label: 'ประวัติใบสั่งขาย',
        icon: 'pi pi-file-edit',
        to: '/sales-history/sale-order',
        routeName: 'SaleOrderHistory',
        permission: PERMISSIONS.salesSaleOrderHistoryView,
      },
      {
        id: SCREEN_IDS.salesAdvancePaymentHistory,
        label: 'ประวัติรับเงินล่วงหน้า',
        icon: 'pi pi-history',
        to: '/sales/advance-payment/history',
        routeName: 'AdvancePaymentHistory',
        permission: PERMISSIONS.salesAdvancePaymentHistoryView,
      },
      {
        id: SCREEN_IDS.salesArBillingHistory,
        label: 'ประวัติใบวางบิล',
        icon: 'pi pi-list',
        to: '/sales/ar-billing/history',
        routeName: 'ArBillingHistory',
        permission: PERMISSIONS.salesArBillingView,
      },
      {
        id: SCREEN_IDS.salesArDebtPaymentHistory,
        label: 'ประวัติรับชำระหนี้',
        icon: 'pi pi-history',
        to: '/sales/ar-debt-payment/history',
        routeName: 'ArDebtPaymentHistory',
        permission: PERMISSIONS.salesArDebtPaymentHistoryView,
      },
      {
        id: SCREEN_IDS.cashOtherExpenseHistory,
        label: 'ประวัติค่าใช้จ่ายอื่นๆ',
        icon: 'pi pi-receipt',
        to: '/cash/other-expense/history',
        routeName: 'OtherExpenseHistory',
        permission: PERMISSIONS.cashOtherExpenseView,
      },
    ],
  },
  {
    title: 'รายงาน',
    items: [
      {
        id: SCREEN_IDS.salesProductHistory,
        label: 'รายงานขายตามสินค้า',
        icon: 'pi pi-list',
        to: '/sales-history/by-product',
        routeName: 'ProductSaleHistory',
        permission: PERMISSIONS.salesProductHistoryView,
      },
      {
        id: SCREEN_IDS.soldOut,
        label: 'สินค้าขายหมด',
        icon: 'pi pi-exclamation-circle',
        to: '/sold-out',
        routeName: 'SoldOut',
        permission: PERMISSIONS.soldOutView,
        permissionKeys: [PERMISSIONS.soldOutView, PERMISSIONS.soldOutPurchaseInfoView],
      },
      {
        id: SCREEN_IDS.purchaseStockReorder,
        label: 'สต๊อกสินค้าเพื่อสั่งซื้อ',
        icon: 'pi pi-list-check',
        to: '/purchase/stock-reorder',
        routeName: 'PurchaseStockReorder',
        permission: PERMISSIONS.purchaseStockReorderView,
      },
    ],
  },
  {
    title: 'จัดการคลัง',
    items: [
      {
        id: SCREEN_IDS.inventory,
        label: 'จัดการคลัง',
        icon: 'pi pi-box',
        to: '/inventory',
        routeName: 'Inventory',
        permission: PERMISSIONS.inventoryView,
        permissionKeys: [PERMISSIONS.inventoryView, PERMISSIONS.inventoryAdjustStock],
      },
      {
        id: SCREEN_IDS.products,
        label: 'จัดการสินค้า',
        icon: 'pi pi-tag',
        to: '/products',
        base: '/products',
        routeName: 'ProductManage',
        permission: PERMISSIONS.productView,
        permissionKeys: [
          PERMISSIONS.productView,
          PERMISSIONS.productImages,
          PERMISSIONS.productImagesEdit,
          PERMISSIONS.productMain,
          PERMISSIONS.productMainEdit,
          PERMISSIONS.productPriceFormula,
          PERMISSIONS.productPriceFormulaEdit,
          PERMISSIONS.productUnits,
          PERMISSIONS.productUnitsEdit,
          PERMISSIONS.productBarcodes,
          PERMISSIONS.productBarcodesEdit,
        ],
      },
    ],
  },
  {
    title: 'ระบบ',
    items: [
      {
        id: SCREEN_IDS.permissions,
        label: 'กำหนดสิทธิ์',
        icon: 'pi pi-lock',
        to: '/permissions',
        routeName: 'PermissionManage',
        permission: PERMISSIONS.permissionManage,
      },
    ],
  },
]

export function getEnabledScreenIds() {
  const raw = String(import.meta.env.VITE_ENABLED_SCREENS || '').trim()
  if (!raw) return new Set(DEFAULT_ENABLED_SCREENS)

  const values = raw
    .split(',')
    .map((value) => {
      const key = value.trim().replace(/^\/+/, '').toLowerCase()
      return ENV_SCREEN_ALIASES[key] || key
    })
    .filter(Boolean)

  if (values.includes('all')) {
    return new Set(APP_MENU_GROUPS.flatMap((group) => group.items.map((item) => item.id)))
  }
  return new Set(values)
}

export function isScreenEnabled(screenId) {
  if (!screenId) return true
  return getEnabledScreenIds().has(screenId)
}

export function getEnabledMenuGroups() {
  const enabled = getEnabledScreenIds()
  return APP_MENU_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => enabled.has(item.id)),
    }))
    .filter((group) => group.items.length > 0)
}

export function getEnabledPermissionKeys() {
  const keys = []
  for (const group of getEnabledMenuGroups()) {
    for (const item of group.items) {
      keys.push(...(item.permissionKeys || item.anyPermissions || [item.permission]).filter(Boolean))
    }
  }
  return Array.from(new Set(keys))
}

export function getEnabledPermissionGroups() {
  return getEnabledMenuGroups().map((group) => ({
    key: group.title,
    title: group.title,
    items: group.items.map((item) => ({
      key: item.id,
      title: item.label,
      icon: item.icon,
      permissionKeys: (item.permissionKeys || item.anyPermissions || [item.permission]).filter(Boolean),
    })),
  }))
}

export function getEnabledRouteCandidates() {
  return getEnabledMenuGroups().flatMap((group) => group.items.filter((item) => item.routeName))
}
