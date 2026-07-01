import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchCartItems, addItemToCart, deleteCartItem, deleteAllCartItems } from '@/services/cartService'
import { getProductSetItem } from '@/services/sellService'
import { generateUUID } from '@/utils/uuid'

export const useCartStore = defineStore('cart', () => {
  const items = ref([])
  const loading = ref(false)
  const setItemsCache = ref({})

  function isSetItem(item) {
    return String(item?.item_type ?? '') === '3'
  }

  function normalizeSetItems(rows = []) {
    return (Array.isArray(rows) ? rows : []).map(row => ({
      item_code: row.item_code,
      item_name: row.item_name,
      unit_code: row.unit_code,
      qty: Number(row.qty) || 0,
      balance_qty: Number(row.balance_qty) || 0,
      price: Number(row.price) || 0,
      sum_amount: Number(row.sum_amount) || 0,
      barcode: row.barcode || '',
      price_ratio: Number(row.price_ratio) || 0,
      stand_value: Number(row.stand_value) || 1,
      divide_value: Number(row.divide_value) || 1,
    }))
  }

  function cacheSetItems(item_code, rows = []) {
    if (!item_code) return []
    const normalized = normalizeSetItems(rows)
    setItemsCache.value = {
      ...setItemsCache.value,
      [item_code]: normalized,
    }
    return normalized
  }

  async function fetchSetItems(item_code, { force = false } = {}) {
    if (!item_code) return []
    if (!force && setItemsCache.value[item_code]) return setItemsCache.value[item_code]
    const rows = await getProductSetItem(item_code)
    return cacheSetItems(item_code, rows)
  }

  async function hydrateSetItems(targetItems = items.value) {
    const setRows = (Array.isArray(targetItems) ? targetItems : []).filter(isSetItem)
    await Promise.all(setRows.map(row => fetchSetItems(row.item_code).catch(() => [])))
    setRows.forEach(row => {
      row.sub_item = setItemsCache.value[row.item_code] || row.sub_item || []
    })
  }

  async function fetchCart(cart_key) {
    loading.value = true
    try {
      items.value = await fetchCartItems(cart_key)
      await hydrateSetItems(items.value)
    } finally {
      loading.value = false
    }
  }

  function qtyInCart(item_code, unit_code) {
    const row = items.value.find(i => i.item_code === item_code && i.unit_code === unit_code)
    return row ? Number(row.qty) : 0
  }

  function guidInCart(item_code, unit_code) {
    const row = items.value.find(i => i.item_code === item_code && i.unit_code === unit_code)
    return row?.guid_code ?? null
  }

  // สต็อกหน่วยฐานที่จองในตะกร้า (รวมทุก unit ของ item นี้)
  function totalCartBaseUnits(item_code) {
    return items.value
      .filter(i => i.item_code === item_code)
      .reduce((sum, i) => sum + Number(i.qty) * Number(i.ratio), 0)
  }

  async function addItem({
    cart_key, emp_code, item_code, item_name, unit_code,
    barcode = '', qty, price, item_type = '0',
    wh_code = '', shelf_code = '',
    stand_value = 1, divide_value = 1, ratio = 1,
    remark = '', sub_item = [],
  }) {
    if (String(item_type) === '3' && sub_item.length > 0) {
      cacheSetItems(item_code, sub_item)
    }

    const existingQty = qtyInCart(item_code, unit_code)
    const guid_code = guidInCart(item_code, unit_code) ?? generateUUID()
    const newQty = existingQty + qty

    await addItemToCart([{
      cust_code: cart_key,
      emp_code,
      guid_code,
      item_code,
      item_name,
      unit_code,
      barcode,
      qty: newQty,
      price,
      item_type,
      wh_code,
      shelf_code,
      stand_value,
      divide_value,
      ratio,
      remark,
      sub_item: String(item_type) === '3' ? (setItemsCache.value[item_code] || sub_item || []) : [],
    }])

    await fetchCart(cart_key)
  }

  async function updateItemQty(item, newQty, cart_key) {
    if (newQty <= 0) {
      await deleteCartItem(item.guid_code, cart_key)
    } else {
      await addItemToCart([{
        cust_code: cart_key,
        emp_code: item.creator_code,
        guid_code: item.guid_code,
        item_code: item.item_code,
        item_name: item.item_name,
        unit_code: item.unit_code,
        barcode: item.barcode || '',
        qty: newQty,
        price: item.price,
        item_type: item.item_type,
        wh_code: item.wh_code || '',
        shelf_code: item.shelf_code || '',
        stand_value: item.stand_value,
        divide_value: item.divide_value,
        ratio: item.ratio,
        remark: item.remark || '',
        sub_item: isSetItem(item) ? (item.sub_item || setItemsCache.value[item.item_code] || []) : [],
      }])
    }
    await fetchCart(cart_key)
  }

  async function updateItemRemark(item, remark, cart_key) {
    await addItemToCart([{
      cust_code: cart_key,
      emp_code: item.creator_code,
      guid_code: item.guid_code,
      item_code: item.item_code,
      item_name: item.item_name,
      unit_code: item.unit_code,
      barcode: item.barcode || '',
      qty: item.qty,
      price: item.price,
      item_type: item.item_type,
      wh_code: item.wh_code || '',
      shelf_code: item.shelf_code || '',
      stand_value: item.stand_value,
      divide_value: item.divide_value,
      ratio: item.ratio,
      remark,
      sub_item: isSetItem(item) ? (item.sub_item || setItemsCache.value[item.item_code] || []) : [],
    }])
    await fetchCart(cart_key)
  }

  async function clearCart(cart_key) {
    await deleteAllCartItems(cart_key)
    items.value = []
  }

  function clearLocalCart() {
    items.value = []
  }

  return {
    items, loading, setItemsCache,
    fetchCart, clearLocalCart, clearCart,
    qtyInCart, guidInCart, totalCartBaseUnits,
    isSetItem, cacheSetItems, fetchSetItems, hydrateSetItems,
    addItem, updateItemQty, updateItemRemark,
  }
})
