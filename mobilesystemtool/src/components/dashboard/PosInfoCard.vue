<script setup>
import { useRouter } from 'vue-router'
import { usePosStore } from '@/stores/pos'
import { useAuthStore } from '@/stores/auth'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Tag from 'primevue/tag'

const router = useRouter()
const posStore = usePosStore()
const authStore = useAuthStore()
</script>

<template>
  <Card>
    <template #content>
      <div class="pos-info">
        <div class="pos-info-row">
          <i class="pi pi-user info-icon" />
          <div>
            <div class="info-label">พนักงาน</div>
            <div class="info-value">{{ authStore.employee?.user_name || '-' }}</div>
          </div>
        </div>

        <div class="pos-info-row">
          <i class="pi pi-desktop info-icon" />
          <div>
            <div class="info-label">เครื่อง POS</div>
            <Tag :value="posStore.posId" severity="info" />
          </div>
        </div>

        <div class="pos-info-row">
          <i class="pi pi-map-marker info-icon" />
          <div>
            <div class="info-label">สาขา</div>
            <div class="info-value">
              {{ posStore.selectedPos?.branch_name || posStore.selectedPos?.branch_code || '-' }}
            </div>
          </div>
        </div>

        <div v-if="posStore.selectedPos?.pos_ic_wht" class="pos-info-row">
          <i class="pi pi-warehouse info-icon" />
          <div>
            <div class="info-label">คลัง</div>
            <div class="info-value">
              {{ posStore.selectedPos?.wh_name || posStore.selectedPos?.pos_ic_wht }}
            </div>
          </div>
        </div>

        <div v-if="posStore.selectedPos?.pos_ic_shelf" class="pos-info-row">
          <i class="pi pi-th-large info-icon" />
          <div>
            <div class="info-label">ที่เก็บ</div>
            <div class="info-value">
              {{ posStore.selectedPos?.shelf_name || posStore.selectedPos?.pos_ic_shelf }}
            </div>
          </div>
        </div>

        <Button
          label="เปลี่ยนเครื่อง POS"
          icon="pi pi-refresh"
          severity="secondary"
          outlined
          size="small"
          @click="router.push('/select-pos?change=true')"
        />
      </div>
    </template>
  </Card>
</template>

<style scoped>
.pos-info {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.pos-info-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.info-icon {
  font-size: 1.25rem;
  color: var(--p-primary-color);
  width: 1.5rem;
  text-align: center;
  flex-shrink: 0;
}

.info-label {
  font-size: 0.75rem;
  color: var(--p-text-color-secondary);
  margin-bottom: 0.125rem;
}

.info-value {
  font-weight: 500;
}
</style>
