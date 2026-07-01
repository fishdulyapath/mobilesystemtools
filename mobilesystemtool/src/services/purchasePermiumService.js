import api from './api'

// ของแถมซื้อ (Purchase Premium) — master data + calculate engine

export async function getPurchasePremiumList({ search = '', include_inactive = false } = {}) {
  const { data } = await api.get('/purchase-permium/list', {
    params: { search, include_inactive: include_inactive ? '1' : '0' },
  })
  return data.data || []
}

export async function getPurchasePremiumDetail(permiumCode) {
  const { data } = await api.get('/purchase-permium/detail', {
    params: { permium_code: permiumCode },
  })
  return data.data || null
}

export async function savePurchasePremium(payload) {
  const { data } = await api.post('/purchase-permium/save', payload)
  return data
}

export async function deletePurchasePremium(permiumCode) {
  const { data } = await api.post('/purchase-permium/delete', { permium_code: permiumCode })
  return data
}

// คำนวณของแถมจากรายการสินค้าที่จะซื้อ
// items: [{ item_code, unit_code, qty }]
// คืน: [{ permium_code, permium_name, item_code, item_name, unit_code, unit_name, qty, matched_sets }]
export async function calculatePurchasePremium({ doc_date = '', items = [] } = {}) {
  const { data } = await api.post('/purchase-permium/calculate', { doc_date, items })
  return data.data || []
}
