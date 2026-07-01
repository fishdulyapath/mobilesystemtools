const thaiDateFormatter = new Intl.DateTimeFormat('th-TH', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

const thaiCurrencyFormatter = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  minimumFractionDigits: 2,
})

const numberFormatter = new Intl.NumberFormat('th-TH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatDate(value) {
  if (!value) return '-'
  return thaiDateFormatter.format(new Date(value))
}

export function formatCurrency(value) {
  if (value == null) return '-'
  return thaiCurrencyFormatter.format(Number(value))
}

export function formatNumber(value) {
  if (value == null) return '-'
  return numberFormatter.format(Number(value))
}

export function todayISO() {
  return toISO(new Date())
}

export function toISO(date) {
  if (!date) return ''
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
