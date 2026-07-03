<script setup>
import { computed, ref } from 'vue'
import { getDocSaleHistory } from '@/services/salesService'
import { formatCurrency, toISO } from '@/utils/formatters'
import { useLazyLoad } from '@/composables/useLazyLoad'
import Card from 'primevue/card'
import Skeleton from 'primevue/skeleton'

const loading = ref(false)
const rows = ref([])
const weekdays = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา']

function startOfThaiWeek(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

const weekStart = computed(() => startOfThaiWeek())
const weekDays = computed(() =>
  Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart.value, index)
    return {
      date,
      iso: toISO(date),
      label: weekdays[index],
    }
  })
)

const chartRows = computed(() => {
  const amountByDate = new Map(weekDays.value.map((day) => [day.iso, 0]))
  rows.value.forEach((row) => {
    const date = toISO(row.doc_date || row.trans_date || row.date)
    if (!amountByDate.has(date)) return
    const amount = Number(row.total_net_amount ?? row.total_amount ?? 0)
    amountByDate.set(date, amountByDate.get(date) + amount)
  })
  return weekDays.value.map((day) => ({
    ...day,
    amount: amountByDate.get(day.iso) || 0,
  }))
})

const totalAmount = computed(() => chartRows.value.reduce((sum, row) => sum + row.amount, 0))
const maxAmount = computed(() => Math.max(...chartRows.value.map((row) => row.amount), 1))
const totalDocs = computed(() => rows.value.length)

function barHeight(amount) {
  if (amount <= 0) return '8%'
  return `${Math.max(14, Math.round((amount / maxAmount.value) * 100))}%`
}

async function load() {
  loading.value = true
  try {
    rows.value = await getDocSaleHistory({
      from_date: toISO(weekStart.value),
      to_date: toISO(new Date()),
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
  <Card ref="containerRef" class="weekly-chart-card">
    <template #title>
      <div class="card-title-row">
        <i class="pi pi-chart-bar" />
        <span>ยอดขายสัปดาห์นี้</span>
      </div>
    </template>

    <template #content>
      <div class="week-summary">
        <div>
          <span>รวมสัปดาห์นี้</span>
          <strong>{{ loading ? '-' : formatCurrency(totalAmount) }}</strong>
        </div>
        <div>
          <span>จำนวนบิล</span>
          <strong>{{ loading ? '-' : totalDocs }}</strong>
        </div>
      </div>

      <div v-if="loading" class="chart-skeleton">
        <Skeleton height="12rem" />
      </div>

      <div v-else class="bar-chart" aria-label="ยอดขายรายวันของสัปดาห์นี้">
        <div v-for="row in chartRows" :key="row.iso" class="bar-column">
          <div class="bar-track">
            <div
              class="bar-fill"
              :class="{ 'bar-fill-empty': row.amount <= 0 }"
              :style="{ height: barHeight(row.amount) }"
              :title="`${row.label}: ${formatCurrency(row.amount)}`"
            />
          </div>
          <span class="bar-label">{{ row.label }}</span>
          <small>{{ row.amount > 0 ? formatCurrency(row.amount) : '-' }}</small>
        </div>
      </div>
    </template>
  </Card>
</template>

<style scoped>
.weekly-chart-card {
  min-height: 100%;
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--app-blue-ink);
  font-size: 1rem;
  font-weight: 800;
}

.week-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.week-summary > div {
  display: grid;
  gap: 0.25rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--app-blue-line);
  border-radius: 8px;
  background: #f1f9ff;
}

.week-summary span {
  color: var(--p-text-color-secondary);
  font-size: 0.75rem;
  font-weight: 700;
}

.week-summary strong {
  color: var(--p-text-color);
  font-size: 1.05rem;
}

.chart-skeleton {
  min-height: 12rem;
}

.bar-chart {
  height: 14rem;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.65rem;
  align-items: end;
}

.bar-column {
  min-width: 0;
  height: 100%;
  display: grid;
  grid-template-rows: 1fr auto auto;
  gap: 0.35rem;
  text-align: center;
}

.bar-track {
  min-height: 0;
  display: flex;
  align-items: flex-end;
  border-radius: 8px;
  background: linear-gradient(180deg, #f4f9fd, #e8f4fc);
  overflow: hidden;
  border: 1px solid rgba(2, 120, 184, 0.12);
}

.bar-fill {
  width: 100%;
  border-radius: 8px 8px 0 0;
  background: linear-gradient(180deg, #0ea5e9, var(--p-primary-color));
  transition: height 0.18s ease;
}

.bar-fill-empty {
  background: #cfe6f4;
}

.bar-label {
  color: var(--p-text-color);
  font-size: 0.8rem;
  font-weight: 800;
}

.bar-column small {
  min-height: 1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--p-text-color-secondary);
  font-size: 0.68rem;
}

@media (max-width: 767px) {
  .bar-chart {
    gap: 0.4rem;
  }

  .bar-column small {
    display: none;
  }
}
</style>
