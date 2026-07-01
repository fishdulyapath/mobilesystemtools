<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import api from '@/services/api'
import { getEmployeePermissions, getPermissionList, setEmployeePermissions } from '@/services/permissionService'

const toast = useToast()

const search = ref('')
const employees = ref([])
const employeeLoading = ref(false)
const selectedEmployee = ref(null)
const permissionList = ref([])
const checked = ref([])
const loadingPermissions = ref(false)
const saving = ref(false)
const errorMsg = ref('')
let searchTimer = null
let suppressEmployeeSearch = false

const permissionGroups = computed(() => {
  const groups = [
    { key: 'permission', title: 'กำหนดสิทธิ์', icon: 'pi pi-lock', items: [] },
    { key: 'dashboard', title: 'แดชบอร์ด', icon: 'pi pi-home', items: [] },
    { key: 'sell', title: 'ขายสินค้า', icon: 'pi pi-shopping-cart', items: [] },
    { key: 'inventory', title: 'คลังสินค้า', icon: 'pi pi-box', items: [] },
    { key: 'sales', title: 'ประวัติการขาย', icon: 'pi pi-history', items: [] },
    { key: 'sales_return', title: 'รับคืนสินค้า/ลดหนี้', icon: 'pi pi-undo', items: [] },
    { key: 'ar_documents', title: 'เอกสารลูกหนี้', icon: 'pi pi-wallet', items: [] },
    { key: 'cash', title: 'ค่าใช้จ่าย', icon: 'pi pi-receipt', items: [] },
    { key: 'sold_out', title: 'สินค้าขายหมด', icon: 'pi pi-exclamation-circle', items: [] },
    { key: 'purchase', title: 'ซื้อสินค้า', icon: 'pi pi-file-import', items: [] },
    { key: 'product', title: 'จัดการสินค้า', icon: 'pi pi-tag', items: [] },
  ]
  const byKey = Object.fromEntries(groups.map((g) => [g.key, g]))
  const arDocumentKeys = new Set([
    'sales.advance_payment.view',
    'sales.advance_payment.create',
    'sales.ar_billing.view',
    'sales.ar_billing.create',
    'sales.ar_debt_payment.view',
    'sales.ar_debt_payment.create',
  ])
  for (const item of permissionList.value) {
    const groupKey = arDocumentKeys.has(item.key)
      ? 'ar_documents'
      : item.key.startsWith('sales.return.')
        ? 'sales_return'
        : item.key.split('.')[0]
    if (byKey[groupKey]) byKey[groupKey].items.push(item)
  }
  return groups.filter((group) => group.items.length > 0)
})

watch(search, (value) => {
  clearTimeout(searchTimer)
  if (suppressEmployeeSearch) {
    suppressEmployeeSearch = false
    return
  }
  if (!value.trim()) {
    employees.value = []
    return
  }
  searchTimer = setTimeout(loadEmployees, 300)
})

async function loadEmployees() {
  employeeLoading.value = true
  try {
    const { data } = await api.get('/getEmployeeList', { params: { search: search.value.trim() } })
    employees.value = data.data || []
  } catch {
    employees.value = []
  } finally {
    employeeLoading.value = false
  }
}

async function selectEmployee(employee) {
  selectedEmployee.value = employee
  suppressEmployeeSearch = true
  search.value = `${employee.code} ${employee.name}`
  employees.value = []
  await loadEmployeePermissions()
}

async function loadEmployeePermissions() {
  if (!selectedEmployee.value) return
  loadingPermissions.value = true
  errorMsg.value = ''
  try {
    checked.value = await getEmployeePermissions(selectedEmployee.value.code)
  } catch (err) {
    errorMsg.value = err.message
    checked.value = []
  } finally {
    loadingPermissions.value = false
  }
}

function isGroupChecked(group) {
  return group.items.every((item) => checked.value.includes(item.key))
}

function toggleGroup(group) {
  const keys = group.items.map((item) => item.key)
  if (isGroupChecked(group)) {
    checked.value = checked.value.filter((key) => !keys.includes(key))
  } else {
    checked.value = Array.from(new Set([...checked.value, ...keys]))
  }
}

async function save() {
  if (!selectedEmployee.value) return
  saving.value = true
  try {
    const res = await setEmployeePermissions(selectedEmployee.value.code, checked.value)
    if (res.success) {
      toast.add({ severity: 'success', summary: 'บันทึกสิทธิ์สำเร็จ', life: 2500 })
    } else {
      toast.add({ severity: 'error', summary: 'บันทึกไม่สำเร็จ', detail: res.msg, life: 3000 })
    }
  } catch (err) {
    toast.add({ severity: 'error', summary: 'บันทึกไม่สำเร็จ', detail: err.message, life: 3000 })
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    permissionList.value = await getPermissionList()
  } catch (err) {
    errorMsg.value = err.message
  }
})
</script>

<template>
  <div class="permission-page">
    <div class="page-header">
      <h1 class="page-title">กำหนดสิทธิ์ผู้ใช้</h1>
      <Button label="บันทึก" icon="pi pi-save" :loading="saving" :disabled="!selectedEmployee" @click="save" />
    </div>

    <div class="search-panel">
      <label class="field-label">พนักงาน</label>
      <div class="search-wrap">
        <InputText v-model="search" placeholder="ค้นหารหัส / ชื่อพนักงาน" class="search-input" />
        <i v-if="employeeLoading" class="pi pi-spinner pi-spin search-spinner" />
      </div>
      <div v-if="employees.length" class="employee-list">
        <button v-for="emp in employees" :key="emp.code" class="employee-option" @click="selectEmployee(emp)">
          <span class="employee-code">{{ emp.code }}</span>
          <span class="employee-name">{{ emp.name }}</span>
        </button>
      </div>
      <div v-if="selectedEmployee" class="selected-user">
        <i class="pi pi-user" />
        {{ selectedEmployee.code }} - {{ selectedEmployee.name }}
      </div>
    </div>

    <Message v-if="errorMsg" severity="error" :closable="false">{{ errorMsg }}</Message>

    <div v-if="!selectedEmployee" class="empty-state">
      เลือกพนักงานเพื่อกำหนดสิทธิ์
    </div>

    <div v-else-if="loadingPermissions" class="empty-state">
      <i class="pi pi-spinner pi-spin" />
      กำลังโหลดสิทธิ์
    </div>

    <div v-else class="permission-grid">
      <section v-for="group in permissionGroups" :key="group.key" class="permission-card">
        <div class="group-header">
          <div class="group-title">
            <i :class="group.icon" />
            <span>{{ group.title }}</span>
          </div>
          <Button
            :label="isGroupChecked(group) ? 'ยกเลิกทั้งกลุ่ม' : 'เลือกทั้งกลุ่ม'"
            text
            size="small"
            @click="toggleGroup(group)"
          />
        </div>
        <label v-for="item in group.items" :key="item.key" class="permission-row">
          <Checkbox v-model="checked" :input-id="item.key" :value="item.key" />
          <span>{{ item.label }}</span>
        </label>
      </section>
    </div>
  </div>
</template>

<style scoped>
.permission-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 1000px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.page-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
}

.search-panel,
.permission-card {
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  padding: 1rem;
}

.field-label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--p-text-color-secondary);
  margin-bottom: 0.5rem;
}

.search-wrap {
  position: relative;
}

.search-input {
  width: 100%;
}

.search-spinner {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--p-text-color-secondary);
}

.employee-list {
  margin-top: 0.5rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  overflow: hidden;
}

.employee-option {
  width: 100%;
  border: 0;
  background: transparent;
  display: flex;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  cursor: pointer;
  text-align: left;
}

.employee-option:hover {
  background: var(--p-surface-hover);
}

.employee-code {
  font-weight: 700;
  min-width: 80px;
}

.employee-name {
  color: var(--p-text-color-secondary);
}

.selected-user {
  margin-top: 0.75rem;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--p-text-color-secondary);
}

.permission-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.group-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 700;
}

.permission-row {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem 0;
  cursor: pointer;
}

@media (max-width: 768px) {
  .page-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .permission-grid {
    grid-template-columns: 1fr;
  }
}
</style>
