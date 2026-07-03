<script setup>
import { computed, onMounted, onActivated } from 'vue'
import { usePosStore } from '@/stores/pos'
import { useAuthStore } from '@/stores/auth'
import { PERMISSIONS } from '@/utils/permissions'
import PosInfoCard from '@/components/dashboard/PosInfoCard.vue'
import SalesSummaryCard from '@/components/dashboard/SalesSummaryCard.vue'
import TopProductsCard from '@/components/dashboard/TopProductsCard.vue'
import LatestBillsCard from '@/components/dashboard/LatestBillsCard.vue'
import WeeklySalesChartCard from '@/components/dashboard/WeeklySalesChartCard.vue'
import TigerPendingAlert from '@/components/dashboard/TigerPendingAlert.vue'

const posStore = usePosStore()
const authStore = useAuthStore()

const canViewMonthlySummary = computed(() => authStore.hasPermission(PERMISSIONS.dashboardMonthlySummary))

async function refresh() {
  try { await posStore.refreshErpOption() } catch {}
}

onMounted(refresh)
onActivated(refresh)
</script>

<template>
  <div class="dashboard">
    <TigerPendingAlert />

    <h1 class="page-title">แดชบอร์ด</h1>

    <!-- row 1: POS info + ยอดขายวันนี้ + บิลล่าสุด -->
    <div class="dashboard-grid top-grid">
      <PosInfoCard />
      <SalesSummaryCard />
      <LatestBillsCard />
    </div>

    <!-- row 2: สินค้าขายดี + กราฟยอดขายสัปดาห์นี้ -->
    <p v-if="canViewMonthlySummary" class="section-label">
      <i class="pi pi-chart-bar" />
      สรุปยอดประจำเดือน
    </p>
    <div v-if="canViewMonthlySummary" class="dashboard-grid rank-grid">
      <TopProductsCard />
      <WeeklySalesChartCard />
    </div>
  </div>
</template>

<style scoped>
.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 1.5rem;
}

.dashboard {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* ─── section divider label ──────────────────────────────── */
.section-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--p-text-color-secondary);
  margin: 0 0 1rem;
}

/* ─── shared grid wrapper ────────────────────────────────── */
.dashboard-grid {
  display: grid;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

/* row 1: POS info + today sales + latest bills */
.top-grid {
  grid-template-columns: 280px minmax(0, 1fr) minmax(0, 1.25fr);
  align-items: stretch;
}

.top-grid > * {
  height: 100%;
}

.top-grid :deep(.p-card) {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.top-grid :deep(.p-card-body) {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.top-grid :deep(.p-card-content) {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* row 2: top products + weekly sales chart */
.rank-grid {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.45fr);
}

/* tablet: stack the latest bills card below the first two */
@media (max-width: 1199px) {
  .top-grid {
    grid-template-columns: 280px 1fr;
  }
  .top-grid > :nth-child(3) {
    grid-column: 1 / -1;
  }

  .rank-grid {
    grid-template-columns: 1fr;
  }
}

/* collapse to single column on mobile */
@media (max-width: 767px) {
  .page-title {
    font-size: 1.25rem;
    margin-bottom: 1rem;
  }

  .top-grid,
  .rank-grid {
    grid-template-columns: 1fr;
  }
  .top-grid > :nth-child(3) {
    grid-column: auto;
  }
}
</style>
