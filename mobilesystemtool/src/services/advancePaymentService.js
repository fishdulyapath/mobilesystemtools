import api from './api'

export async function getAdvancePaymentDocFormats({ user_code = '' } = {}) {
  const { data } = await api.get('/advance-payment/doc-formats', { params: { user_code } })
  return data.data || []
}

export async function getNextAdvancePaymentDocNo({ doc_format_code = '', doc_date = '', user_code = '' } = {}) {
  const { data } = await api.get('/advance-payment/next-doc-no', {
    params: { doc_format_code, doc_date, user_code },
  })
  return data || null
}

export async function getAdvancePaymentList({ search = '', fromdate = '', todate = '', limit = 100, user_code = '' } = {}) {
  const { data } = await api.get('/advance-payment/list', {
    params: { search, fromdate, todate, limit, user_code },
  })
  return data.data || []
}

export async function getAdvancePaymentDetail(doc_no, user_code = '') {
  const { data } = await api.get('/advance-payment/detail', { params: { doc_no, user_code } })
  return data.data || null
}

export async function getAdvancePaymentPrintForms(doc_no, user_code = '') {
  const { data } = await api.get('/advance-payment/print-forms', { params: { doc_no, user_code } })
  return data.data || null
}

export function getAdvancePaymentPrintUrl(doc_no, formcodes = [], user_code = '') {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
  const params = new URLSearchParams({
    doc_no,
    formcodes: formcodes.join(','),
    auto_print: '1',
    log_print: '1',
  })
  if (user_code) params.set('user_code', user_code)
  return `${baseUrl}/advance-payment/print/render?${params.toString()}`
}

export async function saveAdvancePayment(payload) {
  const { data } = await api.post('/advance-payment/save', {
    ...payload,
    creator_code: payload?.creator_code || payload?.emp_code || '',
  })
  return data
}

export async function getAdvancePaymentCustomerBalance(cust_code, user_code = '') {
  const { data } = await api.get('/advance-payment/customer-balance', { params: { cust_code, user_code } })
  return data.data || null
}
