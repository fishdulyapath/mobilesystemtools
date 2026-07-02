const DOCUMENT_TYPE_MAP = {
  sale: {
    key: 'sale',
    label: 'ขาย',
    icon: 'pi pi-receipt',
    transFlag: 44,
    screenCode: 'SI',
    docFormatCode: '',
    requiresStock: true,
    requiresPayment: true,
  },
  sale_order: {
    key: 'sale_order',
    label: 'สั่งขาย',
    icon: 'pi pi-file-edit',
    transFlag: 36,
    screenCode: 'SS',
    docFormatCode: '',
    requiresStock: true,
    requiresPayment: false,
  },
  reserve_order: {
    key: 'reserve_order',
    label: 'สั่งซื้อ-สั่งจอง',
    icon: 'pi pi-bookmark',
    transFlag: 34,
    screenCode: 'SR',
    docFormatCode: '',
    requiresStock: false,
    requiresPayment: false,
  },
}

const DOCUMENT_TYPE_BY_SCREEN_CODE = {
  SI: DOCUMENT_TYPE_MAP.sale,
  SS: DOCUMENT_TYPE_MAP.sale_order,
  SR: DOCUMENT_TYPE_MAP.reserve_order,
  SO: DOCUMENT_TYPE_MAP.sale_order,
  BS: DOCUMENT_TYPE_MAP.reserve_order,
}

const DEFAULT_ENABLED_TYPES = 'sale,sale_order,reserve_order'

export function getSaleDocumentType(key) {
  return DOCUMENT_TYPE_MAP[key] || DOCUMENT_TYPE_MAP.sale
}

export function getSaleDocumentTypeFromBasket(basket = {}) {
  const explicit = DOCUMENT_TYPE_MAP[basket.document_type]
  if (explicit) return explicit

  const screenCode = String(basket.document_screen_code || basket.doc_format_screen_code || '').trim().toUpperCase()
  if (DOCUMENT_TYPE_BY_SCREEN_CODE[screenCode]) return DOCUMENT_TYPE_BY_SCREEN_CODE[screenCode]

  const docFormatCode = String(basket.doc_format_code || '').trim().toUpperCase()
  return Object.values(DOCUMENT_TYPE_MAP).find((type) => type.docFormatCode && type.docFormatCode === docFormatCode) || DOCUMENT_TYPE_MAP.sale
}

export function getEnabledSaleDocumentTypes() {
  const keys = String(import.meta.env.VITE_SALE_DOCUMENT_TYPES || DEFAULT_ENABLED_TYPES)
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean)

  const types = keys
    .map((key) => DOCUMENT_TYPE_MAP[key])
    .filter(Boolean)

  return types.length ? types : [DOCUMENT_TYPE_MAP.sale]
}
