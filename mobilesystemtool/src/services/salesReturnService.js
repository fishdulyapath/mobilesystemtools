import api from './api'

export async function getSalesReturnReadiness() {
  const { data } = await api.get('/getSalesReturnReadiness')
  return data.data || null
}

export async function getSalesReturnDocFormatList() {
  const { data } = await api.get('/getSalesReturnDocFormatList')
  return data.data || []
}

export async function getNextSalesReturnDocNo({ doc_format_code = '', doc_date = '' } = {}) {
  const { data } = await api.get('/getNextSalesReturnDocNo', {
    params: { doc_format_code, doc_date },
  })
  return data || null
}

export async function getReturnableSaleItems({
  cust_code = '',
  barcode = '',
  item_code = '',
  search = '',
  fromdate = '',
  todate = '',
  limit = 80,
} = {}) {
  const { data } = await api.get('/getReturnableSaleItems', {
    params: { cust_code, barcode, item_code, search, fromdate, todate, limit },
  })
  return data.data || []
}

export async function createSalesReturnDoc(payload) {
  const { data } = await api.post('/createSalesReturnDoc', payload)
  return data
}

export async function getSalesReturnDetail(doc_no) {
  const { data } = await api.get('/getSalesReturnDetail', { params: { doc_no } })
  return data.data || null
}

export async function getSalesReturnPrintForms(doc_no) {
  const { data } = await api.get('/getSalesReturnPrintForms', { params: { doc_no } })
  return data.data || null
}

export function getSalesReturnPrintUrl(doc_no, formcodes = [], user_code = '') {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
  const params = new URLSearchParams({
    doc_no,
    formcodes: formcodes.join(','),
    auto_print: '1',
    log_print: '1',
  })
  if (user_code) params.set('user_code', user_code)
  return `${baseUrl}/sales-return-print/render?${params.toString()}`
}
