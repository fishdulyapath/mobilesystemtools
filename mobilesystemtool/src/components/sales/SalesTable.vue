<script setup>
import { formatDate, formatCurrency } from '@/utils/formatters'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import { TIGER_PENDING_MOCK } from '@/services/tigerService'
import { scrollReportToTop } from '@/utils/pageScroll'

defineProps({
  rows: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  mockingDocNo: { type: String, default: '' },
})

const emit = defineEmits(['row-select', 'tiger-mock-paid'])

function isTigerPending(row) {
  return Number(row.send_sms) === 1 && !!row.tiger_order_id
}
</script>

<template>
  <DataTable
    :value="rows"
    :loading="loading"
    selection-mode="single"
    data-key="doc_no"
    paginator
    :rows="20"
    :rows-per-page-options="[10, 20, 50]"
    scrollable
    scroll-height="flex"
    responsive-layout="stack"
    class="sales-table"
    @row-click="(e) => emit('row-select', e.data)"
    @page="scrollReportToTop"
  >
    <template #empty>
      <div class="empty-msg">ไม่พบข้อมูล</div>
    </template>

    <Column field="doc_date" header="วันที่" :sortable="true">
      <template #body="{ data }">{{ formatDate(data.doc_date) }} {{ data.doc_time }}</template>
    </Column>
    <Column field="doc_no" header="เลขที่เอกสาร" :sortable="true"  style="min-width: 150px"/>
    <Column header="สถานะ">
      <template #body="{ data }">
        <div v-if="isTigerPending(data)" class="status-cell">
          <span class="tiger-pending-badge">
            <i class="pi pi-clock" />
            รอ Tiger
          </span>
          <Button
            v-if="TIGER_PENDING_MOCK"
            label="Mock จ่ายแล้ว"
            icon="pi pi-check"
            size="small"
            severity="warning"
            outlined
            :loading="mockingDocNo === data.doc_no"
            :disabled="!!mockingDocNo"
            @click.stop="emit('tiger-mock-paid', data)"
          />
        </div>
        <span v-else class="status-paid">สำเร็จ</span>
      </template>
    </Column>
    <Column field="cust_code" header="รหัสลูกค้า" class="hidden-mobile" />
    <Column field="cust_name" header="ชื่อลูกค้า" />
    <Column field="total_net_amount" header="ยอดสุทธิ" :sortable="true">
      <template #body="{ data }">
        {{ formatCurrency(data.total_net_amount ?? data.total_amount) }}
      </template>
    </Column>
  </DataTable>
</template>

<style scoped>
.empty-msg {
  text-align: center;
  padding: 1rem;
  color: var(--p-text-color-secondary);
}

.sales-table :deep(tr) {
  cursor: pointer;
}

.sales-table :deep(.p-datatable-table) {
  font-size: 0.9rem;
}

.sales-table :deep(.p-paginator) {
  padding: 0.5rem;
}

.tiger-pending-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: 999px;
  background: #fff7ed;
  color: #c2410c;
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
}

.status-cell {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.status-paid {
  color: var(--p-text-color-secondary);
  font-size: 0.8rem;
}

@media (max-width: 768px) {
  .sales-table :deep(.p-datatable-table) {
    font-size: 0.85rem;
  }

  .sales-table :deep(.p-paginator-bottom) {
    flex-wrap: wrap;
  }

  .sales-table :deep(.p-paginator .p-paginator-rpp-options) {
    display: none;
  }
}

@media (max-width: 640px) {
  .hidden-mobile {
    display: none;
  }

  .sales-table :deep(.p-datatable .p-datatable-thead > tr > th) {
    padding: 0.4rem 0.2rem;
    font-size: 0.8rem;
  }

  .sales-table :deep(.p-datatable .p-datatable-tbody > tr > td) {
    padding: 0.4rem 0.2rem;
    font-size: 0.8rem;
  }

  .sales-table :deep(.p-paginator) {
    padding: 0.4rem 0.2rem;
    font-size: 0.75rem;
  }
}

@media (max-width: 480px) {
  .sales-table :deep(.p-datatable .p-datatable-thead > tr > th) {
    padding: 0.3rem 0.15rem;
    font-size: 0.75rem;
  }

  .sales-table :deep(.p-datatable .p-datatable-tbody > tr > td) {
    padding: 0.3rem 0.15rem;
    font-size: 0.75rem;
  }
}
</style>
