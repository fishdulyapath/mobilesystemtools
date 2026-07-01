import api from './api'

const PROGRAM_CREATOR_CODE = 'mobiletools'

export async function adjustStock(payload) {
  const { data } = await api.post('/adjustStock', { ...payload, creator_code: PROGRAM_CREATOR_CODE })
  return data
}

export async function getWarehouseList() {
  const { data } = await api.get('/getWarehouseList')
  return data.data || []
}

export async function getShelfList(wh_code) {
  const { data } = await api.get('/getShelfList', { params: { wh_code } })
  return data.data || []
}

export async function getInventoryBalance(item_code, wh_code, shelf_code) {
  const { data } = await api.get('/getInventoryBalance', { params: { item_code, wh_code, shelf_code } })
  return Number(data.data?.sum_balance_qty ?? 0)
}
