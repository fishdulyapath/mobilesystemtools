<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getDocSaleHistory } from '@/services/salesService'
import { checkNextTigerPendingPayment, mockTigerPendingPaid } from '@/services/tigerService'
import { todayISO } from '@/utils/formatters'
import SalesFilterBar from '@/components/sales/SalesFilterBar.vue'
import SalesTotalSummary from '@/components/sales/SalesTotalSummary.vue'
import SalesTable from '@/components/sales/SalesTable.vue'
import SaleDetailModal from '@/components/sales/SaleDetailModal.vue'
import Message from 'primevue/message'
import SelectButton from 'primevue/selectbutton'
import { useToast } from 'primevue/usetoast'

const props = defineProps({
  saleKind: { type: String, default: '' },
  title: { type: String, default: 'ประวัติการขาย' },
  documentType: { type: String, default: 'sale' },
})

const toast = useToast()
const route = useRoute()
const router = useRouter()
const filterBar = ref(null)

const rows = ref([])
const loading = ref(false)
const errorMsg = ref('')
const modalVisible = ref(false)
const selectedDoc = ref(null)
const currentParams = ref(null)
const checkingTiger = ref(false)
const mockingTigerDocNo = ref('')
let tigerPendingTimer = null

const saleKindOptions = [
  { label: 'ทั้งหมด', value: '' },
  { label: 'ขายสด', value: 'cash' },
  { label: 'ขายเชื่อ', value: 'credit' },
]

const selectedSaleKind = ref(props.saleKind || String(route.query.sale_kind || ''))
const isSaleDocument = computed(() => props.documentType === 'sale')

function withSaleKind(params) {
  return {
    ...params,
    document_type: props.documentType,
    sale_kind: isSaleDocument.value ? selectedSaleKind.value : '',
  }
}

function defaultParams() {
  const today = todayISO()
  return { from_date: today, to_date: today }
}

async function loadSales(params) {
  loading.value = true
  errorMsg.value = ''
  currentParams.value = params
  try {
    rows.value = await getDocSaleHistory(withSaleKind(params))
  } catch (err) {
    errorMsg.value = err.message
    rows.value = []
  } finally {
    loading.value = false
  }
}

function onSearch(params) {
  loadSales(params)
}

function onRowSelect(doc) {
  selectedDoc.value = doc
  modalVisible.value = true
}

async function checkTigerPendingOnce() {
  if (!isSaleDocument.value) return
  if (checkingTiger.value) return
  checkingTiger.value = true
  try {
    const result = await checkNextTigerPendingPayment()
    if (result?.checked && currentParams.value) {
      await loadSales(currentParams.value)
    }
  } catch {
    // เครื่อง Tiger อาจไม่พร้อมเป็นช่วง ๆ ให้รอบถัดไปลองใหม่
  } finally {
    checkingTiger.value = false
  }
}

async function reloadCurrentSales() {
  if (currentParams.value) await loadSales(currentParams.value)
}

async function onTigerMockPaid(doc) {
  if (!doc?.doc_no || mockingTigerDocNo.value) return
  mockingTigerDocNo.value = doc.doc_no
  try {
    const result = await mockTigerPendingPaid({ doc_no: doc.doc_no })
    if (result?.paid) {
      toast.add({ severity: 'success', summary: 'Mock ชำระ Tiger แล้ว', detail: doc.doc_no, life: 2500 })
      await reloadCurrentSales()
    } else if (result?.busy) {
      toast.add({ severity: 'warn', summary: 'Tiger กำลังตรวจรายการอื่น', detail: 'ลองใหม่อีกครั้ง', life: 2500 })
    }
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Mock ไม่สำเร็จ', detail: err.message, life: 3000 })
  } finally {
    mockingTigerDocNo.value = ''
  }
}

onMounted(() => {
  loadSales(defaultParams())
  if (isSaleDocument.value) {
    tigerPendingTimer = setInterval(checkTigerPendingOnce, 9000)
    checkTigerPendingOnce()
  }
})

onUnmounted(() => clearInterval(tigerPendingTimer))

function resetAndLoad() {
  modalVisible.value = false
  selectedDoc.value = null
  const params = defaultParams()
  currentParams.value = params
  filterBar.value?.resetFilters?.({ emitSearch: false })
  loadSales(params)
}

function onSaleKindChange() {
  const query = { ...route.query }
  if (selectedSaleKind.value) query.sale_kind = selectedSaleKind.value
  else delete query.sale_kind
  router.replace({ query })
  loadSales(currentParams.value || defaultParams())
}

watch(() => props.saleKind, (kind) => {
  selectedSaleKind.value = kind || String(route.query.sale_kind || '')
  resetAndLoad()
})

watch(() => props.documentType, () => {
  clearInterval(tigerPendingTimer)
  tigerPendingTimer = null
  selectedSaleKind.value = props.saleKind || ''
  resetAndLoad()
  if (isSaleDocument.value) {
    tigerPendingTimer = setInterval(checkTigerPendingOnce, 9000)
    checkTigerPendingOnce()
  }
})
</script>

<template>
  <div class="sales-history">
    <h1 class="page-title">{{ title }}</h1>

    <div v-if="isSaleDocument" class="type-filter">
      <span class="type-filter-label">ประเภท</span>
      <SelectButton
        v-model="selectedSaleKind"
        :options="saleKindOptions"
        option-label="label"
        option-value="value"
        :allow-empty="false"
        @change="onSaleKindChange"
      />
    </div>

    <SalesFilterBar ref="filterBar" @search="onSearch" />

    <Message v-if="errorMsg" severity="error" :closable="false" class="mt-1">{{ errorMsg }}</Message>

    <SalesTotalSummary :rows="rows" />

    <SalesTable
      :key="`${documentType}-${selectedSaleKind}`"
      :rows="rows"
      :loading="loading"
      :mocking-doc-no="mockingTigerDocNo"
      @row-select="onRowSelect"
      @tiger-mock-paid="onTigerMockPaid"
    />

    <SaleDetailModal v-model:visible="modalVisible" :doc-header="selectedDoc" @tiger-paid="reloadCurrentSales" />
  </div>
</template>

<style scoped>
.sales-history {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0.25rem 0;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
  padding: 0;
}

.type-filter {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  flex-wrap: wrap;
  border: 1px solid var(--app-blue-line);
  border-radius: 8px;
  background: linear-gradient(180deg, #ffffff, #f6fbff);
  box-shadow: var(--app-shadow-sm);
}

.type-filter-label {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--p-text-color-secondary);
}

.mt-1 {
  margin-top: 0.25rem;
}

@media (max-width: 768px) {
  .sales-history {
    gap: 0.75rem;
    padding: 0;
  }

  .page-title {
    font-size: 1.25rem;
  }

  .type-filter {
    padding: 0.75rem;
    gap: 0.5rem;
  }

  .type-filter :deep(.p-selectbutton) {
    width: 100%;
  }

  .type-filter :deep(.p-selectbutton .p-button) {
    flex: 1;
    padding: 0.45rem 0.5rem;
    font-size: 0.8rem;
  }
}
</style>
