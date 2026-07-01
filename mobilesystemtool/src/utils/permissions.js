export const PERMISSIONS = {
  permissionManage: 'permission.manage',
  dashboardSoldOutReport: 'dashboard.sold_out_report',
  dashboardMonthlySummary: 'dashboard.monthly_summary',
  sellView: 'sell.view',
  inventoryView: 'inventory.view',
  inventoryAdjustStock: 'inventory.adjust_stock',
  salesCashView: 'sales.cash.view',
  salesCreditView: 'sales.credit.view',
  salesProductHistoryView: 'sales.product_history.view',
  salesReturnView: 'sales.return.view',
  salesReturnCreate: 'sales.return.create',
  salesReturnPrint: 'sales.return.print',
  salesAdvancePaymentView: 'sales.advance_payment.view',
  salesAdvancePaymentHistoryView: 'sales.advance_payment.history.view',
  salesAdvancePaymentCreate: 'sales.advance_payment.create',
  salesArBillingView: 'sales.ar_billing.view',
  salesArBillingCreate: 'sales.ar_billing.create',
  salesArDebtPaymentView: 'sales.ar_debt_payment.view',
  salesArDebtPaymentHistoryView: 'sales.ar_debt_payment.history.view',
  salesArDebtPaymentCreate: 'sales.ar_debt_payment.create',
  cashOtherExpenseView: 'cash.other_expense.view',
  cashOtherExpenseCreate: 'cash.other_expense.create',
  soldOutView: 'sold_out.view',
  soldOutPurchaseInfoView: 'sold_out.purchase_info.view',
  purchaseStockReorderView: 'purchase.stock_reorder.view',
  purchasePuView: 'purchase.pu.view',
  purchasePuCreate: 'purchase.pu.create',
  purchasePuEdit: 'purchase.pu.edit',
  purchasePuPrint: 'purchase.pu.print',
  purchasePremiumManage: 'purchase.premium.manage',
  productView: 'product.view',
  productImages: 'product.images',
  productImagesEdit: 'product.images.edit',
  productMain: 'product.main',
  productMainEdit: 'product.main.edit',
  productPriceFormula: 'product.price_formula',
  productPriceFormulaEdit: 'product.price_formula.edit',
  productUnits: 'product.units',
  productUnitsEdit: 'product.units.edit',
  productBarcodes: 'product.barcodes',
  productBarcodesEdit: 'product.barcodes.edit',
}

export const ALL_PERMISSION_KEYS = Object.values(PERMISSIONS)

export function can(permissions, key) {
  if (!key) return true
  if (!Array.isArray(permissions)) return true
  return permissions.includes(key)
}

export function canAll(permissions, keys) {
  if (!keys) return true
  const required = Array.isArray(keys) ? keys : [keys]
  if (required.length === 0) return true
  if (!Array.isArray(permissions)) return true
  return required.every((key) => permissions.includes(key))
}
