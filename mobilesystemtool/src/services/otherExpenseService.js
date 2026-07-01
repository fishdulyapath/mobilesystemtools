import api from './api'

export async function getOtherExpenseList({ search = '', fromdate = '', todate = '', limit = 100, user_code = '' } = {}) {
  const { data } = await api.get('/other-expense/list', {
    params: { search, fromdate, todate, limit, user_code },
  })
  return data.data || []
}

export async function getOtherExpenseDetail(doc_no, user_code = '') {
  const { data } = await api.get('/other-expense/detail', { params: { doc_no, user_code } })
  return data.data || null
}

export async function getOtherExpensePrintForms(doc_no, user_code = '') {
  const { data } = await api.get('/other-expense/print-forms', { params: { doc_no, user_code } })
  return data.data || null
}

export function getOtherExpensePrintUrl(doc_no, formcodes = [], user_code = '') {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
  const params = new URLSearchParams({
    doc_no,
    formcodes: formcodes.join(','),
    auto_print: '1',
    log_print: '1',
  })
  if (user_code) params.set('user_code', user_code)
  return `${baseUrl}/other-expense/print/render?${params.toString()}`
}

export async function getOtherExpenseDocFormats({ user_code = '' } = {}) {
  const { data } = await api.get('/other-expense/doc-formats', { params: { user_code } })
  return data.data || []
}

export async function getOtherExpenseWhtDocFormats({ user_code = '' } = {}) {
  const { data } = await api.get('/other-expense/wht-doc-formats', { params: { user_code } })
  return data.data || []
}

export async function getNextOtherExpenseDocNo({ doc_format_code = '', doc_date = '', user_code = '' } = {}) {
  const { data } = await api.get('/other-expense/next-doc-no', {
    params: { doc_format_code, doc_date, user_code },
  })
  return data || null
}

export async function getNextOtherExpenseWhtDocNo({ doc_format_code = '', doc_date = '', user_code = '' } = {}) {
  const { data } = await api.get('/other-expense/next-wht-doc-no', {
    params: { doc_format_code, doc_date, user_code },
  })
  return data || null
}

export async function searchOtherExpenseSuppliers({ search = '', user_code = '' } = {}) {
  const { data } = await api.get('/other-expense/suppliers', { params: { search, user_code } })
  return data.data || []
}

export async function searchExpenseList({ search = '', user_code = '' } = {}) {
  const { data } = await api.get('/other-expense/expense-list', { params: { search, user_code } })
  return data.data || []
}

export async function saveOtherExpense(payload) {
  const { data } = await api.post('/other-expense/save', payload)
  return data
}
