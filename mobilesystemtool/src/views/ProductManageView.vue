<script setup>
import { createProductItemMain, getProductImageUrl, getProductManageList, getUnitManageList } from '@/services/productManageService'
import { getShelfList, getWarehouseList } from '@/services/inventoryService'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { useToast } from 'primevue/usetoast'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePosStore } from '@/stores/pos'
import { scrollReportToTop } from '@/utils/pageScroll'
import { PERMISSIONS } from '@/utils/permissions'

const router = useRouter()
const toast  = useToast()
const authStore = useAuthStore()
const posStore = usePosStore()

const searchText = ref('')
const products   = ref([])
const isLoading  = ref(false)
const pageSize   = ref(20)
const pageOffset = ref(0)
const totalCount = ref(0)
const sortField  = ref('')
const sortOrder  = ref(0)
const isMobile   = ref(false)
const unitOptions = ref([])
const warehouseOptions = ref([])
const shelfOptions = ref([])
const showCreateDialog = ref(false)
const isCreating = ref(false)
const createWarehouseShelves = ref([])
const isLoadingCreateWarehouseShelves = ref(false)
const createForm = ref({
  code: '',
  name_1: '',
  unit_standard: '',
  unit_cost: '',
  wh_code: '',
  shelf_code: '',
  item_category: '',
  purchase_point: 0,
  minimum_qty: 0,
  maximum_qty: 0,
})

const MOBILE_BREAKPOINT = 768
const PRODUCT_CODE_PATTERN = /^[A-Z0-9_-]+$/
const SEARCH_STATE_KEY = 'productManageSearchState'
let mobileMediaQuery = null
let shelfLoadSeq = 0

function saveSearchState() {
  sessionStorage.setItem(SEARCH_STATE_KEY, JSON.stringify({
    searchText: searchText.value,
    pageOffset: pageOffset.value,
    pageSize: pageSize.value,
    sortField: sortField.value,
    sortOrder: sortOrder.value,
  }))
}

function restoreSearchState() {
  try {
    const saved = sessionStorage.getItem(SEARCH_STATE_KEY)
    if (!saved) return false
    const s = JSON.parse(saved)
    searchText.value = s.searchText ?? ''
    pageOffset.value = s.pageOffset ?? 0
    pageSize.value   = s.pageSize ?? 20
    sortField.value  = s.sortField ?? ''
    sortOrder.value  = s.sortOrder ?? 0
    return true
  } catch {
    return false
  }
}

const PLACEHOLDER_IMG =
  'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22 viewBox=%220 0 48 48%22%3E%3Crect width=%2248%22 height=%2248%22 fill=%22%23e5e7eb%22/%3E%3Cpath d=%22M12 34l8-10 6 7 4-5 6 8z%22 fill=%22%239ca3af%22/%3E%3Ccircle cx=%2218%22 cy=%2218%22 r=%223%22 fill=%22%239ca3af%22/%3E%3C/svg%3E'

function onImgError(e) { e.target.src = PLACEHOLDER_IMG }

function formatQty(v) {
  return (Number(v) || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const currentPage = computed(() => Math.floor(pageOffset.value / pageSize.value) + 1)
const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / pageSize.value)))
const canGoPrev = computed(() => currentPage.value > 1)
const canGoNext = computed(() => currentPage.value < totalPages.value)
const canEditProductMain = computed(() => authStore.hasPermission(PERMISSIONS.productMainEdit))
const warehouseSelectOptions = computed(() => warehouseOptions.value.map((row) => ({ ...row, label: optionLabel(row) })))
const shelfSelectOptions = computed(() => shelfOptions.value.map((row) => ({ ...row, label: optionLabel(row) })))
const canEditAnyProductDetail = computed(() =>
  authStore.hasPermission(PERMISSIONS.productImagesEdit) ||
  authStore.hasPermission(PERMISSIONS.productMainEdit) ||
  authStore.hasPermission(PERMISSIONS.productPriceFormulaEdit) ||
  authStore.hasPermission(PERMISSIONS.productUnitsEdit) ||
  authStore.hasPermission(PERMISSIONS.productBarcodesEdit)
)
const productDetailIcon = computed(() => canEditAnyProductDetail.value ? 'pi pi-pencil' : 'pi pi-eye')

function optionLabel(row) {
  const code = row?.code || ''
  const name = row?.name_1 || ''
  return name ? `${code} - ${name}` : code
}

function syncMobileState(eventOrQuery) {
  if (typeof eventOrQuery?.matches === 'boolean') {
    isMobile.value = eventOrQuery.matches
    return
  }
  if (typeof window !== 'undefined') {
    isMobile.value = window.innerWidth <= MOBILE_BREAKPOINT
  }
}

async function loadProducts() {
  isLoading.value = true
  try {
    const res = await getProductManageList({
      search:     searchText.value.trim(),
      sort_field: sortField.value || '',
      sort_order: sortOrder.value === -1 ? 'desc' : sortOrder.value === 1 ? 'asc' : '',
      offset:     pageOffset.value,
      limit:      pageSize.value,
    })
    products.value   = res.data
    totalCount.value = res.totalCount
  } catch (e) {
    toast.add({ severity: 'error', summary: 'โหลดสินค้าไม่สำเร็จ', detail: e.message, life: 3000 })
    products.value   = []
    totalCount.value = 0
  } finally {
    isLoading.value = false
  }
}

async function loadUnitOptions() {
  try {
    const res = await getUnitManageList('')
    unitOptions.value = (res.data || []).map((u) => ({ value: u.code, label: `${u.code} - ${u.name_1}` }))
  } catch {
    unitOptions.value = []
  }
}

function onPage(event) {
  pageOffset.value = event.first
  pageSize.value   = event.rows
  scrollReportToTop()
  loadProducts()
}

async function loadWarehouses() {
  try {
    warehouseOptions.value = await getWarehouseList()
  } catch {
    warehouseOptions.value = []
  }
}

async function loadShelves(whCode) {
  const seq = ++shelfLoadSeq
  if (!whCode) {
    shelfOptions.value = []
    return []
  }
  try {
    const list = await getShelfList(whCode)
    if (seq === shelfLoadSeq) shelfOptions.value = list
    return list
  } catch {
    if (seq === shelfLoadSeq) shelfOptions.value = []
    return []
  }
}

function hasShelfOption(shelfCode) {
  const code = String(shelfCode || '')
  return !!code && shelfOptions.value.some((row) => row.code === code && (!createForm.value.wh_code || !row.whcode || row.whcode === createForm.value.wh_code))
}

function warehouseShelfKey(row) {
  return `${String(row?.wh_code || row?.whcode || '').trim()}::${String(row?.shelf_code || row?.code || '').trim()}`
}

function normalizeWarehouseShelfList(rows) {
  const unique = new Map()
  for (const row of rows || []) {
    const whCode = String(row?.wh_code || row?.whcode || '').trim()
    const shelfCode = String(row?.shelf_code || row?.code || '').trim()
    if (!whCode || !shelfCode) continue
    unique.set(`${whCode}::${shelfCode}`, {
      wh_code: whCode,
      wh_name: row?.wh_name || '',
      shelf_code: shelfCode,
      shelf_name: row?.shelf_name || row?.name_1 || '',
      shelf_list: row?.shelf_list || '',
      min_point: Number(row?.min_point || 0),
      max_point: Number(row?.max_point || 0),
      status: Number(row?.status ?? 1) === 0 ? 0 : 1,
    })
  }
  return Array.from(unique.values())
}

function makeWarehouseShelfRow(whCode, shelfCode, shelfRow = null) {
  const wh = warehouseOptions.value.find((row) => row.code === whCode)
  const shelf = shelfRow || shelfOptions.value.find((row) => row.code === shelfCode && (!row.whcode || row.whcode === whCode))
  return {
    wh_code: whCode,
    wh_name: wh?.name_1 || '',
    shelf_code: shelfCode,
    shelf_name: shelf?.name_1 || '',
    shelf_list: '',
    min_point: 0,
    max_point: 0,
    status: 1,
  }
}

function warehouseShelfPayload(rows) {
  return normalizeWarehouseShelfList(rows).map((row) => ({
    wh_code: row.wh_code,
    shelf_code: row.shelf_code,
    shelf_list: row.shelf_list || '',
    min_point: Number(row.min_point || 0),
    max_point: Number(row.max_point || 0),
    status: Number(row.status ?? 1) === 0 ? 0 : 1,
  }))
}

function addCreateWarehouseShelf({ silent = false } = {}) {
  if (!createForm.value.wh_code || !createForm.value.shelf_code || !hasShelfOption(createForm.value.shelf_code)) {
    if (!silent) toast.add({ severity: 'warn', summary: 'กรุณาเลือกคลัง/ที่เก็บให้ถูกต้อง', life: 2500 })
    return false
  }
  const row = makeWarehouseShelfRow(createForm.value.wh_code, createForm.value.shelf_code)
  const key = warehouseShelfKey(row)
  if (createWarehouseShelves.value.some((item) => warehouseShelfKey(item) === key)) {
    if (!silent) toast.add({ severity: 'info', summary: 'มีคลัง/ที่เก็บนี้แล้ว', life: 2000 })
    return true
  }
  createWarehouseShelves.value = normalizeWarehouseShelfList([...createWarehouseShelves.value, row])
  return true
}

function removeCreateWarehouseShelf(row) {
  const key = warehouseShelfKey(row)
  createWarehouseShelves.value = createWarehouseShelves.value.filter((item) => warehouseShelfKey(item) !== key)
}

async function selectAllCreateWarehouseShelves() {
  isLoadingCreateWarehouseShelves.value = true
  try {
    if (!warehouseOptions.value.length) await loadWarehouses()
    const warehouseNameByCode = new Map(warehouseOptions.value.map((row) => [row.code, row.name_1 || '']))
    const shelves = await getShelfList('')
    createWarehouseShelves.value = normalizeWarehouseShelfList((shelves || []).map((row) => ({
      wh_code: row.whcode,
      wh_name: warehouseNameByCode.get(row.whcode) || '',
      shelf_code: row.code,
      shelf_name: row.name_1 || '',
      shelf_list: '',
      min_point: 0,
      max_point: 0,
      status: 1,
    })))
    toast.add({ severity: 'success', summary: `เลือกทั้งหมด ${createWarehouseShelves.value.length} รายการ`, life: 2000 })
  } catch (e) {
    toast.add({ severity: 'error', summary: 'โหลดคลัง/ที่เก็บทั้งหมดไม่สำเร็จ', detail: e.message, life: 3000 })
  } finally {
    isLoadingCreateWarehouseShelves.value = false
  }
}

function onSort(event) {
  sortField.value  = event.sortField || ''
  sortOrder.value  = event.sortOrder || 0
  pageOffset.value = 0
  loadProducts()
}

function onSearch() {
  pageOffset.value = 0
  loadProducts()
}

function clearSearch() {
  if (!searchText.value) return
  searchText.value = ''
  pageOffset.value = 0
  loadProducts()
}

async function resetSearchState({ reload = false } = {}) {
  searchText.value = ''
  pageOffset.value = 0
  if (reload) await loadProducts()
}

async function openProductDetail(code) {
  saveSearchState()
  router.push({ name: 'ProductManageEdit', params: { code } })
}

async function openCreateDialog() {
  if (!canEditProductMain.value) return
  if (!warehouseOptions.value.length) await loadWarehouses()
  const defaultWh = posStore.selectedPos?.pos_ic_wht || ''
  const defaultShelf = posStore.selectedPos?.pos_ic_shelf || ''
  createForm.value = {
    code: '',
    name_1: '',
    unit_standard: '',
    unit_cost: '',
    wh_code: defaultWh,
    shelf_code: defaultShelf,
    item_category: '',
    purchase_point: 0,
    minimum_qty: 0,
    maximum_qty: 0,
  }
  const shelves = await loadShelves(defaultWh)
  if (!shelves.some((row) => row.code === defaultShelf && (!row.whcode || row.whcode === defaultWh))) {
    createForm.value.shelf_code = ''
  }
  createWarehouseShelves.value = []
  addCreateWarehouseShelf({ silent: true })
  showCreateDialog.value = true
}

async function onCreateWarehouseChange() {
  createForm.value.shelf_code = ''
  await loadShelves(createForm.value.wh_code)
}

function normalizeProductCodeInput(value) {
  createForm.value.code = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
}

async function createProduct() {
  if (!canEditProductMain.value) return
  const code = createForm.value.code.trim().toUpperCase()
  const name = createForm.value.name_1.trim()
  const unit = createForm.value.unit_standard

  if (!code) {
    toast.add({ severity: 'warn', summary: 'กรุณาระบุรหัสสินค้า', life: 2500 })
    return
  }
  if (!PRODUCT_CODE_PATTERN.test(code)) {
    toast.add({ severity: 'warn', summary: 'รูปแบบรหัสสินค้าไม่ถูกต้อง', detail: 'ใช้ได้เฉพาะ A-Z, 0-9, - และ _', life: 3000 })
    return
  }
  if (!name) {
    toast.add({ severity: 'warn', summary: 'กรุณาระบุชื่อสินค้า', life: 2500 })
    return
  }
  if (!unit) {
    toast.add({ severity: 'warn', summary: 'กรุณาเลือกหน่วยมาตรฐาน', life: 2500 })
    return
  }
  if (!createForm.value.wh_code) {
    toast.add({ severity: 'warn', summary: 'กรุณาเลือกคลัง', life: 2500 })
    return
  }
  if (!createForm.value.shelf_code) {
    toast.add({ severity: 'warn', summary: 'กรุณาเลือกที่เก็บ', life: 2500 })
    return
  }
  if (!hasShelfOption(createForm.value.shelf_code)) {
    toast.add({ severity: 'warn', summary: 'กรุณาเลือกที่เก็บให้ตรงกับคลัง', life: 2500 })
    return
  }

  if (!createWarehouseShelves.value.length) {
    addCreateWarehouseShelf({ silent: true })
  }
  const payloadWarehouseShelves = warehouseShelfPayload(createWarehouseShelves.value)
  if (!payloadWarehouseShelves.length) {
    toast.add({ severity: 'warn', summary: 'กรุณาเลือกคลัง/ที่เก็บที่ใช้ได้อย่างน้อย 1 รายการ', life: 2500 })
    return
  }

  isCreating.value = true
  try {
    const res = await createProductItemMain({
      ...createForm.value,
      code,
      name_1: name,
      unit_standard: unit,
      unit_cost: createForm.value.unit_cost || unit,
      warehouse_shelves: payloadWarehouseShelves,
    })
    if (res.success) {
      toast.add({ severity: 'success', summary: 'เพิ่มสินค้าสำเร็จ', life: 2000 })
      showCreateDialog.value = false
      saveSearchState()
      router.push({ name: 'ProductManageEdit', params: { code } })
    } else {
      toast.add({ severity: 'error', summary: 'เพิ่มสินค้าไม่สำเร็จ', detail: res.message || '', life: 3000 })
    }
  } catch (e) {
    toast.add({ severity: 'error', summary: 'เพิ่มสินค้าไม่สำเร็จ', detail: e.message, life: 3000 })
  } finally {
    isCreating.value = false
  }
}

function goToPage(page) {
  const safePage = Math.min(Math.max(page, 1), totalPages.value)
  pageOffset.value = (safePage - 1) * pageSize.value
  scrollReportToTop()
  loadProducts()
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    mobileMediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`)
    syncMobileState(mobileMediaQuery)
    if (typeof mobileMediaQuery.addEventListener === 'function') {
      mobileMediaQuery.addEventListener('change', syncMobileState)
    } else {
      mobileMediaQuery.addListener(syncMobileState)
    }
  }

  loadUnitOptions()
  loadWarehouses()
  restoreSearchState()
  loadProducts()
})

onBeforeUnmount(() => {
  if (!mobileMediaQuery) return
  if (typeof mobileMediaQuery.removeEventListener === 'function') {
    mobileMediaQuery.removeEventListener('change', syncMobileState)
  } else {
    mobileMediaQuery.removeListener(syncMobileState)
  }
})
</script>

<template>
  <div class="manage-page">
    <div class="page-header">
      <div class="page-title-wrap">
        <i class="pi pi-tag header-icon" />
        <h1 class="page-title">จัดการสินค้า</h1>
      </div>
      <Button v-if="canEditProductMain" label="เพิ่มสินค้า" icon="pi pi-plus" @click="openCreateDialog" />
    </div>

    <div class="search-row">
      <div class="search-wrap">
        <InputText v-model="searchText" placeholder="ค้นหารหัส / ชื่อ / ชื่อ EN / บาร์โค้ด" class="search-input" @keyup.enter="onSearch" />
        <Button
          v-if="searchText"
          icon="pi pi-times"
          text
          rounded
          size="small"
          class="clear-search-button"
          aria-label="ล้างคำค้นหา"
          title="ล้างคำค้นหา"
          @click="clearSearch"
        />
      </div>
      <Button icon="pi pi-search" class="search-submit-button" @click="onSearch" />
    </div>

    <DataTable
      v-if="!isMobile"
      :value="products"
      :loading="isLoading"
      :lazy="true"
      :paginator="true"
      :rows="pageSize"
      :first="pageOffset"
      :totalRecords="totalCount"
      :rowsPerPageOptions="[20, 50, 100]"
      :sortField="sortField"
      :sortOrder="sortOrder"
      stripedRows
      scrollable
      class="product-table"
      @page="onPage"
      @sort="onSort"
    >
      <Column header="รูป" style="width: 68px; min-width: 68px">
        <template #body="{ data }">
          <img :src="getProductImageUrl(data.code)" @error="onImgError" class="product-thumb" loading="lazy" alt="" />
        </template>
      </Column>
      <Column field="code" header="รหัส" style="min-width: 120px" sortable />
      <Column field="name_1" header="ชื่อสินค้า" style="min-width: 220px" sortable />
      <Column field="name_eng_1" header="ชื่อ EN" style="min-width: 180px" />
      <Column field="unit_standard" header="หน่วย" style="min-width: 70px" />
      <Column field="balance_qty" header="คงเหลือ" style="min-width: 100px" bodyClass="col-num" headerClass="col-num" sortable>
        <template #body="{ data }">{{ formatQty(data.balance_qty) }}</template>
      </Column>
      <Column field="purchase_point" header="จุดสั่งซื้อ" style="min-width: 110px" bodyClass="col-num" headerClass="col-num" sortable>
        <template #body="{ data }">{{ formatQty(data.purchase_point) }}</template>
      </Column>
      <Column field="minimum_qty" header="สั่งซื้อต่ำสุด" style="min-width: 120px" bodyClass="col-num" headerClass="col-num" sortable>
        <template #body="{ data }">{{ formatQty(data.minimum_qty) }}</template>
      </Column>
      <Column field="maximum_qty" header="จุดสั่งซื้อสูงสุด" style="min-width: 140px" bodyClass="col-num" headerClass="col-num" sortable>
        <template #body="{ data }">{{ formatQty(data.maximum_qty) }}</template>
      </Column>
      <Column field="book_out_qty" header="ค้างจอง" style="min-width: 100px" bodyClass="col-num" headerClass="col-num" sortable>
        <template #body="{ data }">{{ formatQty(data.book_out_qty) }}</template>
      </Column>
      <Column field="accrued_out_qty" header="ค้างส่ง" style="min-width: 100px" bodyClass="col-num" headerClass="col-num" sortable>
        <template #body="{ data }">{{ formatQty(data.accrued_out_qty) }}</template>
      </Column>
      <Column field="accrued_in_qty" header="ค้างรับ" style="min-width: 100px" bodyClass="col-num" headerClass="col-num" sortable>
        <template #body="{ data }">{{ formatQty(data.accrued_in_qty) }}</template>
      </Column>
      <Column style="width: 52px; min-width: 52px">
        <template #body="{ data }">
          <Button :icon="productDetailIcon" text rounded size="small" @click="openProductDetail(data.code)" />
        </template>
      </Column>
      <template #empty>
        <div class="table-empty">ไม่พบข้อมูล</div>
      </template>
    </DataTable>

    <div v-else-if="isLoading" class="mobile-loading">
      <i class="pi pi-spinner pi-spin" />
    </div>

    <div v-else-if="products.length" class="mobile-list">
      <div v-for="product in products" :key="product.code" class="product-card">
        <div class="product-card-main">
          <img :src="getProductImageUrl(product.code)" @error="onImgError" class="product-thumb product-thumb-mobile" loading="lazy" alt="" />
          <div class="product-card-body">
            <div class="product-card-top">
              <div class="product-card-meta">
                <p class="product-code">{{ product.code }}</p>
                <h2 class="product-name">{{ product.name_1 || '-' }}</h2>
                <p v-if="product.name_eng_1" class="product-name-en">{{ product.name_eng_1 }}</p>
              </div>
              <Button :icon="productDetailIcon" text rounded size="small" @click="openProductDetail(product.code)" />
            </div>

            <div class="product-badges">
              <span class="product-badge">หน่วย {{ product.unit_standard || '-' }}</span>
            </div>

            <div class="product-stats">
              <div class="product-stat">
                <span>คงเหลือ</span>
                <strong>{{ formatQty(product.balance_qty) }}</strong>
              </div>
              <div class="product-stat">
                <span>จุดสั่งซื้อ</span>
                <strong>{{ formatQty(product.purchase_point) }}</strong>
              </div>
              <div class="product-stat">
                <span>ต่ำสุด</span>
                <strong>{{ formatQty(product.minimum_qty) }}</strong>
              </div>
              <div class="product-stat">
                <span>สูงสุด</span>
                <strong>{{ formatQty(product.maximum_qty) }}</strong>
              </div>
              <div class="product-stat">
                <span>ค้างจอง</span>
                <strong>{{ formatQty(product.book_out_qty) }}</strong>
              </div>
              <div class="product-stat">
                <span>ค้างส่ง</span>
                <strong>{{ formatQty(product.accrued_out_qty) }}</strong>
              </div>
              <div class="product-stat product-stat-wide">
                <span>ค้างรับ</span>
                <strong>{{ formatQty(product.accrued_in_qty) }}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="mobile-pager">
        <span class="mobile-pager-summary">{{ totalCount }} รายการ</span>
        <div class="mobile-pager-controls">
          <Button icon="pi pi-angle-left" text rounded :disabled="!canGoPrev" @click="goToPage(currentPage - 1)" />
          <span>{{ currentPage }} / {{ totalPages }}</span>
          <Button icon="pi pi-angle-right" text rounded :disabled="!canGoNext" @click="goToPage(currentPage + 1)" />
        </div>
      </div>
    </div>

    <div v-else class="table-empty">ไม่พบข้อมูล</div>

    <Dialog
      :visible="showCreateDialog"
      @update:visible="showCreateDialog = $event"
      header="เพิ่มสินค้าใหม่"
      :modal="true"
      :draggable="false"
      style="width: min(730px, 95vw)"
    >
      <div class="create-form">
        <div class="create-field">
          <label>รหัสสินค้า <span class="required">*</span></label>
          <InputText
            :modelValue="createForm.code"
            class="w-full"
            placeholder="เช่น ITM001"
            @update:modelValue="normalizeProductCodeInput"
          />
          <small class="code-help">อนุญาตเฉพาะ A-Z, 0-9, - และ _</small>
        </div>
        <div class="create-field">
          <label>ชื่อสินค้า <span class="required">*</span></label>
          <InputText v-model="createForm.name_1" class="w-full" placeholder="ชื่อสินค้า" />
        </div>
        <div class="create-grid-2">
          <div class="create-field">
            <label>หน่วยมาตรฐาน <span class="required">*</span></label>
            <Select
              v-model="createForm.unit_standard"
              :options="unitOptions"
              optionLabel="label"
              optionValue="value"
              class="w-full"
              placeholder="เลือกหน่วย"
              filter
            />
          </div>
          <div class="create-field">
            <label>หน่วยต้นทุน</label>
            <Select
              v-model="createForm.unit_cost"
              :options="unitOptions"
              optionLabel="label"
              optionValue="value"
              class="w-full"
              placeholder="(ไม่เลือก = ใช้หน่วยมาตรฐาน)"
              filter
              showClear
            />
          </div>
        </div>
        <div class="create-grid-2">
          <div class="create-field">
            <label>คลัง <span class="required">*</span></label>
            <Select
              v-model="createForm.wh_code"
              :options="warehouseSelectOptions"
              optionLabel="label"
              optionValue="code"
              class="w-full"
              placeholder="เลือกคลัง"
              filter
              @change="onCreateWarehouseChange"
            />
          </div>
          <div class="create-field">
            <label>ที่เก็บ <span class="required">*</span></label>
            <Select
              v-model="createForm.shelf_code"
              :options="shelfSelectOptions"
              optionLabel="label"
              optionValue="code"
              class="w-full"
              placeholder="เลือกที่เก็บ"
              filter
              :disabled="!createForm.wh_code"
            />
          </div>
        </div>
        <div class="warehouse-shelf-panel">
          <div class="warehouse-shelf-toolbar">
            <div>
              <p class="warehouse-shelf-title">คลัง/ที่เก็บที่ใช้ได้</p>
              <p class="warehouse-shelf-subtitle">เลือกได้หลายคลัง หรือเลือกทั้งหมดตามรายการ ic_shelf</p>
            </div>
            <div class="warehouse-shelf-actions">
              <Button label="เพิ่มคลัง/ที่เก็บ" icon="pi pi-plus" size="small" outlined @click="addCreateWarehouseShelf" />
              <Button label="All Warehouse and Shelf" icon="pi pi-check-square" size="small" :loading="isLoadingCreateWarehouseShelves" @click="selectAllCreateWarehouseShelves" />
            </div>
          </div>
          <DataTable :value="createWarehouseShelves" size="small" responsiveLayout="scroll" class="warehouse-shelf-table">
            <Column header="คลัง" style="min-width: 150px">
              <template #body="{ data }">
                <strong>{{ data.wh_code }}</strong>
                <span v-if="data.wh_name" class="muted-text">{{ data.wh_name }}</span>
              </template>
            </Column>
            <Column header="ที่เก็บ" style="min-width: 150px">
              <template #body="{ data }">
                <strong>{{ data.shelf_code }}</strong>
                <span v-if="data.shelf_name" class="muted-text">{{ data.shelf_name }}</span>
              </template>
            </Column>
            <Column style="width: 64px" bodyClass="col-actions">
              <template #body="{ data }">
                <Button icon="pi pi-trash" text rounded severity="danger" size="small" @click="removeCreateWarehouseShelf(data)" />
              </template>
            </Column>
            <template #empty>
              <div class="warehouse-shelf-empty">ยังไม่ได้เลือกคลัง/ที่เก็บ</div>
            </template>
          </DataTable>
        </div>
        <div class="create-grid-3">
          <div class="create-field">
            <label>จุดสั่งซื้อ</label>
            <InputNumber v-model="createForm.purchase_point" :min="0" :minFractionDigits="0" :maxFractionDigits="2" class="w-full" />
          </div>
          <div class="create-field">
            <label>สั่งซื้อต่ำสุด</label>
            <InputNumber v-model="createForm.minimum_qty" :min="0" :minFractionDigits="0" :maxFractionDigits="2" class="w-full" />
          </div>
          <div class="create-field">
            <label>จุดสั่งซื้อสูงสุด</label>
            <InputNumber v-model="createForm.maximum_qty" :min="0" :minFractionDigits="0" :maxFractionDigits="2" class="w-full" />
          </div>
        </div>
      </div>

      <template #footer>
        <Button label="ยกเลิก" severity="secondary" outlined @click="showCreateDialog = false" />
        <Button label="บันทึกและแก้ไขต่อ" icon="pi pi-save" :loading="isCreating" @click="createProduct" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.manage-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.625rem;
  padding: 0.25rem 0;
}

.page-title-wrap {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.header-icon {
  font-size: 1.375rem;
  color: var(--p-primary-color);
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

/* Search */
.search-row {
  display: flex;
  gap: 0.5rem;
  padding: 0.875rem;
  border: 1px solid var(--app-blue-line);
  border-radius: 8px;
  background: linear-gradient(180deg, #ffffff, #f6fbff);
  box-shadow: var(--app-shadow-sm);
}

.search-wrap {
  flex: 1;
  max-width: 400px;
  position: relative;
}

.search-input {
  width: 100%;
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

.create-form {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  padding-top: 0.25rem;
}

.create-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.create-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.create-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.create-field label {
  font-size: 0.8rem;
  color: var(--p-text-color-secondary);
}

.warehouse-shelf-panel {
  border: 1px solid var(--app-blue-line);
  border-radius: 8px;
  padding: 0.75rem;
  background: #f6fbff;
}

.warehouse-shelf-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.625rem;
}

.warehouse-shelf-title {
  margin: 0;
  font-weight: 700;
  color: var(--p-text-color);
}

.warehouse-shelf-subtitle {
  margin: 0.125rem 0 0;
  font-size: 0.8rem;
  color: var(--p-text-color-secondary);
}

.warehouse-shelf-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
}

.warehouse-shelf-table :deep(.p-datatable-tbody > tr > td) {
  vertical-align: top;
}

.muted-text {
  display: block;
  margin-top: 0.125rem;
  font-size: 0.78rem;
  color: var(--p-text-color-secondary);
}

.warehouse-shelf-empty {
  padding: 0.75rem;
  text-align: center;
  color: var(--p-text-color-secondary);
}

.code-help {
  font-size: 0.74rem;
  color: var(--p-text-color-secondary);
}

.required {
  color: var(--p-red-500);
}

/* Table */
.product-thumb {
  width: 44px;
  height: 44px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid var(--app-blue-line);
  display: block;
}

.table-empty {
  text-align: center;
  padding: 2.5rem 0;
  color: var(--p-text-color-secondary);
}

.mobile-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 220px;
  font-size: 1.5rem;
  color: var(--p-text-color-secondary);
}

.mobile-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.875rem;
}

.product-card {
  border: 1px solid var(--app-blue-line);
  border-radius: 8px;
  background: #ffffff;
  padding: 0.875rem;
  box-shadow: var(--app-shadow-sm);
}

.product-card-main {
  display: flex;
  gap: 0.875rem;
}

.product-thumb-mobile {
  width: 72px;
  height: 72px;
  border-radius: 8px;
  flex-shrink: 0;
}

.product-card-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.product-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.product-card-meta {
  min-width: 0;
}

.product-code {
  margin: 0;
  font-size: 0.76rem;
  color: var(--p-text-color-secondary);
}

.product-name {
  margin: 0.18rem 0 0;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.3;
  word-break: break-word;
}

.product-name-en {
  margin: 0.2rem 0 0;
  font-size: 0.8rem;
  color: var(--p-text-color-secondary);
  word-break: break-word;
}

.product-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.product-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.35rem 0.6rem;
  border-radius: 999px;
  background: #eaf6ff;
  font-size: 0.75rem;
  color: var(--p-text-color-secondary);
}

.product-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.625rem;
}

.product-stat {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.625rem 0.7rem;
  border-radius: 8px;
  background: #f6fbff;
  border: 1px solid #e2f1fb;
}

.product-stat span {
  font-size: 0.72rem;
  color: var(--p-text-color-secondary);
}

.product-stat strong {
  font-size: 0.92rem;
}

.product-stat-wide {
  grid-column: 1 / -1;
}

.mobile-pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.25rem 0;
  color: var(--p-text-color-secondary);
}

.mobile-pager-summary {
  font-size: 0.82rem;
}

.mobile-pager-controls {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

@media (max-width: 768px) {
  .manage-page {
    gap: 0.875rem;
  }

  .page-title {
    font-size: 1.25rem;
  }

  .search-row {
    flex-direction: column;
  }

  .page-header {
    flex-direction: column;
    align-items: stretch;
  }

  .page-header :deep(.p-button) {
    width: 100%;
    justify-content: center;
  }

  .search-submit-button {
    width: 100%;
    justify-content: center;
  }

  .search-wrap,
  .search-input {
    max-width: none;
    width: 100%;
  }

  .product-card-main {
    flex-direction: column;
  }

  .product-thumb-mobile {
    width: 100%;
    height: 180px;
  }

  .product-card-top,
  .mobile-pager {
    flex-direction: column;
    align-items: stretch;
  }

  .product-card-top :deep(.p-button) {
    align-self: flex-end;
  }

  .create-grid-2,
  .create-grid-3 {
    grid-template-columns: 1fr;
  }

  .mobile-pager-controls {
    justify-content: space-between;
  }
}

@media (min-width: 640px) and (max-width: 768px) {
  .page-header {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    align-items: center;
  }

  .page-title-wrap {
    grid-column: span 5;
    min-width: 0;
  }

  .page-header :deep(.p-button) {
    grid-column: span 7;
    width: 100%;
  }

  .search-row {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    align-items: center;
  }

  .search-wrap {
    grid-column: span 9;
  }

  .search-row > :deep(.p-button) {
    grid-column: span 3;
    width: 100%;
  }

  .mobile-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: stretch;
  }

  .product-card {
    min-width: 0;
    padding: 0.75rem;
  }

  .product-thumb-mobile {
    height: 132px;
  }

  .product-card-body {
    gap: 0.625rem;
  }

  .product-name {
    font-size: 0.95rem;
  }

  .product-stat {
    padding: 0.55rem 0.6rem;
  }

  .mobile-pager {
    grid-column: 1 / -1;
  }
}
</style>
