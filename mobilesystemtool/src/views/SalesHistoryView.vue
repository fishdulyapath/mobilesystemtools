<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { getDocSaleHistory } from '@/services/salesService'
import { checkNextTigerPendingPayment, mockTigerPendingPaid } from '@/services/tigerService'
import { todayISO } from '@/utils/formatters'
import SalesFilterBar from '@/components/sales/SalesFilterBar.vue'
import SalesTotalSummary from '@/components/sales/SalesTotalSummary.vue'
import SalesTable from '@/components/sales/SalesTable.vue'
import SaleDetailModal from '@/components/sales/SaleDetailModal.vue'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'

const props = defineProps({
  saleKind: { type: String, default: '' },
  title: { type: String, default: 'ประวัติการขาย' },
})

const toast = useToast()
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

function withSaleKind(params) {
  return { ...params, sale_kind: props.saleKind }
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
  tigerPendingTimer = setInterval(checkTigerPendingOnce, 9000)
  checkTigerPendingOnce()
})

onUnmounted(() => clearInterval(tigerPendingTimer))

watch(() => props.saleKind, () => {
  modalVisible.value = false
  selectedDoc.value = null
  const params = defaultParams()
  currentParams.value = params
  filterBar.value?.resetFilters?.({ emitSearch: false })
  loadSales(params)
})
</script>

<template>
  <div class="sales-history">
    <h1 class="page-title">{{ title }}</h1>

    <SalesFilterBar ref="filterBar" @search="onSearch" />

    <Message v-if="errorMsg" severity="error" :closable="false" class="mt-1">{{ errorMsg }}</Message>

    <SalesTotalSummary :rows="rows" />

    <SalesTable
      :key="saleKind"
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
  padding: 1rem 0.5rem;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
  padding: 0 0.5rem;
}

.mt-1 {
  margin-top: 0.25rem;
}

@media (max-width: 768px) {
  .sales-history {
    gap: 0.75rem;
    padding: 0.75rem 0.25rem;
  }

  .page-title {
    font-size: 1.25rem;
    padding: 0 0.25rem;
  }
}
</style>
