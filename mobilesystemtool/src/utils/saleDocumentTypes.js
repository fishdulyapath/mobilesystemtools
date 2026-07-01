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
    docFormatCode: 'SO',
    requiresStock: true,
    requiresPayment: false,
  },
  reserve_order: {
    key: 'reserve_order',
    label: 'สั่งซื้อ-สั่งจอง',
    icon: 'pi pi-bookmark',
    transFlag: 34,
    screenCode: 'SR',
    docFormatCode: 'BS',
    requiresStock: false,
    requiresPayment: false,
  },
}

const DEFAULT_ENABLED_TYPES = 'sale,sale_order,reserve_order'

export function getSaleDocumentType(key) {
  return DOCUMENT_TYPE_MAP[key] || DOCUMENT_TYPE_MAP.sale
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
