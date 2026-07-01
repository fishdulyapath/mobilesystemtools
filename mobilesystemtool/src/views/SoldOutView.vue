<script setup>
import { computed, ref, watch, onMounted } from 'vue'
import { getDashboardSoldOut } from '@/services/salesService'
import { useAuthStore } from '@/stores/auth'
import { PERMISSIONS } from '@/utils/permissions'
import { formatCurrency, formatDate, formatNumber, toISO } from '@/utils/formatters'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import DatePicker from 'primevue/datepicker'
import Skeleton from 'primevue/skeleton'

const authStore = useAuthStore()
const fromDate = ref(new Date())
const toDate = ref(new Date())
const loading = ref(false)
const rows = ref([])
const canViewPurchaseInfo = computed(() => authStore.hasPermission(PERMISSIONS.soldOutPurchaseInfoView))

async function load() {
  const from = toISO(fromDate.value)
  const to = toISO(toDate.value)
  if (!from || !to) {
    rows.value = []
    return
  }
  loading.value = true
  try {
    rows.value = await getDashboardSoldOut({
      from_date: from,
      to_date: to,
      user_code: authStore.employee?.user_code || '',
    })
  } catch {
    rows.value = []
  } finally {
    loading.value = false
  }
}

watch([fromDate, toDate], ([from, to]) => {
  if (from && to) load()
})

onMounted(load)
</script>

<template>
  <div class="soldout-page">
    <div class="page-header">
      <div class="header-left">
        <i class="pi pi-exclamation-circle header-icon" />
        <h1 class="page-title">สินค้าขายหมด</h1>
      </div>
      <div class="date-range">
        <label class="date-field">
          <span>จากวันที่</span>
          <DatePicker
            v-model="fromDate"
            date-format="dd/mm/yy"
            :manual-input="false"
            show-icon
            class="date-picker"
          />
        </label>
        <label class="date-field">
          <span>ถึงวันที่</span>
          <DatePicker
            v-model="toDate"
            date-format="dd/mm/yy"
            :manual-input="false"
            show-icon
            class="date-picker"
          />
        </label>
      </div>
    </div>

    <div v-if="loading" class="skeleton-wrap">
      <Skeleton v-for="n in 8" :key="n" height="2.5rem" class="mb-2" />
    </div>

    <div v-else-if="rows.length === 0" class="empty-state">
      <i class="pi pi-check-circle empty-icon" />
      <p>ไม่มีสินค้าขายหมดในช่วงวันที่เลือก</p>
    </div>

    <DataTable
      v-else
      :value="rows"
      striped-rows
      size="small"
      class="soldout-table"
    >
      <Column field="item_code" header="รหัสสินค้า" style="width: 140px" />
      <Column field="item_name" header="ชื่อสินค้า" />
      <Column header="หน่วย" style="width: 90px">
        <template #body="{ data }">
          {{ data.unit_name || data.unit_code }}
        </template>
      </Column>
      <Column header="จำนวนในคลัง" style="width: 130px; text-align: right">
        <template #body="{ data }">
          <span class="num-cell">{{ formatNumber(data.stock_qty) }}</span>
        </template>
      </Column>
      <Column header="จำนวนในตะกร้า" style="width: 130px; text-align: right">
        <template #body="{ data }">
          <span class="num-cell">{{ formatNumber(data.cart_qty) }}</span>
        </template>
      </Column>
      <Column header="คงเหลือ" style="width: 110px; text-align: right">
        <template #body="{ data }">
          <span class="num-cell remaining">{{ formatNumber(data.remaining_qty) }}</span>
        </template>
      </Column>
      <Column v-if="canViewPurchaseInfo" header="ราคาซื้อล่าสุด" style="width: 140px; text-align: right">
        <template #body="{ data }">
          <span class="num-cell purchase-price">
            {{ data.last_purchase_doc_no ? formatCurrency(data.last_purchase_price) : '-' }}
          </span>
        </template>
      </Column>
      <Column v-if="canViewPurchaseInfo" header="เจ้าหนี้ล่าสุด" style="min-width: 180px">
        <template #body="{ data }">
          <div class="supplier-cell">
            <strong>{{ data.last_purchase_supplier_code || '-' }}</strong>
            <span>{{ data.last_purchase_supplier_name || '-' }}</span>
          </div>
        </template>
      </Column>
      <Column v-if="canViewPurchaseInfo" header="เอกสารซื้อ" style="min-width: 150px">
        <template #body="{ data }">
          <div class="purchase-doc-cell">
            <strong>{{ data.last_purchase_doc_no || '-' }}</strong>
            <span>{{ formatDate(data.last_purchase_doc_date) }}</span>
          </div>
        </template>
      </Column>
    </DataTable>

    <div v-if="!loading && rows.length" class="soldout-cards">
      <article v-for="row in rows" :key="row.item_code" class="soldout-card">
        <div class="card-head">
          <span class="item-code">{{ row.item_code }}</span>
          <strong>{{ row.item_name || '-' }}</strong>
          <small>{{ row.unit_name || row.unit_code || '-' }}</small>
        </div>

        <div class="card-stats">
          <div class="stat">
            <span>คลัง</span>
            <strong>{{ formatNumber(row.stock_qty) }}</strong>
          </div>
          <div class="stat">
            <span>ตะกร้า</span>
            <strong>{{ formatNumber(row.cart_qty) }}</strong>
          </div>
          <div class="stat remaining-stat">
            <span>คงเหลือ</span>
            <strong>{{ formatNumber(row.remaining_qty) }}</strong>
          </div>
        </div>

        <div v-if="canViewPurchaseInfo" class="purchase-info">
          <div>
            <span>ซื้อ</span>
            <strong>{{ row.last_purchase_doc_no ? formatCurrency(row.last_purchase_price) : '-' }}</strong>
          </div>
          <div>
            <span>เจ้าหนี้</span>
            <strong>{{ row.last_purchase_supplier_code || '-' }}</strong>
            <small>{{ row.last_purchase_supplier_name || '-' }}</small>
          </div>
          <div>
            <span>เอกสารซื้อ</span>
            <strong>{{ row.last_purchase_doc_no || '-' }}</strong>
            <small>{{ formatDate(row.last_purchase_doc_date) }}</small>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.soldout-page {
  padding: 0;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.header-icon {
  font-size: 1.375rem;
  color: var(--p-red-500);
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

.date-range {
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.date-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  color: var(--p-text-color-secondary);
  font-size: 0.78rem;
}

.date-picker {
  width: 180px;
}

.mb-2 { margin-bottom: 0.5rem; }

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
  font-size: 1rem;
}

.soldout-table {
  width: 100%;
}

.soldout-cards {
  display: none;
}

.num-cell {
  display: block;
  text-align: right;
}

.remaining {
  font-weight: 600;
  color: var(--p-red-500);
}

.purchase-price {
  font-weight: 600;
}

.supplier-cell,
.purchase-doc-cell {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.supplier-cell strong,
.purchase-doc-cell strong {
  font-size: 0.86rem;
}

.supplier-cell span,
.purchase-doc-cell span {
  color: var(--p-text-color-secondary);
  font-size: 0.78rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 900px) {
  .soldout-page {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .page-header {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
    margin-bottom: 0;
  }

  .date-range {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
    align-items: end;
  }

  .date-picker,
  .date-field :deep(.p-datepicker),
  .date-field :deep(.p-inputtext) {
    width: 100%;
  }

  .soldout-table {
    display: none;
  }

  .soldout-cards {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .soldout-card {
    min-width: 0;
    border: 1px solid var(--p-surface-200);
    border-radius: 8px;
    background: var(--p-surface-0);
    padding: 0.65rem 0.75rem;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(210px, 0.45fr);
    align-items: center;
    gap: 0.55rem 0.75rem;
  }

  .card-head {
    display: grid;
    gap: 0.12rem;
    min-width: 0;
  }

  .card-head strong {
    line-height: 1.25;
    min-width: 0;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .item-code,
  .card-head small,
  .stat span,
  .purchase-info span,
  .purchase-info small {
    color: var(--p-text-color-secondary);
    font-size: 0.72rem;
  }

  .card-stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.45rem;
  }

  .stat,
  .purchase-info > div {
    min-width: 0;
  }

  .stat {
    display: grid;
    gap: 0.12rem;
  }

  .stat strong,
  .purchase-info strong {
    font-size: 0.9rem;
    line-height: 1.2;
  }

  .remaining-stat strong {
    color: var(--p-red-500);
  }

  .purchase-info {
    display: grid;
    grid-column: 1 / -1;
    grid-template-columns: minmax(80px, 0.45fr) minmax(0, 1fr) minmax(0, 0.9fr);
    gap: 0.55rem;
    padding-top: 0.45rem;
    border-top: 1px solid var(--p-surface-200);
  }

  .purchase-info > div {
    display: grid;
    gap: 0.12rem;
  }

  .purchase-info strong,
  .purchase-info small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

@media (max-width: 720px) {
  .soldout-card {
    grid-template-columns: 1fr;
    gap: 0.55rem;
  }

  .purchase-info {
    grid-template-columns: minmax(70px, 0.55fr) minmax(0, 1fr) minmax(0, 0.8fr);
    padding-top: 0.5rem;
  }
}

@media (max-width: 520px) {
  .date-range {
    grid-template-columns: 1fr;
  }

  .soldout-card {
    padding: 0.65rem;
  }

  .card-stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .purchase-info {
    grid-template-columns: 1fr;
  }
}
</style>
