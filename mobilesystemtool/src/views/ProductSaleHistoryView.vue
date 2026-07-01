<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { getProductSaleHistory } from '@/services/salesService'
import { getProductManageList } from '@/services/productManageService'
import { formatNumber, todayISO } from '@/utils/formatters'
import { scrollReportToTop } from '@/utils/pageScroll'
import SalesFilterBar from '@/components/sales/SalesFilterBar.vue'
import SalesTotalSummary from '@/components/sales/SalesTotalSummary.vue'
import SalesTable from '@/components/sales/SalesTable.vue'
import SaleDetailModal from '@/components/sales/SaleDetailModal.vue'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'

const productRows = ref([])
const productSearch = ref('')
const productLoading = ref(false)
const productError = ref('')
const productPageSize = ref(20)
const productOffset = ref(0)
const productTotalCount = ref(0)
const productSortField = ref('code')
const productSortOrder = ref(1)
const selectedProduct = ref(null)
const rows = ref([])
const loading = ref(false)
const errorMsg = ref('')
const modalVisible = ref(false)
const selectedDoc = ref(null)
const currentParams = ref(null)
const filterBar = ref(null)
let productSearchTimer = null

const currentProductPage = computed(() => Math.floor(productOffset.value / productPageSize.value) + 1)
const totalProductPages = computed(() => Math.max(1, Math.ceil(productTotalCount.value / productPageSize.value)))
const canGoProductPrev = computed(() => currentProductPage.value > 1)
const canGoProductNext = computed(() => currentProductPage.value < totalProductPages.value)
const productTitle = computed(() => selectedProduct.value?.name_1 || selectedProduct.value?.item_name || selectedProduct.value?.code || '')
const productCode = computed(() => selectedProduct.value?.code || selectedProduct.value?.item_code || '')

async function loadProducts() {
  productLoading.value = true
  productError.value = ''
  try {
    const result = await getProductManageList({
      search: productSearch.value.trim(),
      offset: productOffset.value,
      limit: productPageSize.value,
      sort_field: productSortField.value || 'code',
      sort_order: productSortOrder.value === -1 ? 'desc' : 'asc',
    })
    productRows.value = result.data
    productTotalCount.value = result.totalCount
  } catch (err) {
    productRows.value = []
    productTotalCount.value = 0
    productError.value = err.message || 'โหลดรายการสินค้าไม่สำเร็จ'
  } finally {
    productLoading.value = false
  }
}

function scheduleProductSearch() {
  clearTimeout(productSearchTimer)
  productSearchTimer = setTimeout(() => {
    productOffset.value = 0
    loadProducts()
  }, 300)
}

function searchProducts() {
  clearTimeout(productSearchTimer)
  productOffset.value = 0
  loadProducts()
}

function clearProductSearch() {
  productSearch.value = ''
  productOffset.value = 0
  loadProducts()
}

async function onProductPage(event) {
  productOffset.value = event.first
  productPageSize.value = event.rows
  await loadProducts()
  await nextTick()
  scrollReportToTop({ behavior: 'instant' })
}

async function onProductSort(event) {
  productSortField.value = event.sortField || 'code'
  productSortOrder.value = event.sortOrder || 1
  productOffset.value = 0
  await loadProducts()
  await nextTick()
  scrollReportToTop({ behavior: 'instant' })
}

async function goProductPage(page) {
  const safePage = Math.min(Math.max(page, 1), totalProductPages.value)
  productOffset.value = (safePage - 1) * productPageSize.value
  await loadProducts()
  await nextTick()
  scrollReportToTop({ behavior: 'instant' })
}

function historyParams(params = {}) {
  return { ...params, item_code: productCode.value }
}

async function loadRows(params) {
  if (!productCode.value) return
  loading.value = true
  errorMsg.value = ''
  currentParams.value = params
  try {
    rows.value = await getProductSaleHistory(historyParams(params))
  } catch (err) {
    rows.value = []
    errorMsg.value = err.message || 'โหลดประวัติการขายของสินค้าไม่สำเร็จ'
  } finally {
    loading.value = false
  }
}

async function selectProduct(row) {
  selectedProduct.value = row
  rows.value = []
  selectedDoc.value = null
  modalVisible.value = false
  const today = todayISO()
  await nextTick()
  filterBar.value?.resetFilters?.({ emitSearch: false })
  await loadRows({ search: '', from_date: today, to_date: today })
  await nextTick()
  scrollReportToTop({ behavior: 'instant' })
}

function backToProducts() {
  selectedProduct.value = null
  rows.value = []
  errorMsg.value = ''
  currentParams.value = null
  selectedDoc.value = null
  modalVisible.value = false
  nextTick(() => scrollReportToTop({ behavior: 'instant' }))
}

function onHistorySearch(params) {
  loadRows(params)
}

function onRowSelect(doc) {
  selectedDoc.value = doc
  modalVisible.value = true
}

async function reloadCurrentRows() {
  if (currentParams.value) await loadRows(currentParams.value)
}

onMounted(loadProducts)

onBeforeUnmount(() => {
  clearTimeout(productSearchTimer)
})
</script>

<template>
  <div class="product-sale-history">
    <div v-if="!selectedProduct" class="product-list-view">
      <div class="page-header">
        <div>
          <h1 class="page-title">ประวัติการขายตามสินค้า</h1>
          <p class="page-subtitle">เลือกสินค้าก่อนเพื่อดูประวัติการขายของสินค้านั้น</p>
        </div>
      </div>

      <div class="product-search-panel">
        <IconField class="product-search-field">
          <InputIcon class="pi pi-search" />
          <InputText
            v-model="productSearch"
            placeholder="ค้นหารหัส / ชื่อสินค้า / ชื่อ EN / บาร์โค้ด"
            @input="scheduleProductSearch"
            @keyup.enter="searchProducts"
          />
          <button v-if="productSearch" class="input-clear-btn" type="button" aria-label="ล้างค้นหา" @click="clearProductSearch">
            <i class="pi pi-times" />
          </button>
        </IconField>
        <Button icon="pi pi-search" label="ค้นหา" @click="searchProducts" />
      </div>

      <Message v-if="productError" severity="error" :closable="false">{{ productError }}</Message>

      <DataTable
        :value="productRows"
        :loading="productLoading"
        :rows="productPageSize"
        :first="productOffset"
        :total-records="productTotalCount"
        :sort-field="productSortField"
        :sort-order="productSortOrder"
        data-key="code"
        lazy
        paginator
        :rows-per-page-options="[10, 20, 50]"
        responsive-layout="stack"
        class="product-table"
        @page="onProductPage"
        @sort="onProductSort"
        @row-click="(event) => selectProduct(event.data)"
      >
        <template #empty>
          <div class="empty-state">{{ productLoading ? 'กำลังโหลด' : 'ไม่พบสินค้า' }}</div>
        </template>
        <Column field="code" header="รหัสสินค้า" style="min-width: 140px" sortable />
        <Column field="name_1" header="ชื่อสินค้า" style="min-width: 260px" sortable>
          <template #body="{ data }">
            <div class="product-name-cell">
              <strong>{{ data.name_1 || '-' }}</strong>
              <span v-if="data.name_eng_1">{{ data.name_eng_1 }}</span>
            </div>
          </template>
        </Column>
        <Column field="unit_standard" header="หน่วย" style="min-width: 90px" />
        <Column field="balance_qty" header="คงเหลือ" body-class="col-num" header-class="col-num" style="min-width: 110px" sortable>
          <template #body="{ data }">{{ formatNumber(data.balance_qty) }}</template>
        </Column>
        <Column header="" style="width: 72px" body-class="col-action">
          <template #body>
            <Button icon="pi pi-angle-right" text rounded aria-label="ดูประวัติ" />
          </template>
        </Column>
      </DataTable>

      <div class="mobile-pager">
        <span>{{ productTotalCount.toLocaleString('th-TH') }} รายการ</span>
        <div class="mobile-pager-controls">
          <Button icon="pi pi-angle-left" text rounded :disabled="!canGoProductPrev" @click="goProductPage(currentProductPage - 1)" />
          <span>{{ currentProductPage }} / {{ totalProductPages }}</span>
          <Button icon="pi pi-angle-right" text rounded :disabled="!canGoProductNext" @click="goProductPage(currentProductPage + 1)" />
        </div>
      </div>
    </div>

    <div v-else class="history-view">
      <div class="selected-header">
        <Button icon="pi pi-arrow-left" text rounded aria-label="กลับไปเลือกสินค้า" @click="backToProducts" />
        <div class="selected-title-wrap">
          <span class="selected-code">{{ productCode }}</span>
          <h1 class="page-title">{{ productTitle }}</h1>
        </div>
      </div>

      <SalesFilterBar
        ref="filterBar"
        class="product-history-filter"
        search-placeholder="ค้นหาเลขที่เอกสาร / ลูกค้า"
        @search="onHistorySearch"
      />

      <Message v-if="errorMsg" severity="error" :closable="false" class="mt-1">{{ errorMsg }}</Message>

      <SalesTotalSummary :rows="rows" />

      <div v-if="loading" class="history-skeleton">
        <Skeleton height="2.5rem" />
        <Skeleton height="2.5rem" />
        <Skeleton height="2.5rem" />
      </div>

      <SalesTable
        v-else
        :rows="rows"
        :loading="loading"
        @row-select="onRowSelect"
      />

      <SaleDetailModal v-model:visible="modalVisible" :doc-header="selectedDoc" @tiger-paid="reloadCurrentRows" />
    </div>
  </div>
</template>

<style scoped>

.product-sale-history,
.product-list-view,
.history-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 0;
}

.product-sale-history {
  padding: 1rem 0.5rem;
}

.page-header,
.selected-header,
.product-search-panel,
.mobile-pager,
.mobile-pager-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.page-header,
.selected-header {
  justify-content: space-between;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
  letter-spacing: 0;
}

.page-subtitle {
  margin: 0.25rem 0 0;
  color: var(--p-text-color-secondary);
  font-size: 0.9rem;
}

.product-search-panel {
  padding: 0.75rem;
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
}

.product-search-field {
  flex: 1;
  min-width: 0;
  position: relative;
}

.product-search-field :deep(input) {
  width: 100%;
  height: 2.625rem;
  padding-right: 2.5rem;
}

.input-clear-btn {
  position: absolute;
  right: 0.45rem;
  top: 50%;
  transform: translateY(-50%);
  width: 2rem;
  height: 2rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--p-text-color-secondary);
  cursor: pointer;
}

.input-clear-btn:hover {
  background: var(--p-surface-hover);
  color: var(--p-text-color);
}

.product-table :deep(tr) {
  cursor: pointer;
}

.product-search-panel > :deep(.p-button) {
  height: 2.625rem;
  align-self: stretch;
}

.product-table :deep(.p-datatable-thead > tr > th),
.product-table :deep(.p-datatable-tbody > tr > td) {
  padding: 0.55rem 1rem;
  line-height: 1.25;
}

.product-table :deep(.p-datatable-tbody > tr > td) {
  height: 3.25rem;
}

.product-name-cell {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.product-name-cell strong,
.selected-title-wrap .page-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-name-cell span,
.selected-code {
  color: var(--p-text-color-secondary);
  font-size: 0.8rem;
}

.col-num {
  text-align: right;
}

.col-action {
  text-align: center;
}

.empty-state {
  padding: 1.25rem;
  text-align: center;
  color: var(--p-text-color-secondary);
}

.mobile-pager {
  display: none;
  justify-content: space-between;
  color: var(--p-text-color-secondary);
  font-size: 0.875rem;
}

.selected-header {
  padding: 0.75rem 1rem;
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  justify-content: flex-start;
}

.selected-title-wrap {
  min-width: 0;
}

.history-skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.mt-1 {
  margin-top: 0.25rem;
}

.product-history-filter :deep(.filter-bottom > .p-button) {
  height: 2.625rem;
  flex: 0 0 auto;
  padding-inline: 1rem;
}

@media (max-width: 768px) {
  .product-sale-history {
    gap: 0.75rem;
    padding: 0.75rem 0.25rem;
  }

  .page-title {
    font-size: 1.25rem;
  }

  .page-subtitle {
    font-size: 0.82rem;
  }

  .product-search-panel {
    padding: 0.5rem;
  }

  .product-search-field :deep(input),
  .product-search-panel > :deep(.p-button) {
    height: 2.5rem;
  }

  .product-search-panel > :deep(.p-button) {
    width: 3rem;
    min-width: 3rem;
    padding-inline: 0;
    justify-content: center;
  }

  .product-search-panel > :deep(.p-button .p-button-label) {
    display: none;
  }

  .product-history-filter :deep(.filter-bottom) {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 3rem;
    align-items: center;
    gap: 0.5rem;
  }

  .product-history-filter :deep(.filter-bottom > *) {
    width: auto;
    min-width: 0;
  }

  .product-history-filter :deep(.filter-bottom > .search-field) {
    width: 100%;
  }

  .product-history-filter :deep(.filter-bottom > .p-button) {
    width: 3rem;
    min-width: 3rem;
    height: 2.5rem;
    padding-inline: 0;
    justify-content: center;
  }

  .product-history-filter :deep(.filter-bottom > .p-button .p-button-label) {
    display: none;
  }

  .product-table :deep(.p-paginator-bottom) {
    display: none;
  }

  .product-table :deep(.p-datatable-table) {
    font-size: 0.85rem;
  }

  .product-table :deep(.p-datatable-thead > tr > th),
  .product-table :deep(.p-datatable-tbody > tr > td) {
    padding: 0.45rem 0.75rem;
  }

  .product-table :deep(.p-datatable-tbody > tr > td) {
    height: 2.875rem;
  }

  .mobile-pager {
    display: flex;
  }

  .selected-header {
    padding: 0.625rem;
  }
}

@media (max-width: 520px) {
  .product-search-panel {
    gap: 0.5rem;
  }

  .mobile-pager {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
