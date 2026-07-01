<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import InputText from 'primevue/inputtext'
import Skeleton from 'primevue/skeleton'
import ToggleSwitch from 'primevue/toggleswitch'
import { getPurchaseStockReorderList } from '@/services/purchaseStockService'
import { scrollReportToTop } from '@/utils/pageScroll'

const rows = ref([])
const loading = ref(false)
const searchText = ref('')
const pageSize = ref(50)
const pageOffset = ref(0)
const totalCount = ref(0)
const sortField = ref('item_code')
const sortOrder = ref(1)
const isMobile = ref(false)
const onlyReorder = ref(false)

const MOBILE_BREAKPOINT = 768
let mobileMediaQuery = null
let searchTimer = null

const currentPage = computed(() => Math.floor(pageOffset.value / pageSize.value) + 1)
const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / pageSize.value)))
const canGoPrev = computed(() => currentPage.value > 1)
const canGoNext = computed(() => currentPage.value < totalPages.value)
const emptyMessage = computed(() => onlyReorder.value ? 'ไม่มีสินค้าที่ถึงจุดสั่งซื้อ' : 'ไม่พบสินค้า')

function formatQty(value) {
  return (Number(value) || 0).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function stockStatus(row) {
  const available = Number(row?.available_qty || 0)
  if (row?.reached_reorder_point) return 'reorder'
  if (available < 0) return 'negative'
  if (available === 0) return 'out'
  return 'normal'
}

function stockStatusLabel(row) {
  const status = stockStatus(row)
  if (status === 'reorder') return 'ถึงจุดสั่งซื้อ'
  if (status === 'negative') return 'สต๊อกติดลบ'
  if (status === 'out') return 'สต๊อกหมด'
  return 'ปกติ'
}

function stockStatusClass(row) {
  return `status-${stockStatus(row)}`
}

function isStockWarning(row) {
  return stockStatus(row) !== 'normal'
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

async function loadRows() {
  loading.value = true
  try {
    const result = await getPurchaseStockReorderList({
      search: searchText.value.trim(),
      offset: pageOffset.value,
      limit: pageSize.value,
      sort_field: sortField.value || '',
      sort_order: sortOrder.value === -1 ? 'desc' : 'asc',
      only_reorder: onlyReorder.value,
    })
    rows.value = result.data
    totalCount.value = result.totalCount
  } catch {
    rows.value = []
    totalCount.value = 0
  } finally {
    loading.value = false
  }
}

function scheduleSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    pageOffset.value = 0
    loadRows()
  }, 350)
}

function onSearchEnter() {
  clearTimeout(searchTimer)
  pageOffset.value = 0
  loadRows()
}

function clearSearch() {
  searchText.value = ''
  pageOffset.value = 0
  loadRows()
}

async function onPage(event) {
  pageOffset.value = event.first
  pageSize.value = event.rows
  await loadRows()
  await nextTick()
  scrollReportToTop({ behavior: 'instant' })
}

function onSort(event) {
  sortField.value = event.sortField || 'item_code'
  sortOrder.value = event.sortOrder || 1
  pageOffset.value = 0
  loadRows()
}

async function goToPage(page) {
  const safePage = Math.min(Math.max(page, 1), totalPages.value)
  pageOffset.value = (safePage - 1) * pageSize.value
  await loadRows()
  await nextTick()
  scrollReportToTop({ behavior: 'instant' })
}

watch(searchText, scheduleSearch)
watch(onlyReorder, () => {
  pageOffset.value = 0
  loadRows()
})

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
  loadRows()
})

onBeforeUnmount(() => {
  clearTimeout(searchTimer)
  if (!mobileMediaQuery) return
  if (typeof mobileMediaQuery.removeEventListener === 'function') {
    mobileMediaQuery.removeEventListener('change', syncMobileState)
  } else {
    mobileMediaQuery.removeListener(syncMobileState)
  }
})
</script>

<template>
  <div class="reorder-page">
    <div class="page-header">
      <div class="header-left">
        <i class="pi pi-list-check header-icon" />
        <h1 class="page-title">ดูสต๊อกสินค้าเพื่อสั่งซื้อ</h1>
      </div>
    </div>

    <div class="toolbar">
      <InputText
        v-model="searchText"
        class="search-input"
        placeholder="ค้นหารหัส / ชื่อ / ชื่อ EN / บาร์โค้ด"
        @keyup.enter="onSearchEnter"
      />
      <Button icon="pi pi-search" label="ค้นหา" @click="onSearchEnter" />
      <Button v-if="searchText" icon="pi pi-times" severity="secondary" outlined @click="clearSearch" />
      <label class="filter-toggle">
        <ToggleSwitch v-model="onlyReorder" />
        <span>แสดงเฉพาะรายการถึงจุดสั่งซื้อ</span>
      </label>
    </div>

    <div v-if="loading && !rows.length" class="skeleton-wrap">
      <Skeleton v-for="n in 8" :key="n" height="2.75rem" />
    </div>

    <div v-else-if="!loading && rows.length === 0" class="empty-state">
      <i class="pi pi-check-circle empty-icon" />
      <p>{{ emptyMessage }}</p>
    </div>

    <DataTable
      v-else-if="!isMobile"
      :value="rows"
      :loading="loading"
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
      size="small"
      class="reorder-table"
      @page="onPage"
      @sort="onSort"
    >
      <Column field="item_code" header="รหัสสินค้า" style="min-width: 130px" sortable />
      <Column field="item_name" header="ชื่อสินค้า" style="min-width: 260px" sortable />
      <Column header="หน่วย" style="min-width: 90px">
        <template #body="{ data }">{{ data.unit_name || data.unit_code || '-' }}</template>
      </Column>
      <Column field="real_balance_qty" header="ยอดจริง" style="min-width: 110px" bodyClass="col-num" headerClass="col-num" sortable>
        <template #body="{ data }">{{ formatQty(data.real_balance_qty) }}</template>
      </Column>
      <Column field="cart_qty" header="ในตะกร้า" style="min-width: 110px" bodyClass="col-num" headerClass="col-num" sortable>
        <template #body="{ data }">{{ formatQty(data.cart_qty) }}</template>
      </Column>
      <Column field="available_qty" header="พร้อมใช้" style="min-width: 110px" bodyClass="col-num" headerClass="col-num" sortable>
        <template #body="{ data }">
          <span :class="{ 'available-cell': isStockWarning(data) }">{{ formatQty(data.available_qty) }}</span>
        </template>
      </Column>
      <Column field="reached_reorder_point" header="สถานะ" style="min-width: 130px" sortable>
        <template #body="{ data }">
          <span :class="['status-pill', stockStatusClass(data)]">
            {{ stockStatusLabel(data) }}
          </span>
        </template>
      </Column>
      <Column field="purchase_point" header="จุดสั่งซื้อ" style="min-width: 120px" bodyClass="col-num" headerClass="col-num" sortable>
        <template #body="{ data }">{{ formatQty(data.purchase_point) }}</template>
      </Column>
      <Column field="minimum_qty" header="สั่งซื้อต่ำสุด" style="min-width: 130px" bodyClass="col-num" headerClass="col-num" sortable>
        <template #body="{ data }">{{ formatQty(data.minimum_qty) }}</template>
      </Column>
      <Column field="maximum_qty" header="จุดสั่งซื้อสูงสุด" style="min-width: 150px" bodyClass="col-num" headerClass="col-num" sortable>
        <template #body="{ data }">{{ formatQty(data.maximum_qty) }}</template>
      </Column>
      <Column field="suggest_qty" header="แนะนำสั่งซื้อ" style="min-width: 140px" bodyClass="col-num" headerClass="col-num" sortable>
        <template #body="{ data }">
          <strong>{{ formatQty(data.suggest_qty) }}</strong>
        </template>
      </Column>
    </DataTable>

    <div v-else class="mobile-list">
      <div v-for="row in rows" :key="row.item_code" class="reorder-card">
        <div class="card-head">
          <div class="card-title-wrap">
            <span class="item-code">{{ row.item_code }}</span>
            <strong>{{ row.item_name || '-' }}</strong>
            <small>{{ row.unit_name || row.unit_code || '-' }}</small>
          </div>
        </div>
        <div class="card-stats">
          <div class="stat">
            <span>จริง</span>
            <strong>{{ formatQty(row.real_balance_qty) }}</strong>
          </div>
          <div class="stat">
            <span>ตะกร้า</span>
            <strong>{{ formatQty(row.cart_qty) }}</strong>
          </div>
          <div :class="['stat', { warning: isStockWarning(row) }]">
            <span>พร้อมใช้</span>
            <strong>{{ formatQty(row.available_qty) }}</strong>
          </div>
          <div :class="['stat', { warning: isStockWarning(row) }]">
            <span>สถานะ</span>
            <strong>{{ stockStatusLabel(row) }}</strong>
          </div>
          <div class="stat">
            <span>จุดสั่ง</span>
            <strong>{{ formatQty(row.purchase_point) }}</strong>
          </div>
          <div class="stat">
            <span>ต่ำสุด</span>
            <strong>{{ formatQty(row.minimum_qty) }}</strong>
          </div>
          <div class="stat">
            <span>สูงสุด</span>
            <strong>{{ formatQty(row.maximum_qty) }}</strong>
          </div>
          <div class="stat suggest">
            <span>แนะนำ</span>
            <strong>{{ formatQty(row.suggest_qty) }}</strong>
          </div>
        </div>
      </div>

      <div class="mobile-pager">
        <span>{{ totalCount.toLocaleString('th-TH') }} รายการ</span>
        <div class="mobile-pager-controls">
          <Button icon="pi pi-angle-left" text rounded :disabled="!canGoPrev" @click="goToPage(currentPage - 1)" />
          <span>{{ currentPage }} / {{ totalPages }}</span>
          <Button icon="pi pi-angle-right" text rounded :disabled="!canGoNext" @click="goToPage(currentPage + 1)" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.reorder-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.page-header,
.header-left,
.toolbar,
.mobile-pager,
.mobile-pager-controls {
  display: flex;
  align-items: center;
}

.page-header {
  justify-content: space-between;
  gap: 1rem;
}

.header-left {
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

.toolbar {
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filter-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.5rem;
  color: var(--p-text-color);
  font-size: 0.9rem;
  white-space: nowrap;
}

.search-input {
  width: min(420px, 100%);
}

.skeleton-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 4rem 0;
  color: var(--p-text-color-secondary);
}

.empty-icon {
  font-size: 2.5rem;
  color: var(--p-green-500);
}

.empty-state p {
  margin: 0;
}

.available-cell {
  color: var(--p-red-500);
  font-weight: 700;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  min-height: 1.6rem;
  border-radius: 999px;
  padding: 0.2rem 0.65rem;
  font-size: 0.78rem;
  font-weight: 700;
  white-space: nowrap;
}

.status-reorder {
  background: color-mix(in srgb, var(--p-red-500) 12%, var(--p-surface-0));
  color: var(--p-red-600);
}

.status-negative {
  background: color-mix(in srgb, var(--p-red-500) 14%, var(--p-surface-0));
  color: var(--p-red-600);
}

.status-out {
  background: color-mix(in srgb, var(--p-orange-500) 16%, var(--p-surface-0));
  color: var(--p-orange-600);
}

.status-normal {
  background: var(--p-surface-100);
  color: var(--p-text-color-secondary);
}

.mobile-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.reorder-card {
  min-width: 0;
  border: 1px solid var(--p-surface-200);
  border-radius: 8px;
  background: var(--p-surface-0);
  padding: 0.65rem 0.75rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(420px, 1.1fr);
  align-items: center;
  gap: 0.55rem 0.75rem;
}

.card-head {
  min-width: 0;
}

.card-title-wrap {
  min-width: 0;
  display: grid;
  gap: 0.12rem;
}

.item-code,
.card-title-wrap small,
.stat span {
  color: var(--p-text-color-secondary);
  font-size: 0.72rem;
}

.card-title-wrap strong {
  line-height: 1.25;
  min-width: 0;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.card-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.45rem 0.55rem;
  padding-left: 0.75rem;
  border-left: 1px solid var(--p-surface-200);
}

.stat {
  min-width: 0;
  display: grid;
  gap: 0.12rem;
}

.stat strong {
  font-size: 0.9rem;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stat.warning strong {
  color: var(--p-red-500);
}

.stat.suggest strong {
  color: var(--p-primary-color);
}

.mobile-pager {
  justify-content: space-between;
  color: var(--p-text-color-secondary);
}

.mobile-pager-controls {
  gap: 0.25rem;
}

@media (max-width: 768px) {
  .page-header,
  .toolbar,
  .mobile-pager {
    align-items: stretch;
    flex-direction: column;
  }

  .toolbar :deep(.p-button),
  .filter-toggle,
  .search-input {
    width: 100%;
  }

  .reorder-card {
    grid-template-columns: 1fr;
    gap: 0.55rem;
  }

  .card-stats {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    padding-left: 0;
    border-left: 0;
    border-top: 1px solid var(--p-surface-200);
    padding-top: 0.5rem;
  }

  .mobile-pager-controls {
    justify-content: space-between;
  }
}

@media (max-width: 520px) {
  .card-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
