<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { useCartStore } from '@/stores/cart'
import { validateCartStock } from '@/services/cartService'
import { formatCurrency } from '@/utils/formatters'
import { productImageUrl } from '@/utils/imageUrls'

const props = defineProps({
  basket: { type: Object, required: true },
  documentTypes: { type: Array, default: () => [] },
  selectedDocumentType: { type: Object, required: true },
})
const emit = defineEmits(['back', 'next', 'update:selectedDocumentType'])

const cartStore = useCartStore()
const cartKey = computed(() => `BASKET-${props.basket.basket_id}`)
const confirm = useConfirm()
const toast = useToast()

const updating = ref({})
const clearing = ref(false)
const remarkOpen = ref({})
const stockChecking = ref(false)
const stockIssues = ref([])
const stockCheckError = ref('')
let qtyTimers = {}

const requiresStockCheck = computed(() => props.selectedDocumentType?.requiresStock !== false)
const hasStockIssues = computed(() => stockIssues.value.length > 0)
const canGoNext = computed(() =>
  cartStore.items.length > 0
  && !stockChecking.value
  && (!requiresStockCheck.value || !hasStockIssues.value)
)

const total = computed(() =>
  cartStore.items.reduce((sum, i) => sum + Number(i.qty) * Number(i.price), 0)
)

// เปิด remark ทันทีสำหรับ item ที่มี remark อยู่แล้ว
watch(() => cartStore.items, (items) => {
  items.forEach(i => {
    if (i.remark && !remarkOpen.value[i.guid_code]) {
      remarkOpen.value[i.guid_code] = true
    }
  })
}, { immediate: true })

onMounted(async () => {
  await cartStore.fetchCart(cartKey.value)
  await checkStock({ silent: true })
})

watch(() => props.selectedDocumentType?.key, async () => {
  if (!requiresStockCheck.value) {
    stockIssues.value = []
    stockCheckError.value = ''
    return
  }
  await checkStock({ silent: true })
})

function imageUrl(item_code) {
  return productImageUrl(item_code)
}

function onImgError(e) {
  e.target.style.display = 'none'
  e.target.nextElementSibling?.style.setProperty('display', 'flex')
}

function isSetItem(item) {
  return cartStore.isSetItem(item)
}

function setSubItems(item) {
  return item.sub_item || cartStore.setItemsCache[item.item_code] || []
}

function setChildQty(child, parent) {
  return Number(child.qty || 0) * Number(parent.qty || 0)
}

function stockIssueText(issue) {
  const reserved = Number(issue.reserved_other_qty || 0)
  const reservedText = reserved > 0 ? ` / จองอื่น ${reserved.toLocaleString()}` : ''
  return issue.issue_type === 'out_of_stock'
    ? `หมด (ในตะกร้า ${Number(issue.qty_in_cart || 0).toLocaleString()}${reservedText})`
    : `เกินคงเหลือ ${Number(issue.balance_qty || 0).toLocaleString()} / ในตะกร้า ${Number(issue.qty_in_cart || 0).toLocaleString()}${reservedText}`
}

async function checkStock({ silent = false } = {}) {
  if (!requiresStockCheck.value) {
    stockIssues.value = []
    stockCheckError.value = ''
    return true
  }
  if (cartStore.items.length === 0) {
    stockIssues.value = []
    stockCheckError.value = ''
    return true
  }
  stockChecking.value = true
  stockCheckError.value = ''
  try {
    const result = await validateCartStock(cartKey.value)
    stockIssues.value = Array.isArray(result?.stock_issues) ? result.stock_issues : []
    if (!silent && stockIssues.value.length > 0) {
      toast.add({
        severity: 'warn',
        summary: 'พบสินค้าสต๊อกไม่พอ',
        detail: 'กรุณาปรับจำนวนหรือลบรายการก่อนดำเนินการต่อ',
        life: 3500,
      })
    }
    return stockIssues.value.length === 0
  } catch (ex) {
    stockCheckError.value = ex?.message || 'ตรวจสอบสต๊อกไม่สำเร็จ'
    if (!silent) {
      toast.add({
        severity: 'warn',
        summary: 'ตรวจสอบสต๊อกไม่สำเร็จ',
        detail: 'ยังไม่สามารถไปต่อได้จนกว่าจะตรวจสอบสต๊อกสำเร็จ',
        life: 3500,
      })
    }
    return false
  } finally {
    stockChecking.value = false
  }
}

async function goNext() {
  const stockOk = await checkStock({ silent: false })
  if (!stockOk) return
  emit('next')
}

function selectDocumentType(type) {
  if (!type?.key || type.key === props.selectedDocumentType?.key) return
  emit('update:selectedDocumentType', type.key)
}

function toggleRemark(guid_code) {
  remarkOpen.value[guid_code] = !remarkOpen.value[guid_code]
}

function onQtyInput(item, raw) {
  const val = parseInt(raw)
  if (isNaN(val) || val < 0) return
  clearTimeout(qtyTimers[item.guid_code])
  qtyTimers[item.guid_code] = setTimeout(async () => {
    updating.value[item.guid_code] = true
    try {
      await cartStore.updateItemQty(item, val, cartKey.value)
      await checkStock({ silent: true })
    } finally {
      updating.value[item.guid_code] = false
    }
  }, 400)
}

async function incrementQty(item) {
  updating.value[item.guid_code] = true
  try {
    await cartStore.updateItemQty(item, Number(item.qty) + 1, cartKey.value)
    await checkStock({ silent: true })
  } finally {
    updating.value[item.guid_code] = false
  }
}

async function decrementQty(item) {
  updating.value[item.guid_code] = true
  try {
    await cartStore.updateItemQty(item, Number(item.qty) - 1, cartKey.value)
    await checkStock({ silent: true })
  } finally {
    updating.value[item.guid_code] = false
  }
}

async function removeItem(item) {
  updating.value[item.guid_code] = true
  try {
    await cartStore.updateItemQty(item, 0, cartKey.value)
    await checkStock({ silent: true })
  } finally {
    updating.value[item.guid_code] = false
  }
}

function confirmClearCart() {
  confirm.require({
    message: 'ล้างสินค้าทั้งหมดในตะกร้า?',
    header: 'ยืนยันการล้างตะกร้า',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'ล้าง',
    rejectLabel: 'ยกเลิก',
    acceptClass: 'p-button-danger p-button-sm',
    rejectClass: 'p-button-text p-button-sm',
    accept: async () => {
      clearing.value = true
      try {
        await cartStore.clearCart(cartKey.value)
        stockIssues.value = []
        stockCheckError.value = ''
      } finally {
        clearing.value = false
      }
    },
  })
}

let remarkTimers = {}

function onRemarkBlur(item, value) {
  clearTimeout(remarkTimers[item.guid_code])
  if (value === (item.remark || '')) return
  remarkTimers[item.guid_code] = setTimeout(async () => {
    await cartStore.updateItemRemark(item, value, cartKey.value)
  }, 0)
}
</script>

<template>
  <div class="cart-items-view">
    <div class="cart-header">
      <Button icon="pi pi-arrow-left" text rounded size="small" @click="emit('back')" aria-label="กลับ" />
      <span class="cart-title">ตะกร้า #{{ basket.basket_id }} · {{ basket.cust_name || 'ลูกค้าทั่วไป' }}</span>
    </div>

    <div class="cart-body">
      <div v-if="cartStore.loading" class="empty-hint">กำลังโหลด...</div>

      <div v-else-if="cartStore.items.length === 0" class="empty-hint">
        <i class="pi pi-shopping-cart" style="font-size:2rem;opacity:.3" />
        <div>ไม่มีสินค้าในตะกร้า</div>
      </div>

      <template v-else>
        <div v-if="documentTypes.length > 1" class="document-type-group" role="group" aria-label="ประเภทเอกสาร">
          <button
            v-for="type in documentTypes"
            :key="type.key"
            type="button"
            class="document-type-btn"
            :class="{ 'document-type-active': selectedDocumentType.key === type.key }"
            @click="selectDocumentType(type)"
          >
            <i :class="type.icon" />
            <span>{{ type.label }}</span>
          </button>
        </div>

        <div v-if="requiresStockCheck && stockIssues.length > 0" class="stock-warning-panel">
          <div class="stock-warning-head">
            <i class="pi pi-exclamation-triangle" />
            <div>
              <div class="stock-warning-title">พบสินค้าสต๊อกไม่พอ</div>
              <div class="stock-warning-subtitle">กรุณาปรับจำนวนหรือลบรายการก่อนดำเนินการต่อ</div>
            </div>
          </div>
          <div class="stock-warning-list">
            <div v-for="issue in stockIssues" :key="`${issue.item_code}-${issue.unit_code || ''}`" class="stock-warning-item">
              <span>{{ issue.item_name || issue.item_code }} <small v-if="issue.unit_code">({{ issue.unit_code }})</small></span>
              <strong>{{ stockIssueText(issue) }}</strong>
            </div>
          </div>
        </div>
        <div v-else-if="requiresStockCheck && stockCheckError" class="stock-check-error">
          <i class="pi pi-info-circle" />
          <span>{{ stockCheckError }} กรุณาลองตรวจสอบใหม่ก่อนดำเนินการต่อ</span>
        </div>

        <div v-for="item in cartStore.items" :key="item.guid_code" class="cart-row">
          <!-- บนสุด: รูป + ข้อมูลสินค้า + ปุ่มลบ -->
          <div class="cart-row-top">
            <div class="item-img-wrap">
              <img
                :src="imageUrl(item.item_code)"
                :alt="item.item_name"
                class="item-img"
                @error="onImgError"
              />
              <div class="item-img-placeholder"><i class="pi pi-box" /></div>
            </div>
            <div class="item-info">
              <div class="item-name">{{ item.item_name }}</div>
              <div class="item-meta">
                {{ item.item_code }} · {{ item.unit_code }}
                <span v-if="isSetItem(item)" class="set-chip">ชุด</span>
              </div>
              <div class="item-price">{{ formatCurrency(Number(item.price)) }} / {{ item.unit_code }}</div>
            </div>
            <Button
              icon="pi pi-trash"
              text
              rounded
              severity="danger"
              size="small"
              :loading="updating[item.guid_code]"
              @click="removeItem(item)"
            />
          </div>

          <!-- ควบคุมจำนวน + ยอดย่อย -->
          <div class="cart-row-controls">
            <div class="qty-control">
              <button
                class="qty-btn"
                :disabled="updating[item.guid_code] || Number(item.qty) <= 1"
                @click="decrementQty(item)"
              >
                <i class="pi pi-minus" />
              </button>
              <input
                class="qty-input"
                type="number"
                min="1"
                :value="item.qty"
                :disabled="updating[item.guid_code]"
                @change="e => onQtyInput(item, e.target.value)"
              />
              <button
                class="qty-btn"
                :disabled="updating[item.guid_code]"
                @click="incrementQty(item)"
              >
                <i class="pi pi-plus" />
              </button>
            </div>
            <div class="row-subtotal">{{ formatCurrency(Number(item.qty) * Number(item.price)) }}</div>
          </div>

          <div v-if="isSetItem(item) && setSubItems(item).length > 0" class="set-items">
            <div v-for="child in setSubItems(item)" :key="child.item_code" class="set-child-row">
              <span class="set-child-name">{{ child.item_name }}</span>
              <span class="set-child-qty">{{ setChildQty(child, item).toLocaleString() }} {{ child.unit_code }}</span>
            </div>
          </div>

          <!-- หมายเหตุ: ซ่อนเริ่มต้น -->
          <div class="remark-row">
            <button
              v-if="!remarkOpen[item.guid_code]"
              class="remark-toggle"
              @click="toggleRemark(item.guid_code)"
            >
              <i class="pi pi-plus-circle" />
              เพิ่มหมายเหตุ
            </button>
            <div v-else class="remark-open-row">
              <InputText
                :default-value="item.remark || ''"
                placeholder="หมายเหตุสินค้านี้..."
                class="remark-input"
                size="small"
                @blur="e => onRemarkBlur(item, e.target.value)"
              />
              <button class="remark-close-btn" @click="toggleRemark(item.guid_code)">
                <i class="pi pi-times" />
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>

    <div class="cart-footer">
      <div v-if="cartStore.items.length > 0" class="footer-clear-row">
        <Button
          label="ล้างตะกร้า"
          icon="pi pi-trash"
          text
          severity="danger"
          size="small"
          :loading="clearing"
          @click="confirmClearCart"
        />
      </div>
      <div class="footer-bottom-row">
        <div class="footer-total">
          <span class="total-label">รวม</span>
          <span class="total-value">{{ formatCurrency(total) }}</span>
        </div>
        <Button
          label="ถัดไป"
          icon="pi pi-arrow-right"
          icon-pos="right"
          :disabled="!canGoNext"
          :loading="stockChecking"
          class="next-btn"
          @click="goNext"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.cart-items-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
}

.cart-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--app-blue-line, #c7e7fa);
  flex-shrink: 0;
  background:
    radial-gradient(circle at 8% 0%, rgba(14, 165, 233, 0.12), transparent 22rem),
    linear-gradient(180deg, #ffffff 0%, #f5fbff 100%);
}

.cart-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--app-blue-ink, #075985);
}

.cart-body {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: linear-gradient(180deg, #fbfdff 0%, #f3faff 100%);
}

.empty-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  height: 100%;
  color: var(--p-text-color-secondary);
  font-size: 0.9rem;
}

.stock-warning-panel,
.stock-check-error {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.7rem 0.8rem;
  border: 1px solid #fbbf24;
  border-radius: 8px;
  background: #fffbeb;
  color: #92400e;
}

.document-type-group {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.4rem;
  padding: 0.55rem;
  border: 1px solid var(--app-blue-line, #c7e7fa);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.84);
  box-shadow: var(--app-shadow-subtle, 0 8px 22px rgba(2, 132, 199, 0.08));
}

.document-type-btn {
  min-height: 2.35rem;
  border: 1px solid var(--app-blue-line, #c7e7fa);
  border-radius: 8px;
  background: var(--p-surface-0, #fff);
  color: var(--p-text-color-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  font-family: inherit;
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0.45rem 0.5rem;
}

.document-type-btn:hover {
  border-color: var(--p-primary-color);
  color: var(--p-primary-color);
}

.document-type-active {
  border-color: var(--p-primary-color);
  background: linear-gradient(135deg, var(--p-primary-color), #0ea5e9);
  color: #ffffff;
  box-shadow: 0 8px 18px rgba(2, 120, 184, 0.16);
}

.stock-check-error {
  flex-direction: row;
  align-items: center;
}

.stock-warning-head {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
}

.stock-warning-head .pi,
.stock-check-error .pi {
  margin-top: 0.1rem;
  color: #d97706;
}

.stock-warning-title {
  font-size: 0.86rem;
  font-weight: 700;
}

.stock-warning-subtitle {
  margin-top: 0.1rem;
  font-size: 0.76rem;
}

.stock-warning-list {
  display: grid;
  gap: 0.35rem;
}

.stock-warning-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.75rem;
  align-items: center;
  font-size: 0.78rem;
}

.stock-warning-item span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stock-warning-item strong {
  font-weight: 700;
  white-space: nowrap;
}

.cart-row {
  border: 1px solid var(--app-blue-line, #c7e7fa);
  border-radius: 8px;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: #ffffff;
  box-shadow: var(--app-shadow-subtle, 0 8px 22px rgba(2, 132, 199, 0.08));
}

/* ─── row top: รูป + ข้อมูล + ลบ ─── */
.cart-row-top {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
}

.item-img-wrap {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  border: 1px solid var(--app-blue-line, #c7e7fa);
  background: linear-gradient(180deg, #f2faff 0%, #ffffff 100%);
  flex-shrink: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.item-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 3px;
}

.item-img-placeholder {
  display: none;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 1.25rem;
  color: var(--p-surface-400);
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-name {
  font-weight: 600;
  font-size: 0.875rem;
  line-height: 1.3;
}

.item-meta {
  font-size: 0.72rem;
  color: var(--p-text-color-secondary);
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.set-chip {
  display: inline-flex;
  align-items: center;
  height: 1.1rem;
  padding: 0 0.35rem;
  border-radius: 4px;
  background: #dff3ff;
  color: #075985;
  font-size: 0.68rem;
  font-weight: 700;
}

.item-price {
  font-size: 0.78rem;
  color: var(--p-primary-color);
  margin-top: 2px;
}

/* ─── qty controls ─── */
.cart-row-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.qty-control {
  display: flex;
  align-items: center;
  border: 1px solid var(--app-blue-line, #c7e7fa);
  border-radius: 8px;
  overflow: hidden;
  background: #ffffff;
}

.qty-btn {
  width: 2rem;
  height: 2rem;
  border: none;
  background: var(--app-blue-soft, #eaf7ff);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: var(--p-text-color);
  transition: background 0.1s;
}

.qty-btn:hover:not(:disabled) {
  background: #dff3ff;
  color: var(--p-primary-color);
}

.qty-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.qty-input {
  width: 3.5rem;
  height: 2rem;
  border: none;
  border-left: 1px solid var(--app-blue-line, #c7e7fa);
  border-right: 1px solid var(--app-blue-line, #c7e7fa);
  text-align: center;
  font-size: 0.875rem;
  font-family: inherit;
  background: transparent;
  color: var(--p-text-color);
  outline: none;
  padding: 0;
}

.qty-input::-webkit-outer-spin-button,
.qty-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
}

.row-subtotal {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--p-primary-color);
  margin-left: auto;
}

.set-items {
  display: grid;
  gap: 0.35rem;
  padding: 0.55rem 0.65rem;
  background: #f5fbff;
  border: 1px solid var(--app-blue-line, #c7e7fa);
  border-radius: 8px;
}

.set-child-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.78rem;
}

.set-child-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--p-text-color-secondary);
}

.set-child-qty {
  font-weight: 700;
  color: var(--p-primary-color);
}

/* ─── remark ─── */
.remark-row {
  display: flex;
}

.remark-toggle {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  border: none;
  background: none;
  padding: 0.15rem 0;
  font-size: 0.78rem;
  color: var(--p-text-color-secondary);
  cursor: pointer;
  font-family: inherit;
}

.remark-toggle:hover {
  color: var(--p-primary-color);
}

.remark-toggle .pi {
  font-size: 0.72rem;
}

.remark-open-row {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  width: 100%;
}

.remark-input {
  flex: 1;
  font-size: 0.8rem !important;
}

.remark-close-btn {
  flex-shrink: 0;
  width: 1.75rem;
  height: 1.75rem;
  border: none;
  background: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--p-text-color-secondary);
  font-size: 0.75rem;
  border-radius: 50%;
}

.remark-close-btn:hover {
  background: var(--app-blue-soft, #eaf7ff);
  color: var(--p-primary-color);
}

/* ─── footer ─── */
.cart-footer {
  padding: 0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom));
  border-top: 1px solid var(--app-blue-line, #c7e7fa);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.94);
  position: sticky;
  bottom: 0;
  z-index: 5;
  box-shadow: 0 -10px 24px rgba(2, 132, 199, 0.08);
}

.footer-clear-row {
  display: flex;
  border-bottom: 1px solid var(--app-blue-line, #c7e7fa);
  padding-bottom: 0.25rem;
}

.footer-bottom-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding-top: 0.25rem;
}

.footer-total {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.total-label {
  font-size: 0.75rem;
  color: var(--p-text-color-secondary);
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.total-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--p-primary-color);
}

.next-btn {
  margin-left: auto;
}
</style>
