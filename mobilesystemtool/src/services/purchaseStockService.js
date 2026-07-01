import api from './api'

export async function getPurchaseStockReorderList({
  search = '',
  offset = 0,
  limit = 50,
  sort_field = '',
  sort_order = '',
  only_reorder = false,
} = {}) {
  const { data } = await api.get('/getPurchaseStockReorderList', {
    params: { search, offset, limit, sort_field, sort_order, only_reorder: only_reorder ? 1 : 0 },
  })
  return {
    data: data.data || [],
    totalCount: data.totalCount || 0,
    totalSuggestQty: data.totalSuggestQty || 0,
  }
}
