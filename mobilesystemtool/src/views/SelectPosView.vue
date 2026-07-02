<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { usePosStore } from '@/stores/pos'
import { useAuthStore } from '@/stores/auth'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'

const router = useRouter()
const route = useRoute()
const posStore = usePosStore()
const authStore = useAuthStore()

const loading = ref(false)
const errorMsg = ref('')
const selecting = ref(false)
const searchText = ref('')

const isChanging = computed(() => route.query.change === 'true')

const filteredList = computed(() => {
  const q = searchText.value.trim().toLowerCase()
  if (!q) return posStore.posList
  return posStore.posList.filter(
    (p) =>
      p.pos_id?.toLowerCase().includes(q) ||
      p.branch_code?.toLowerCase().includes(q) ||
      p.branch_name?.toLowerCase().includes(q) ||
      p.pos_ic_wht?.toLowerCase().includes(q) ||
      p.wh_name?.toLowerCase().includes(q) ||
      p.pos_ic_shelf?.toLowerCase().includes(q) ||
      p.shelf_name?.toLowerCase().includes(q)
  )
})

onMounted(async () => {
  loading.value = true
  try {
    await posStore.loadPosList()
  } catch (err) {
    errorMsg.value = err.message
  } finally {
    loading.value = false
  }
})

async function selectPos(pos) {
  selecting.value = true
  try {
    posStore.selectPos(pos)
    await posStore.refreshErpOption()
    router.push('/dashboard')
  } catch (err) {
    errorMsg.value = err.message
    selecting.value = false
  }
}

function logout() {
  authStore.logout()
  posStore.clearPos()
  router.push('/login')
}
</script>

<template>
  <Card class="pos-card">
    <template #header>
      <div class="pos-header">
        <Button
          class="pos-logout-btn"
          icon="pi pi-sign-out"
          label="ออกจากระบบ"
          text
          severity="secondary"
          size="small"
          @click="logout"
        />
        <div class="pos-icon">
          <img src="/fishsoft-icons/fishsoft-icon-192x192.png" alt="" />
        </div>
        <h2 class="pos-title">{{ isChanging ? 'เปลี่ยนเครื่อง POS' : 'เลือกเครื่อง POS' }}</h2>
        <p class="pos-subtitle">สวัสดี {{ authStore.employee?.user_name }}</p>
      </div>
    </template>

    <template #content>
      <Message v-if="errorMsg" severity="error" :closable="false" class="mb-3">{{ errorMsg }}</Message>

      <div v-if="loading" class="loading-center">
        <ProgressSpinner style="width: 50px; height: 50px" />
      </div>

      <template v-else>
        <IconField class="search-box">
          <InputIcon class="pi pi-search" />
          <InputText
            v-model="searchText"
            placeholder="ค้นหา รหัส POS / สาขา / คลัง"
            class="w-full"
          />
        </IconField>

        <div class="pos-list-wrap">
          <div v-if="filteredList.length === 0" class="empty-msg">
            <i class="pi pi-inbox empty-icon" />
            <span>ไม่พบเครื่อง POS</span>
          </div>

          <div
            v-for="pos in filteredList"
            :key="pos.pos_id"
            class="pos-item"
            :class="{ 'pos-item--active': posStore.selectedPos?.pos_id === pos.pos_id }"
            @click="!selecting && selectPos(pos)"
          >
            <div class="pos-item-main">
              <span class="pos-item-id">{{ pos.pos_id }}</span>
              <div class="pos-item-tags">
                <span v-if="pos.branch_code" class="pos-tag">
                  <i class="pi pi-map-marker" />
                  {{ pos.branch_name || pos.branch_code }}
                </span>
                <span v-if="pos.pos_ic_wht" class="pos-tag">
                  <i class="pi pi-warehouse" />
                  {{ pos.wh_name || pos.pos_ic_wht }}
                </span>
                <span v-if="pos.pos_ic_shelf" class="pos-tag">
                  <i class="pi pi-th-large" />
                  {{ pos.shelf_name || pos.pos_ic_shelf }}
                </span>
              </div>
            </div>
            <Button
              :label="posStore.selectedPos?.pos_id === pos.pos_id ? 'ใช้งานอยู่' : 'เลือก'"
              :icon="posStore.selectedPos?.pos_id === pos.pos_id ? 'pi pi-check' : ''"
              severity="primary"
              size="small"
              :loading="selecting"
              @click.stop="selectPos(pos)"
            />
          </div>
        </div>
      </template>
    </template>
  </Card>
</template>

<style scoped>
.pos-card {
  width: 100%;
  max-width: 480px;
  overflow: hidden;
  border-color: rgba(2, 120, 184, 0.22);
  box-shadow: var(--app-shadow-float);
}

.pos-header {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 1rem 0.75rem;
  gap: 0.25rem;
  background: linear-gradient(180deg, #eff8ff, #ffffff);
}

.pos-logout-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
}

.pos-icon {
  width: 4rem;
  height: 4rem;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #ffffff;
  border: 1px solid var(--app-blue-line);
  box-shadow: 0 10px 24px rgba(2, 120, 184, 0.14);
}

.pos-icon img {
  width: 3.45rem;
  height: 3.45rem;
  object-fit: contain;
}

.pos-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
}

.pos-subtitle {
  margin: 0;
  font-size: 0.875rem;
  color: var(--p-text-color-secondary);
}

.loading-center {
  display: flex;
  justify-content: center;
  padding: 2rem;
}

.mb-3 {
  margin-bottom: 1rem;
}

.search-box {
  width: 100%;
  margin-bottom: 0.75rem;
}

.search-box :deep(input) {
  width: 100%;
}

.pos-list-wrap {
  max-height: 360px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-right: 2px;
}

.pos-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border: 1px solid var(--app-blue-line);
  border-radius: 8px;
  cursor: pointer;
  background: #ffffff;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
  gap: 0.75rem;
}

.pos-item:hover {
  background: #f6fbff;
  border-color: var(--p-primary-300);
  box-shadow: 0 8px 22px rgba(8, 47, 73, 0.08);
}

.pos-item--active {
  border-color: var(--p-primary-color);
  background: linear-gradient(90deg, #dff1ff, #ffffff);
}

.pos-item-main {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  min-width: 0;
}

.pos-item-id {
  font-weight: 600;
  font-size: 0.95rem;
}

.pos-item-tags {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.pos-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--p-text-color-secondary);
}

.empty-msg {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem;
  color: var(--p-text-color-secondary);
}

.empty-icon {
  font-size: 2rem;
}

@media (max-width: 767px) {
  .pos-card {
    max-width: none;
    align-self: center;
  }

  .pos-header {
    padding-top: 1.5rem;
  }

  .pos-list-wrap {
    max-height: min(58vh, 440px);
  }

  .pos-item {
    align-items: stretch;
    flex-direction: column;
  }

  .pos-item :deep(.p-button) {
    width: 100%;
  }
}
</style>
