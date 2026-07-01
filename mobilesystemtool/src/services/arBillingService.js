import api from './api'

export async function getArBillingDocFormats({ user_code = '' } = {}) {
  const { data } = await api.get('/ar-billing/doc-formats', { params: { user_code } })
  return data.data || []
}

export async function getNextArBillingDocNo({ doc_format_code = '', doc_date = '', user_code = '' } = {}) {
  const { data } = await api.get('/ar-billing/next-doc-no', {
    params: { doc_format_code, doc_date, user_code },
  })
  return data || null
}

export async function getArBillingList({ search = '', fromdate = '', todate = '', limit = 100, user_code = '' } = {}) {
  const { data } = await api.get('/ar-billing/list', {
    params: { search, fromdate, todate, limit, user_code },
  })
  return data.data || []
}

export async function getArBillingOpenDocs({ cust_code = '', doc_date = '', due_date = '', branch_code = '', search = '', user_code = '' } = {}) {
  const { data } = await api.get('/ar-billing/open-docs', {
    params: { cust_code, doc_date, due_date, branch_code, search, user_code },
  })
  return data.data || []
}

export async function getArBillingSalesUsers({ search = '', user_code = '' } = {}) {
  const { data } = await api.get('/ar-billing/sales-users', {
    params: { search, user_code },
  })
  return data.data || []
}

export async function getArBillingDetail(doc_no, user_code = '') {
  const { data } = await api.get('/ar-billing/detail', { params: { doc_no, user_code } })
  return data.data || null
}

export async function saveArBilling(payload) {
  const { data } = await api.post('/ar-billing/save', {
    ...payload,
    creator_code: payload?.creator_code || payload?.emp_code || '',
  })
  return data
}

export async function getArBillingPrintForms(doc_no, user_code = '') {
  const { data } = await api.get('/ar-billing/print-forms', { params: { doc_no, user_code } })
  return data.data || null
}

export function getArBillingPrintUrl(doc_no, formcodes = [], user_code = '') {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
  const params = new URLSearchParams({ doc_no, formcodes: formcodes.join(','), auto_print: '1', log_print: '1' })
  if (user_code) params.set('user_code', user_code)
  return `${baseUrl}/ar-billing/print/render?${params.toString()}`
}
