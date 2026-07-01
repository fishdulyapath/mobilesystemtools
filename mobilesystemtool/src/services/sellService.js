import api from './api'

const PROGRAM_CREATOR_CODE = 'smlstaff'
import { productImageGuidUrl, productImageUrl } from '@/utils/imageUrls'

export function getProductImageUrl(item_code) {
  return productImageUrl(item_code)
}

export function getProductImageGuidUrl(guid_code) {
  return productImageGuidUrl(guid_code)
}

export async function getCustomerList(search = '') {
  const { data } = await api.get('/getCustomerList', { params: { search } })
  return data.data || []
}

export async function getCustomerCredit(cust_code = '', doc_date = '') {
  const { data } = await api.get('/getCustomerCredit', { params: { cust_code, doc_date } })
  return data.data || null
}

export async function getCategoryList() {
  const { data } = await api.get('/getCategoryList')
  return data.data || []
}

export async function getProductList({
  cust_code = '',
  category = '',
  search = '',
  isstock = '',
  ispromotion = '',
  exclude_hold_sale = '',
  exclude_hold_purchase = '',
  offset = 0,
  limit = 30,
} = {}) {
  const { data } = await api.get('/getProductList', {
    params: { cust_code, category, search, isstock, ispromotion, exclude_hold_sale, exclude_hold_purchase, offset, limit },
  })
  return data.data || []
}

// doc_date จงใจไม่ส่งจาก frontend — ใช้ server time เป็นแหล่งความจริง
// (กันผู้ใช้แก้นาฬิกาในเครื่องแล้วได้ราคาย้อนหลัง)
export async function getProductPrice(item_code, unit_code, cust_code = '', qty = '1', opts = {}) {
  console.log('getProductPrice', { item_code, unit_code, cust_code, qty, opts })
  const params = { item_code, unit_code, qty, cust_code }
  if (opts.sale_type !== undefined && opts.sale_type !== null && opts.sale_type !== '') params.sale_type = opts.sale_type
  if (opts.vat_type !== undefined && opts.vat_type !== null && opts.vat_type !== '') params.vat_type = opts.vat_type
  if (opts.vat_rate !== undefined && opts.vat_rate !== null && opts.vat_rate !== '') params.vat_rate = opts.vat_rate
  const { data } = await api.get('/getProductPrice', { params })
  return data.data?.[0] || null
}

export async function getProductDetail(item_code, cust_code = '', opts = {}) {
  const params = { item_code, cust_code, show_promotion: '1' }
  if (opts.sale_type !== undefined && opts.sale_type !== null && opts.sale_type !== '') params.sale_type = opts.sale_type
  if (opts.vat_type !== undefined && opts.vat_type !== null && opts.vat_type !== '') params.vat_type = opts.vat_type
  if (opts.vat_rate !== undefined && opts.vat_rate !== null && opts.vat_rate !== '') params.vat_rate = opts.vat_rate
  const { data } = await api.get('/getProductDetail', { params })
  return data.data || []
}

export async function getProductSetDetail(item_code, cust_code = '', opts = {}) {
  const params = { item_code, cust_code }
  if (opts.sale_type !== undefined && opts.sale_type !== null && opts.sale_type !== '') params.sale_type = opts.sale_type
  if (opts.vat_type !== undefined && opts.vat_type !== null && opts.vat_type !== '') params.vat_type = opts.vat_type
  if (opts.vat_rate !== undefined && opts.vat_rate !== null && opts.vat_rate !== '') params.vat_rate = opts.vat_rate
  const { data } = await api.get('/getProductSetDetail', { params })
  return data.data || []
}

export async function getProductSetItem(item_code) {
  const { data } = await api.get('/getProductSetItem', { params: { item_code } })
  return data.data || []
}

export async function getProductImageList(item_code) {
  const { data } = await api.get('/getImageList', {
    params: { item_code },
  })
  return data.data || []
}

export async function getPassBookList() {
  const { data } = await api.get('/getPassBookList')
  return data.data || []
}

export async function getCreditTypeList() {
  const { data } = await api.get('/getCreditTypeList')
  return data.data || []
}

export async function getSaleAdvanceDepositBalance(cust_code = '') {
  const { data } = await api.get('/getSaleAdvanceDepositBalance', { params: { cust_code } })
  return data.data || { balance_amount: 0, rows: [] }
}

export async function saveTrans(body) {
  const { data } = await api.post('/saveTrans', { ...body, creator_code: PROGRAM_CREATOR_CODE })
  return data
}

export async function getReceiptDetail(doc_no) {
  const { data } = await api.get('/getReceiptDetail', { params: { doc_no } })
  return data.data || null
}

export async function getProductByBarcode(barcode, opts = {}) {
  const params = { barcode }
  if (opts.exclude_hold_sale !== undefined && opts.exclude_hold_sale !== null && opts.exclude_hold_sale !== '') {
    params.exclude_hold_sale = opts.exclude_hold_sale
  }
  if (opts.exclude_hold_purchase !== undefined && opts.exclude_hold_purchase !== null && opts.exclude_hold_purchase !== '') {
    params.exclude_hold_purchase = opts.exclude_hold_purchase
  }
  const { data } = await api.get('/getProductByBarcode', { params })
  return data.data || null
}
