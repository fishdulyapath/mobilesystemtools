<script setup>
import { ref, watch, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { getProductByBarcode, getProductLevelList, getProductList, getProductPrice, getProductSetDetail } from '@/services/sellService'
import { formatCurrency } from '@/utils/formatters'
import { useCartStore } from '@/stores/cart'
import { useToast } from 'primevue/usetoast'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import ProductDetailSheet from './ProductDetailSheet.vue'
import { productImageUrl } from '@/utils/imageUrls'

function imageUrl(item_code) {
  return productImageUrl(item_code)
}

function onImgError(e) {
  e.target.style.display = 'none'
  e.target.nextElementSibling?.style.setProperty('display', 'flex')
}

function isSetProduct(product) {
  return String(product?.item_type ?? '') === '3'
}

const props = defineProps({
  basket: { type: Object, required: true },
})
const emit = defineEmits(['back', 'go-cart', 'go-setup'])

const toast = useToast()
const cartStore = useCartStore()
const cartKey = computed(() => `BASKET-${props.basket.basket_id}`)
const custCode = computed(() => props.basket.cust_code || '')

const search = ref('')
const activeCategory = ref('')
const activeLevel2 = ref('')
const showOnlyInStock = ref(true)
let searchTimer = null
let suppressNextSearchReload = false
let searchRunId = 0
let listGeneration = 0

const categories = ref([])
const level2Categories = computed(() => {
  if (!activeCategory.value || activeCategory.value === 'promo') return []
  const found = categories.value.find(cat => cat.level_1 === activeCategory.value)
  return found ? (found.level_2_list || []).filter(level => level && level.trim()) : []
})
const showLevel2Categories = computed(() => level2Categories.value.length > 0)

async function loadCategories() {
  try { categories.value = await getProductLevelList() } catch { categories.value = [] }
}

const LIMIT = 30
const products = ref([])
const prices = ref({})
const loadingProducts = ref(false)
const noMore = ref(false)
const offset = ref(0)

function resetList() {
  listGeneration += 1
  products.value = []
  prices.value = {}
  offset.value = 0
  noMore.value = false
  loadingProducts.value = false
}

async function loadBatch() {
  if (loadingProducts.value || noMore.value) return
  const generation = listGeneration
  loadingProducts.value = true
  try {
    const batch = await getProductList({
      cust_code: custCode.value,
      level_1: activeCategory.value === 'promo' ? '' : activeCategory.value,
      level_2: activeCategory.value === 'promo' ? '' : activeLevel2.value,
      isstock: showOnlyInStock.value ? '1' : '',
      ispromotion: activeCategory.value === 'promo' ? '1' : '',
      exclude_hold_sale: '1',
      search: search.value.trim(),
      offset: offset.value,
      limit: LIMIT,
    })
    if (generation !== listGeneration) return
    products.value.push(...batch)
    offset.value += batch.length
    if (batch.length < LIMIT) noMore.value = true
    fetchPricesForBatch(batch)
  } catch {
    if (generation === listGeneration) noMore.value = true
  } finally {
    if (generation === listGeneration) loadingProducts.value = false
  }
}

function isBarcodeCandidate(value) {
  const q = value.trim()
  return q.length >= 6 && !/\s/.test(q)
}

function isSoldOut(product) {
  return String(product?.sold_out ?? '') === '1'
}

function setStockFilter(onlyInStock) {
  if (showOnlyInStock.value === onlyInStock) return
  showOnlyInStock.value = onlyInStock
}

function selectCategory(code) {
  if (activeCategory.value === code) return
  activeCategory.value = code
  activeLevel2.value = ''
}

function selectLevel2(code) {
  activeLevel2.value = code
}

async function loadBarcodeResult(barcode, { open = false } = {}) {
  const result = await getProductByBarcode(barcode, { exclude_hold_sale: '1' })
  if (!result) return false
  resetList()
  if (showOnlyInStock.value && isSoldOut(result)) {
    noMore.value = true
    toast.add({
      severity: 'warn',
      summary: 'สินค้านี้ไม่มีสต๊อก',
      detail: 'กด "ทั้งหมด" เพื่อแสดงสินค้าที่ไม่มีสต๊อก',
      life: 2500,
    })
    return true
  }
  products.value = [result]
  noMore.value = true
  fetchPricesForBatch([result])
  if (open) await openDetail(result)
  return true
}

async function runSearch({ openBarcodeResult = false } = {}) {
  const runId = ++searchRunId
  const q = search.value.trim()

  if (q && isBarcodeCandidate(q)) {
    try {
      const foundByBarcode = await loadBarcodeResult(q, { open: openBarcodeResult })
      if (runId !== searchRunId) return
      if (foundByBarcode) return
    } catch {
      if (runId !== searchRunId) return
    }
  }

  if (runId !== searchRunId) return
  resetList()
  await loadBatch()
}

async function clearSearch({ reload = true } = {}) {
  if (!search.value) return
  clearTimeout(searchTimer)
  searchRunId += 1
  suppressNextSearchReload = true
  search.value = ''
  if (reload) {
    resetList()
    await loadBatch()
  }
}

function fetchPricesForBatch(batch) {
  const priceOpts = {
    sale_type: props.basket.inquiry_type,
    vat_type: props.basket.vat_type,
    vat_rate: props.basket.vat_rate,
  }
  batch.forEach(p => {
    if (prices.value[p.item_code] !== undefined) return
    prices.value[p.item_code] = { price: null, loading: true }
    const priceRequest = isSetProduct(p)
      ? getProductSetDetail(p.item_code, custCode.value, priceOpts).then(rows => {
        const unitCode = p.start_sale_unit || p.unit_standard || p.unit_cost
        return (rows || []).find(row => row.unit_code === unitCode) || rows?.[0] || null
      })
      : getProductPrice(p.item_code, p.start_sale_unit || p.unit_cost || p.unit_standard, custCode.value, '1', priceOpts)

    priceRequest
      .then(result => {
        prices.value[p.item_code] = { price: result?.price ?? null, loading: false }
      })
      .catch(() => {
        prices.value[p.item_code] = { price: null, loading: false }
      })
  })
}

const sentinel = ref(null)
const productArea = ref(null)
let observer = null

function initObserver() {
  observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) loadBatch()
  }, { rootMargin: '120px', root: productArea.value })
  if (sentinel.value) observer.observe(sentinel.value)
}

onMounted(async () => {
  await Promise.all([loadCategories(), cartStore.fetchCart(cartKey.value)])
  await loadBatch()
  initObserver()
})

onBeforeUnmount(() => observer?.disconnect())

function reloadProducts() {
  clearTimeout(searchTimer)
  searchRunId += 1
  resetList()
  loadBatch()
}

watch([activeCategory, activeLevel2], reloadProducts)
watch(showOnlyInStock, reloadProducts)

watch(search, () => {
  clearTimeout(searchTimer)
  if (suppressNextSearchReload) {
    suppressNextSearchReload = false
    return
  }
  searchTimer = setTimeout(() => { runSearch() }, 1500)
})

const basketInitial = computed(() =>
  (props.basket.cust_name || props.basket.cust_code || '?').charAt(0).toUpperCase()
)

// ─── Detail sheet ────────────────────────────────────────────────────
const showDetail = ref(false)
const detailProduct = ref(null)

async function openDetail(p) {
  if (showDetail.value) {
    showDetail.value = false
    await nextTick()
  }
  detailProduct.value = p
  showDetail.value = true
  await clearSearch({ reload: false })
}
</script>

<template>
  <div class="catalog-step">

    <!-- ─── sticky top bar: basket info + search ─────────────────── -->
    <div class="catalog-header">
      <div class="customer-badge">
        <Button icon="pi pi-arrow-left" text rounded size="small" @click="emit('back')" aria-label="กลับ" />
        <div class="cust-avatar">{{ basketInitial }}</div>
        <div class="basket-info">
          <span class="cust-name">{{ basket.cust_name || 'ลูกค้าทั่วไป' }}</span>
          <span class="basket-tag">#{{ basket.basket_id }}</span>
        </div>
        <Button
          label="แก้ไขตะกร้า"
          icon="pi pi-pencil"
          text
          size="small"
          @click="emit('go-setup')"
        />
        <Button
          icon="pi pi-shopping-cart"
          text
          rounded
          size="small"
          aria-label="ตะกร้า"
          :badge="cartStore.items.length > 0 ? String(cartStore.items.length) : undefined"
          badge-severity="contrast"
          @click="emit('go-cart')"
        />
      </div>

      <!-- mobile: horizontal category tabs -->
      <div class="category-tabs mobile-cats">
        <button class="cat-tab" :class="{ active: activeCategory === '' }" @click="selectCategory('')">ทั้งหมด</button>
        <button class="cat-tab" :class="{ active: activeCategory === 'promo' }" @click="selectCategory('promo')">
          <i class="pi pi-tag" /> โปรโมชั่น
        </button>
        <button
          v-for="cat in categories"
          :key="cat.level_1"
          class="cat-tab"
          :class="{ active: activeCategory === cat.level_1 }"
          @click="selectCategory(cat.level_1)"
        >{{ cat.level_1 }}</button>
      </div>

      <div v-if="showLevel2Categories" class="category-tabs subcategory-tabs mobile-cats">
        <button class="cat-tab sub-cat-tab" :class="{ active: activeLevel2 === '' }" @click="selectLevel2('')">ทั้งหมด</button>
        <button
          v-for="cat in level2Categories"
          :key="cat"
          class="cat-tab sub-cat-tab"
          :class="{ active: activeLevel2 === cat }"
          @click="selectLevel2(cat)"
        >{{ cat }}</button>
      </div>

      <div class="filter-row">
        <div class="search-wrap">
          <i class="pi pi-search search-icon" />
          <InputText
            v-model="search"
            placeholder="ค้นหาสินค้า / บาร์โค้ด"
            class="search-input"
            @keyup.enter="runSearch({ openBarcodeResult: true })"
          />
          <Button
            v-if="search"
            icon="pi pi-times"
            text
            rounded
            size="small"
            class="clear-search-button"
            aria-label="ล้างคำค้นหา"
            title="ล้างคำค้นหา"
            @click="clearSearch()"
          />
        </div>
        <div class="stock-toggle" role="group" aria-label="ตัวกรองสต๊อกสินค้า">
          <button
            type="button"
            class="stock-option"
            :class="{ active: showOnlyInStock }"
            @click="setStockFilter(true)"
          >
            <i class="pi pi-check-circle" />
            <span>มีสต๊อก</span>
          </button>
          <button
            type="button"
            class="stock-option"
            :class="{ active: !showOnlyInStock }"
            @click="setStockFilter(false)"
          >
            <i class="pi pi-list" />
            <span>ทั้งหมด</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ─── body: sidebar (desktop) + product area ────────────── -->
    <div class="catalog-body">

      <!-- desktop: vertical category sidebar -->
      <aside class="category-sidebar desktop-cats">
        <button class="side-tab" :class="{ active: activeCategory === '' }" @click="selectCategory('')">
          <i class="pi pi-th-large" />
          <span>ทั้งหมด</span>
        </button>
        <button class="side-tab" :class="{ active: activeCategory === 'promo' }" @click="selectCategory('promo')">
          <i class="pi pi-tag" />
          <span>โปรโมชั่น</span>
        </button>
        <template v-for="cat in categories" :key="cat.level_1">
          <button
            class="side-tab"
            :class="{ active: activeCategory === cat.level_1 }"
            @click="selectCategory(cat.level_1)"
          >
            <i class="pi pi-folder" />
            <span>{{ cat.level_1 }}</span>
          </button>
          <div v-if="activeCategory === cat.level_1 && level2Categories.length > 0" class="side-sub-tabs">
            <button class="side-sub-tab" :class="{ active: activeLevel2 === '' }" @click="selectLevel2('')">ทั้งหมด</button>
            <button
              v-for="sub in level2Categories"
              :key="sub"
              class="side-sub-tab"
              :class="{ active: activeLevel2 === sub }"
              @click="selectLevel2(sub)"
            >{{ sub }}</button>
          </div>
        </template>
      </aside>

      <!-- product area -->
      <div ref="productArea" class="product-area">
        <div class="product-grid">
          <div
            v-for="p in products"
            :key="p.item_code"
            class="product-card"
            @click="openDetail(p)"
          >
            <div class="card-image">
              <img :src="imageUrl(p.item_code)" :alt="p.item_name" class="product-img" @error="onImgError" />
              <i class="pi pi-box image-placeholder" style="display:none" />
              <span v-if="p.is_promotion == 1" class="promo-badge"><i class="pi pi-tag" /> โปร</span>
              <span v-if="isSetProduct(p)" class="set-badge"><i class="pi pi-list" /> ชุด</span>
              <span v-if="!showOnlyInStock && isSoldOut(p)" class="sold-out-badge">หมด</span>
            </div>
            <div class="card-body">
              <span class="card-name">{{ p.item_name }}</span>
              <div class="card-footer">
                <span class="card-price">
                  <Skeleton v-if="!prices[p.item_code] || prices[p.item_code].loading" width="4rem" height="1rem" />
                  <template v-else>{{ formatCurrency(prices[p.item_code].price ?? 0) }}</template>
                </span>
              </div>
            </div>
          </div>

          <template v-if="loadingProducts && products.length === 0">
            <div v-for="n in 12" :key="`sk-${n}`" class="product-card skeleton-card">
              <Skeleton height="7rem" />
              <div class="card-body">
                <Skeleton width="80%" height="0.875rem" />
                <Skeleton width="50%" height="0.75rem" class="mt-1" />
              </div>
            </div>
          </template>
        </div>

        <div v-if="loadingProducts && products.length > 0" class="load-more-indicator">
          <i class="pi pi-spin pi-spinner" />
        </div>
        <div v-if="noMore && products.length > 0" class="end-msg">แสดง {{ products.length }} รายการ</div>
        <div v-if="noMore && products.length === 0 && !loadingProducts" class="empty-state">
          <i class="pi pi-search empty-icon" />
          <span>ไม่พบสินค้า</span>
        </div>

        <div ref="sentinel" class="sentinel" />
      </div>
    </div>

    <!-- ─── Detail sheet (dialog) ────────────────────────────────── -->
    <ProductDetailSheet
      v-if="detailProduct"
      :visible="showDetail"
      :product="detailProduct"
      :basket="basket"
      @update:visible="showDetail = $event"
    />

  </div>
</template>

<style scoped>
.catalog-step {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ─── fixed header ────────────────────────────────────────────── */
.catalog-header {
  flex-shrink: 0;
  z-index: 10;
  background:
    radial-gradient(circle at 12% 0%, rgba(14, 165, 233, 0.12), transparent 24rem),
    linear-gradient(180deg, #ffffff 0%, #f4fbff 100%);
  border-bottom: 1px solid var(--app-blue-line, #c7e7fa);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  box-shadow: 0 8px 22px rgba(2, 132, 199, 0.07);
}

.customer-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.cust-avatar {
  width: 1.875rem;
  height: 1.875rem;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--p-primary-color), #0ea5e9);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8125rem;
  font-weight: 700;
  flex-shrink: 0;
}

.basket-info {
  display: flex;
  align-items: baseline;
  gap: 0.375rem;
  flex: 1;
  min-width: 0;
}

.cust-name {
  font-size: 0.9375rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.basket-tag {
  font-size: 0.75rem;
  color: var(--p-text-color-secondary);
  flex-shrink: 0;
}

.cart-count-badge {
  background: linear-gradient(135deg, var(--p-primary-color), #0ea5e9);
  color: #fff;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  min-width: 1.25rem;
  height: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.3rem;
  flex-shrink: 0;
}

/* ─── mobile category tabs ───────────────────────────────────── */
.mobile-cats {
  display: flex;
  gap: 0.375rem;
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: 2px;
}

.mobile-cats::-webkit-scrollbar { display: none; }

.subcategory-tabs {
  margin-top: -0.35rem;
  padding-top: 0.1rem;
}

.cat-tab {
  flex-shrink: 0;
  padding: 0.3125rem 0.875rem;
  border-radius: 999px;
  border: 1px solid var(--app-blue-line, #c7e7fa);
  background: #ffffff;
  font-size: 0.8125rem;
  cursor: pointer;
  color: var(--p-text-color-secondary);
  transition: background 0.12s, color 0.12s, border-color 0.12s;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.cat-tab.active {
  background: linear-gradient(135deg, var(--p-primary-color), #0ea5e9);
  color: #fff;
  border-color: var(--p-primary-color);
  box-shadow: 0 8px 18px rgba(2, 120, 184, 0.16);
}

.sub-cat-tab {
  padding-inline: 0.75rem;
  border-style: dashed;
  font-size: 0.76rem;
}

/* ─── search row ─────────────────────────────────────────────── */
.filter-row {
  display: flex;
  gap: 0.625rem;
  align-items: center;
  flex-wrap: wrap;
}

.search-wrap {
  flex: 1 1 18rem;
  position: relative;
  min-width: 0;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--p-text-color-secondary);
  font-size: 0.875rem;
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding-left: 2.25rem !important;
  padding-right: 2.25rem !important;
}

.clear-search-button {
  position: absolute;
  right: 0.25rem;
  top: 50%;
  transform: translateY(-50%);
  width: 1.8rem;
  height: 1.8rem;
  color: var(--p-text-color-secondary);
}

.stock-toggle {
  display: grid;
  grid-template-columns: repeat(2, minmax(5.5rem, 1fr));
  gap: 0.25rem;
  padding: 0.25rem;
  border: 1px solid var(--app-blue-line, #c7e7fa);
  border-radius: 8px;
  background: var(--app-blue-soft, #eaf7ff);
  flex: 0 0 auto;
}

.stock-option {
  min-height: 2.25rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--p-text-color-secondary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 600;
  padding: 0 0.75rem;
  white-space: nowrap;
  transition: background 0.12s, color 0.12s, box-shadow 0.12s;
}

.stock-option:hover {
  color: var(--p-primary-color);
}

.stock-option.active {
  background: var(--p-surface-0, #ffffff);
  color: var(--p-primary-color);
  box-shadow: 0 4px 12px rgba(2, 132, 199, 0.13);
}

@media (max-width: 520px) {
  .stock-toggle {
    width: 100%;
  }
}

/* ─── body layout ────────────────────────────────────────────── */
.catalog-body {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

/* ─── desktop category sidebar ───────────────────────────────── */
.desktop-cats {
  display: none;
}

@media (min-width: 768px) {
  .mobile-cats { display: none; }

  .desktop-cats {
    display: flex;
    flex-direction: column;
    width: 180px;
    flex-shrink: 0;
    overflow-y: auto;
    padding: 0.75rem 0.5rem;
    border-right: 1px solid var(--app-blue-line, #c7e7fa);
    background: linear-gradient(180deg, #ffffff 0%, #f7fcff 100%);
    gap: 0.125rem;
    scrollbar-width: thin;
  }
}

.side-tab {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  border: none;
  background: transparent;
  font-size: 0.8125rem;
  cursor: pointer;
  color: var(--p-text-color-secondary);
  text-align: left;
  width: 100%;
  transition: background 0.12s, color 0.12s, box-shadow 0.12s;
}

.side-tab:hover {
  background: var(--app-blue-soft, #eaf7ff);
  color: var(--p-primary-color);
}

.side-tab.active {
  background: linear-gradient(135deg, var(--p-primary-color), #0ea5e9);
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 8px 18px rgba(2, 120, 184, 0.16);
}

.side-tab i {
  font-size: 0.875rem;
  flex-shrink: 0;
}

.side-tab span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.side-sub-tabs {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  margin: -0.05rem 0 0.25rem 1.4rem;
  padding-left: 0.45rem;
  border-left: 2px solid var(--app-blue-line, #c7e7fa);
}

.side-sub-tab {
  width: 100%;
  min-height: 1.8rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--p-text-color-secondary);
  cursor: pointer;
  font-size: 0.74rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.side-sub-tab:hover {
  background: var(--app-blue-soft, #eaf7ff);
  color: var(--p-primary-color);
}

.side-sub-tab.active {
  background: rgba(14, 165, 233, 0.12);
  color: var(--p-primary-color);
}

/* ─── product area ───────────────────────────────────────────── */
.product-area {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
}

@media (max-width: 767px) {
  .product-area {
    padding-bottom: calc(60px + env(safe-area-inset-bottom) + 0.75rem);
  }
}

/* ─── product grid ───────────────────────────────────────────── */
.product-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  padding: 1rem;
}

@media (min-width: 480px) {
  .product-grid { grid-template-columns: repeat(3, 1fr); }
}

@media (min-width: 900px) {
  .product-grid { grid-template-columns: repeat(4, 1fr); }
}

/* ─── product card ───────────────────────────────────────────── */
.product-card {
  border-radius: 8px;
  border: 1px solid var(--app-blue-line, #c7e7fa);
  background: #ffffff;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.12s, border-color 0.15s;
  min-height: 140px;
  box-shadow: var(--app-shadow-subtle, 0 8px 22px rgba(2, 132, 199, 0.08));
}

.product-card:hover {
  border-color: var(--p-primary-color);
  box-shadow: var(--app-shadow-card, 0 14px 34px rgba(2, 132, 199, 0.13));
  transform: translateY(-2px);
}

.card-image {
  height: 7rem;
  background:
    linear-gradient(180deg, #f2faff 0%, #ffffff 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.product-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 0.375rem;
}

.image-placeholder {
  font-size: 2.5rem;
  color: var(--p-surface-400);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.promo-badge {
  position: absolute;
  top: 0.375rem;
  left: 0.375rem;
  background: rgba(2, 120, 184, 0.9);
  color: #fff;
  font-size: 0.625rem;
  font-weight: 700;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 0.2rem;
}

.set-badge {
  position: absolute;
  top: 0.375rem;
  left: 0.375rem;
  background: rgba(14, 165, 233, 0.9);
  color: #fff;
  font-size: 0.625rem;
  font-weight: 700;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 0.2rem;
}

.promo-badge + .set-badge {
  top: 1.8rem;
}

.sold-out-badge {
  position: absolute;
  right: 0.375rem;
  top: 0.375rem;
  background: rgba(100, 116, 139, 0.92);
  color: #fff;
  font-size: 0.625rem;
  font-weight: 700;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
}

.card-body {
  padding: 0.5rem 0.625rem;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  flex: 1;
}

.card-name {
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
}

.card-price {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--p-primary-color);
}

.skeleton-card .card-body { gap: 0.375rem; }
.mt-1 { margin-top: 0.25rem; }

/* ─── load more / end / empty ────────────────────────────────── */
.load-more-indicator {
  display: flex;
  justify-content: center;
  padding: 1.5rem;
  color: var(--p-text-color-secondary);
  font-size: 1.25rem;
}

.end-msg {
  text-align: center;
  padding: 1rem;
  font-size: 0.8125rem;
  color: var(--p-text-color-secondary);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem 1rem;
  color: var(--p-text-color-secondary);
}

.empty-icon {
  font-size: 2.5rem;
  color: var(--p-surface-400);
}

.sentinel { height: 1px; }
</style>
