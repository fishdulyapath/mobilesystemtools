<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getDocSaleHistory } from '@/services/salesService'
import { formatCurrency, formatDate, todayISO } from '@/utils/formatters'
import { useLazyLoad } from '@/composables/useLazyLoad'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Skeleton from 'primevue/skeleton'

const router = useRouter()
const loading = ref(false)
const rows = ref([])

const latestBills = computed(() =>
  [...rows.value]
    .sort((a, b) => `${b.doc_date || ''} ${b.doc_time || ''}`.localeCompare(`${a.doc_date || ''} ${a.doc_time || ''}`))
    .slice(0, 6)
)

function shortTime(value) {
  if (!value) return ''
  return String(value).slice(0, 5)
}

async function load() {
  loading.value = true
  try {
    const today = todayISO()
    rows.value = await getDocSaleHistory({
      from_date: today,
      to_date: today,
    })
  } catch {
    rows.value = []
  } finally {
    loading.value = false
  }
}

const { containerRef } = useLazyLoad(load)
defineExpose({ load })
</script>

<template>
  <Card ref="containerRef" class="latest-bills-card">
    <template #title>
      <div class="card-title-row">
        <i class="pi pi-receipt" />
        <span>บิลล่าสุด</span>
        <Button
          label="ดูทั้งหมด"
          icon="pi pi-arrow-right"
          icon-pos="right"
          text
          size="small"
          class="title-action"
          @click="router.push('/sales-history')"
        />
      </div>
    </template>

    <template #content>
      <div v-if="loading" class="bill-list">
        <div v-for="n in 6" :key="n" class="bill-row">
          <Skeleton width="8rem" height="1rem" />
          <Skeleton width="5rem" height="1rem" />
        </div>
      </div>

      <div v-else-if="latestBills.length === 0" class="empty-state">
        <i class="pi pi-receipt" />
        <span>ยังไม่มีบิลวันนี้</span>
      </div>

      <ul v-else class="bill-list">
        <li v-for="bill in latestBills" :key="bill.doc_no" class="bill-row">
          <div class="bill-main">
            <strong>{{ bill.doc_no }}</strong>
            <span>
              {{ shortTime(bill.doc_time) || formatDate(bill.doc_date) }}
              <template v-if="bill.cust_name"> · {{ bill.cust_name }}</template>
            </span>
          </div>
          <div class="bill-amount">
            {{ formatCurrency(bill.total_net_amount ?? bill.total_amount) }}
          </div>
        </li>
      </ul>
    </template>
  </Card>
</template>

<style scoped>
.latest-bills-card {
  min-height: 100%;
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  color: var(--app-blue-ink);
  font-size: 1rem;
  font-weight: 800;
}

.title-action {
  margin-left: auto;
}

.bill-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.bill-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: 2.65rem;
  padding: 0.5rem 0.625rem;
  border-radius: 8px;
  background: #f5fbff;
  border: 1px solid rgba(2, 120, 184, 0.12);
}

.bill-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.bill-main strong,
.bill-main span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bill-main strong {
  font-size: 0.88rem;
  color: var(--p-text-color);
}

.bill-main span {
  font-size: 0.76rem;
  color: var(--p-text-color-secondary);
}

.bill-amount {
  flex-shrink: 0;
  font-size: 0.9rem;
  font-weight: 800;
  color: var(--p-primary-color);
}

.empty-state {
  min-height: 14rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: var(--p-text-color-secondary);
  font-size: 0.9rem;
}

.empty-state i {
  font-size: 2rem;
  color: var(--p-primary-color);
}
</style>
