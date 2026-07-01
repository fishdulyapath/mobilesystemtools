import api from './api'

export async function getArDebtPaymentDocFormats({ user_code = '' } = {}) {
  const { data } = await api.get('/ar-debt-payment/doc-formats', { params: { user_code } })
  return data.data || []
}

export async function getNextArDebtPaymentDocNo({ doc_format_code = '', doc_date = '', user_code = '' } = {}) {
  const { data } = await api.get('/ar-debt-payment/next-doc-no', {
    params: { doc_format_code, doc_date, user_code },
  })
  return data || null
}

export async function getArDebtPaymentList({ search = '', fromdate = '', todate = '', limit = 100, user_code = '' } = {}) {
  const { data } = await api.get('/ar-debt-payment/list', {
    params: { search, fromdate, todate, limit, user_code },
  })
  return data.data || []
}

export async function getArDebtPaymentOpenBillings({
  cust_code = '',
  doc_date = '',
  due_date = '',
  branch_code = '',
  search = '',
  source_mode = '',
  exclude_keys = [],
  user_code = '',
} = {}) {
  const { data } = await api.get('/ar-debt-payment/open-billings', {
    params: {
      cust_code,
      doc_date,
      due_date,
      branch_code,
      search,
      source_mode,
      exclude_keys: Array.isArray(exclude_keys) ? exclude_keys.join(',') : exclude_keys,
      user_code,
    },
  })
  const rows = data.data || []
  rows.source_mode = data.source_mode || rows[0]?.source_mode || 'billing_note'
  return rows
}

export async function getArDebtPaymentSalesUsers({ search = '', user_code = '' } = {}) {
  const { data } = await api.get('/ar-debt-payment/sales-users', {
    params: { search, user_code },
  })
  return data.data || []
}

export async function getArDebtPaymentBillingDetail({
  cust_code = '',
  doc_nos = [],
  doc_date = '',
  due_date = '',
  branch_code = '',
  exclude_keys = [],
  user_code = '',
} = {}) {
  const { data } = await api.get('/ar-debt-payment/billing-detail', {
    params: {
      cust_code,
      doc_nos: doc_nos.join(','),
      doc_date,
      due_date,
      branch_code,
      exclude_keys: Array.isArray(exclude_keys) ? exclude_keys.join(',') : exclude_keys,
      user_code,
    },
  })
  return data.data || []
}

export async function getArDebtPaymentAdvanceBalance({ cust_code = '', user_code = '' } = {}) {
  const { data } = await api.get('/ar-debt-payment/advance-balance', {
    params: { cust_code, user_code },
  })
  return data.data || []
}

export async function getArDebtPaymentIncomeList({ search = '', user_code = '' } = {}) {
  const { data } = await api.get('/ar-debt-payment/income-list', {
    params: { search, user_code },
  })
  return data.data || []
}

export async function getArDebtPaymentExpenseList({ search = '', user_code = '' } = {}) {
  const { data } = await api.get('/ar-debt-payment/expense-list', {
    params: { search, user_code },
  })
  return data.data || []
}

export async function getArDebtPaymentDetail(doc_no, user_code = '') {
  const { data } = await api.get('/ar-debt-payment/detail', { params: { doc_no, user_code } })
  return data.data || null
}

export async function getArDebtPaymentPrintForms(doc_no, user_code = '') {
  const { data } = await api.get('/ar-debt-payment/print-forms', { params: { doc_no, user_code } })
  return data.data || null
}

export function getArDebtPaymentPrintUrl(doc_no, formcodes = [], user_code = '') {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
  const params = new URLSearchParams({
    doc_no,
    formcodes: formcodes.join(','),
    auto_print: '1',
    log_print: '1',
  })
  if (user_code) params.set('user_code', user_code)
  return `${baseUrl}/ar-debt-payment/print/render?${params.toString()}`
}

export async function saveArDebtPayment(payload) {
  const { data } = await api.post('/ar-debt-payment/save', {
    ...payload,
    creator_code: payload?.creator_code || payload?.emp_code || '',
  })
  return data
}
