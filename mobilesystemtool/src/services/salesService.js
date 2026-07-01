import api from './api'

export async function getDashboardTopProducts(date = '') {
  const { data } = await api.get('/getDashboardTopProducts', { params: date ? { date } : {} })
  return data.data || []
}

export async function getDashboardTopCustomers() {
  const { data } = await api.get('/getDashboardTopCustomers')
  return data.data || []
}

export async function getDashboardTopSalesmen() {
  const { data } = await api.get('/getDashboardTopSalesmen')
  return data.data || []
}

export async function getDashboardSoldOut(filters = '') {
  const params = typeof filters === 'string'
    ? (filters ? { date: filters } : {})
    : {
        from_date: filters?.from_date || '',
        to_date: filters?.to_date || '',
        user_code: filters?.user_code || '',
      }
  const { data } = await api.get('/getDashboardSoldOut', { params })
  return data.data || []
}

export async function getDocSaleHistory({ search = '', from_date = '', to_date = '', sale_kind = '' } = {}) {
  const { data } = await api.get('/getDocSaleHistory', {
    params: { search, from_date, to_date, sale_kind },
  })
  return data.data || []
}

export async function getProductSaleHistory({ search = '', from_date = '', to_date = '', item_code = '' } = {}) {
  const { data } = await api.get('/getProductSaleHistory', {
    params: { search, from_date, to_date, item_code },
  })
  return data.data || []
}

export async function getDocSaleHistoryDetail(doc_no) {
  const { data } = await api.get('/getDocSaleHistoryDetail', { params: { doc_no } })
  return data.data || null
}

export async function getSalePrintForms(doc_no) {
  const { data } = await api.get('/getSalePrintForms', { params: { doc_no } })
  return data.data || null
}

export function getSalePrintUrl(doc_no, formcodes = [], user_code = '') {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
  const params = new URLSearchParams({
    doc_no,
    formcodes: formcodes.join(','),
    auto_print: '1',
    log_print: '1',
  })
  if (user_code) params.set('user_code', user_code)
  return `${baseUrl}/sale-print/render?${params.toString()}`
}
