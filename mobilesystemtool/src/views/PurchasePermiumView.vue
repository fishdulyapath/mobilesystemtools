<script setup>
import { computed, onMounted, ref } from 'vue'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import DatePicker from 'primevue/datepicker'
import Message from 'primevue/message'
import { useAuthStore } from '@/stores/auth'
import {
  getPurchasePremiumList,
  getPurchasePremiumDetail,
  savePurchasePremium,
  deletePurchasePremium,
} from '@/services/purchasePermiumService'
import { getProductManageList } from '@/services/productManageService'

const authStore = useAuthStore()

// ---- state: list ----
const rows = ref([])
const loading = ref(false)
const search = ref('')
const includeInactive = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

// ---- state: editor ----
const editorVisible = ref(false)
const editorMode = ref('create') // 'create' | 'update'
const editorLoading = ref(false)
const editorSaving = ref(false)
const editorError = ref('')
const draft = ref(emptyDraft())

// ---- state: product picker ----
const productDialogVisible = ref(false)
const productDialogTarget = ref('') // 'condition' | 'list'
const productSearch = ref('')
const productResults = ref([])
const productLoading = ref(false)

// ---- state: delete confirm ----
const deleteTarget = ref(null)

function emptyDraft() {
  return {
    permium_code: '',
    name_1: '',
    date_begin: null,
    date_end: null,
    important: 0,
    remark: '',
    conditions: [emptyCondition()],
    lists: [emptyList()],
  }
}

function emptyCondition() {
  return { ic_code: '', ic_name: '', unit_code: '', unit_name: '', qty: 1 }
}

function emptyList() {
  return { ic_code: '', ic_name: '', unit_code: '', unit_name: '', qty: 1 }
}

function toISODate(value) {
  if (!value) return ''
  if (typeof value === 'string') return value.slice(0, 10)
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseISODate(value) {
  if (!value) return null
  const text = typeof value === 'string' ? value.slice(0, 10) : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null
  const d = new Date(`${text}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

const isFormValid = computed(() => {
  if (!draft.value.permium_code.trim()) return false
  if (!draft.value.name_1.trim()) return false
  if (!draft.value.conditions.length) return false
  if (!draft.value.lists.length) return false
  const badCond = draft.value.conditions.some((row) => !row.ic_code || !row.unit_code || Number(row.qty) <= 0)
  const badList = draft.value.lists.some((row) => !row.ic_code || !row.unit_code || Number(row.qty) <= 0)
  return !badCond && !badList
})

async function loadList() {
  loading.value = true
  errorMsg.value = ''
  try {
    rows.value = await getPurchasePremiumList({
      search: search.value.trim(),
      include_inactive: includeInactive.value,
    })
  } catch (err) {
    errorMsg.value = err.message || 'โหลดรายการไม่สำเร็จ'
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editorMode.value = 'create'
  draft.value = emptyDraft()
  editorError.value = ''
  editorVisible.value = true
}

async function openEdit(row) {
  editorMode.value = 'update'
  editorVisible.value = true
  editorLoading.value = true
  editorError.value = ''
  try {
    const detail = await getPurchasePremiumDetail(row.permium_code)
    draft.value = {
      permium_code: detail.permium_code || '',
      name_1: detail.name_1 || '',
      date_begin: parseISODate(detail.date_begin),
      date_end: parseISODate(detail.date_end),
      important: Number(detail.important ?? 0) === 1 ? 1 : 0,
      remark: detail.remark || '',
      conditions: (detail.conditions && detail.conditions.length)
        ? detail.conditions.map((c) => ({
          ic_code: c.ic_code || '',
          ic_name: c.ic_name || '',
          unit_code: c.unit_code || '',
          unit_name: c.unit_name || '',
          qty: Number(c.qty) || 1,
        }))
        : [emptyCondition()],
      lists: (detail.lists && detail.lists.length)
        ? detail.lists.map((l) => ({
          ic_code: l.ic_code || '',
          ic_name: l.ic_name || '',
          unit_code: l.unit_code || '',
          unit_name: l.unit_name || '',
          qty: Number(l.qty) || 1,
        }))
        : [emptyList()],
    }
  } catch (err) {
    editorError.value = err.message || 'โหลดเงื่อนไขไม่สำเร็จ'
  } finally {
    editorLoading.value = false
  }
}

function addCondition() {
  draft.value.conditions.push(emptyCondition())
}

function removeCondition(index) {
  if (draft.value.conditions.length <= 1) return
  draft.value.conditions.splice(index, 1)
}

function addList() {
  draft.value.lists.push(emptyList())
}

function removeList(index) {
  if (draft.value.lists.length <= 1) return
  draft.value.lists.splice(index, 1)
}

// ---- product picker ----
async function openProductPicker(target) {
  productDialogTarget.value = target
  productSearch.value = ''
  productResults.value = []
  productDialogVisible.value = true
}

async function searchProducts() {
  const keyword = productSearch.value.trim()
  if (!keyword) {
    productResults.value = []
    return
  }
  productLoading.value = true
  try {
    const result = await getProductManageList({ search: keyword, offset: 0, limit: 30 })
    productResults.value = result.data || []
  } catch {
    productResults.value = []
  } finally {
    productLoading.value = false
  }
}

function selectProduct(product) {
  const target = productDialogTarget.value
  const targetArr = target === 'condition' ? draft.value.conditions : draft.value.lists
  // ใส่ในแถวสุดท้ายที่ว่าง หรือเพิ่มแถวใหม่
  let row = targetArr[targetArr.length - 1]
  if (!row || (row.ic_code && row.ic_code !== product.code)) {
    row = target === 'condition' ? emptyCondition() : emptyList()
    targetArr.push(row)
    row = targetArr[targetArr.length - 1]
  }
  row.ic_code = product.code || product.item_code || ''
  row.ic_name = product.name_1 || product.item_name || ''
  row.unit_code = product.unit_standard || product.unit_code || ''
  row.unit_name = product.unit_standard || row.unit_code
  productDialogVisible.value = false
}

// ---- save ----
async function saveDraft() {
  if (!isFormValid.value) {
    editorError.value = 'กรุณากรอกข้อมูลให้ครบ: รหัส, ชื่อ, เงื่อนไขซื้อ และของแถม (อย่างน้อยอย่างละ 1 รายการ)'
    return
  }
  editorSaving.value = true
  editorError.value = ''
  try {
    const payload = {
      mode: editorMode.value,
      permium_code: draft.value.permium_code.trim(),
      name_1: draft.value.name_1.trim(),
      date_begin: toISODate(draft.value.date_begin),
      date_end: toISODate(draft.value.date_end),
      important: draft.value.important,
      remark: draft.value.remark || '',
      conditions: draft.value.conditions.map((row) => ({
        ic_code: row.ic_code,
        ic_name: row.ic_name,
        unit_code: row.unit_code,
        unit_name: row.unit_name,
        qty: Number(row.qty) || 0,
      })),
      lists: draft.value.lists.map((row) => ({
        ic_code: row.ic_code,
        ic_name: row.ic_name,
        unit_code: row.unit_code,
        unit_name: row.unit_name,
        qty: Number(row.qty) || 0,
      })),
      emp_code: authStore.employee?.user_code || '',
    }
    await savePurchasePremium(payload)
    successMsg.value = `${editorMode.value === 'create' ? 'สร้าง' : 'แก้ไข'}เงื่อนไข "${payload.permium_code}" สำเร็จ`
    editorVisible.value = false
    await loadList()
  } catch (err) {
    editorError.value = err.message || 'บันทึกไม่สำเร็จ'
  } finally {
    editorSaving.value = false
  }
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  try {
    await deletePurchasePremium(deleteTarget.value.permium_code)
    successMsg.value = `ลบเงื่อนไข "${deleteTarget.value.permium_code}" สำเร็จ`
    deleteTarget.value = null
    await loadList()
  } catch (err) {
    errorMsg.value = err.message || 'ลบไม่สำเร็จ'
    deleteTarget.value = null
  }
}

onMounted(loadList)
</script>

<template>
  <div class="purchase-premium-view">
    <header class="page-header">
      <div>
        <h1><i class="pi pi-gift" /> ของแถมซื้อ</h1>
        <p class="subtitle">ตั้งค่าเงื่อนไข "ซื้อสินค้าครบจำนวน → แถมสินค้า" สำหรับใช้ในหน้าซื้อสินค้า (PU)</p>
      </div>
      <Button icon="pi pi-plus" label="สร้างเงื่อนไข" severity="success" @click="openCreate" />
    </header>

    <section class="filter-bar">
      <span class="p-input-icon-left search-box">
        <i class="pi pi-search" />
        <InputText v-model="search" placeholder="ค้นหารหัส / ชื่อเงื่อนไข" @keyup.enter="loadList" />
      </span>
      <Button icon="pi pi-search" label="ค้นหา" severity="secondary" outlined :loading="loading" @click="loadList" />
      <label class="inactive-toggle">
        <input type="checkbox" v-model="includeInactive" @change="loadList" />
        รวมเงื่อนไขที่หยุดใช้งาน
      </label>
    </section>

    <Message v-if="errorMsg" severity="error" :closable="false">{{ errorMsg }}</Message>
    <Message v-if="successMsg" severity="success" :closable="true" @close="successMsg = ''">{{ successMsg }}</Message>

    <DataTable :value="rows" :loading="loading" stripedRows responsiveLayout="scroll" class="premium-table">
      <Column field="permium_code" header="รหัส" sortable />
      <Column field="name_1" header="ชื่อเงื่อนไข" sortable />
      <Column field="date_begin" header="ใช้ตั้งแต่" sortable>
        <template #body="{ data }">{{ data.date_begin || '-' }}</template>
      </Column>
      <Column field="date_end" header="ถึง" sortable>
        <template #body="{ data }">{{ data.date_end || '-' }}</template>
      </Column>
      <Column field="condition_count" header="เงื่อนไขซื้อ" sortable>
        <template #body="{ data }"><span class="num-badge">{{ data.condition_count }}</span></template>
      </Column>
      <Column field="list_count" header="ของแถม" sortable>
        <template #body="{ data }"><span class="num-badge free">{{ data.list_count }}</span></template>
      </Column>
      <Column header="สถานะ">
        <template #body="{ data }">
          <span class="status-pill" :class="{ inactive: data.important === 1 }">
            {{ data.important === 1 ? 'หยุดใช้งาน' : 'ใช้งาน' }}
          </span>
        </template>
      </Column>
      <Column header="จัดการ" style="width: 140px">
        <template #body="{ data }">
          <div class="row-actions">
            <Button icon="pi pi-pencil" text rounded severity="info" aria-label="แก้ไข" @click="openEdit(data)" />
            <Button icon="pi pi-trash" text rounded severity="danger" aria-label="ลบ" @click="deleteTarget = data" />
          </div>
        </template>
      </Column>
      <template #empty>
        <div class="empty-row">ยังไม่มีเงื่อนไขของแถม — กด "สร้างเงื่อนไข" เพื่อเพิ่ม</div>
      </template>
    </DataTable>

    <!-- Editor dialog -->
    <Dialog v-model:visible="editorVisible" modal :header="editorMode === 'create' ? 'สร้างเงื่อนไขของแถม' : `แก้ไข ${draft.permium_code}`" :style="{ width: '900px', maxWidth: '96vw' }" :closable="!editorSaving">
      <div v-if="editorLoading" class="dialog-loading">กำลังโหลด…</div>
      <div v-else class="editor-body">
        <Message v-if="editorError" severity="error" :closable="false">{{ editorError }}</Message>

        <section class="form-section">
          <h3>ข้อมูลเงื่อนไข</h3>
          <div class="form-grid">
            <div class="form-field">
              <label>รหัสเงื่อนไข *</label>
              <InputText v-model.trim="draft.permium_code" :disabled="editorMode === 'update'" placeholder="เช่น PROMO001" />
            </div>
            <div class="form-field">
              <label>ชื่อเงื่อนไข *</label>
              <InputText v-model.trim="draft.name_1" placeholder="เช่น ซื้อ 10 แถม 1" />
            </div>
            <div class="form-field">
              <label>ใช้ตั้งแต่</label>
              <DatePicker v-model="draft.date_begin" dateFormat="yy-mm-dd" showIcon />
            </div>
            <div class="form-field">
              <label>ถึง</label>
              <DatePicker v-model="draft.date_end" dateFormat="yy-mm-dd" showIcon />
            </div>
            <div class="form-field form-field-wide">
              <label>หมายเหตุ</label>
              <InputText v-model.trim="draft.remark" />
            </div>
            <div class="form-field">
              <label class="inline-check">
                <input type="checkbox" :checked="draft.important === 1" @change="draft.important = $event.target.checked ? 1 : 0" />
                หยุดใช้งาน
              </label>
            </div>
          </div>
        </section>

        <section class="form-section">
          <div class="section-header">
            <h3><i class="pi pi-shopping-cart" /> สินค้าที่ต้องซื้อ (เงื่อนไข) *</h3>
            <div class="section-actions">
              <Button icon="pi pi-search" label="เลือกสินค้า" size="small" severity="info" outlined @click="openProductPicker('condition')" />
              <Button icon="pi pi-plus" label="เพิ่มแถว" size="small" severity="secondary" outlined @click="addCondition" />
            </div>
          </div>
          <table class="mini-table">
            <thead>
              <tr>
                <th>รหัสสินค้า</th>
                <th>ชื่อสินค้า</th>
                <th>หน่วย</th>
                <th class="num">จำนวนที่ต้องซื้อ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, idx) in draft.conditions" :key="`cond-${idx}`">
                <td><InputText v-model.trim="row.ic_code" class="mini-input" /></td>
                <td><InputText v-model.trim="row.ic_name" class="mini-input name" /></td>
                <td><InputText v-model.trim="row.unit_code" class="mini-input unit" /></td>
                <td class="num"><InputNumber v-model="row.qty" :min="0" :step="1" :maxFractionDigits="4" class="qty-input" /></td>
                <td>
                  <Button icon="pi pi-trash" text rounded severity="danger" size="small" :disabled="draft.conditions.length <= 1" @click="removeCondition(idx)" />
                </td>
              </tr>
            </tbody>
          </table>
          <p class="hint">ระบบจะคำนวณ "จำนวนชุดที่ได้" = min(ยอดซื้อ ÷ จำนวนที่ต้องซื้อ) ของทุกแถว</p>
        </section>

        <section class="form-section">
          <div class="section-header">
            <h3><i class="pi pi-gift" /> สินค้าที่แถม *</h3>
            <div class="section-actions">
              <Button icon="pi pi-search" label="เลือกสินค้า" size="small" severity="info" outlined @click="openProductPicker('list')" />
              <Button icon="pi pi-plus" label="เพิ่มแถว" size="small" severity="secondary" outlined @click="addList" />
            </div>
          </div>
          <table class="mini-table">
            <thead>
              <tr>
                <th>รหัสสินค้า</th>
                <th>ชื่อสินค้า</th>
                <th>หน่วย</th>
                <th class="num">จำนวนที่แถม/ชุด</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, idx) in draft.lists" :key="`list-${idx}`" class="free-row">
                <td><InputText v-model.trim="row.ic_code" class="mini-input" /></td>
                <td><InputText v-model.trim="row.ic_name" class="mini-input name" /></td>
                <td><InputText v-model.trim="row.unit_code" class="mini-input unit" /></td>
                <td class="num"><InputNumber v-model="row.qty" :min="0" :step="1" :maxFractionDigits="4" class="qty-input" /></td>
                <td>
                  <Button icon="pi pi-trash" text rounded severity="danger" size="small" :disabled="draft.lists.length <= 1" @click="removeList(idx)" />
                </td>
              </tr>
            </tbody>
          </table>
          <p class="hint">จำนวนของแถมจริง = "จำนวนที่แถม/ชุด" × "จำนวนชุดที่ได้"</p>
        </section>
      </div>
      <template #footer>
        <Button label="ยกเลิก" severity="secondary" outlined :disabled="editorSaving" @click="editorVisible = false" />
        <Button :label="editorMode === 'create' ? 'สร้าง' : 'บันทึก'" icon="pi pi-check" :loading="editorSaving" :disabled="!isFormValid" @click="saveDraft" />
      </template>
    </Dialog>

    <!-- Product picker dialog -->
    <Dialog v-model:visible="productDialogVisible" modal header="เลือกสินค้า" :style="{ width: '600px', maxWidth: '96vw' }">
      <div class="product-picker">
        <span class="p-input-icon-left picker-search">
          <i class="pi pi-search" />
          <InputText v-model.trim="productSearch" placeholder="ค้นหารหัส / ชื่อสินค้า" @keyup.enter="searchProducts" />
        </span>
        <Button icon="pi pi-search" label="ค้นหา" size="small" :loading="productLoading" @click="searchProducts" />
      </div>
      <div class="product-results">
        <div v-if="productLoading" class="picker-loading">กำลังค้นหา…</div>
        <div v-else-if="!productResults.length" class="picker-empty">พิมพ์คำค้นหาแล้วกดค้นหา</div>
        <div v-for="product in productResults" :key="product.code" class="product-result-row" @click="selectProduct(product)">
          <strong>{{ product.code }}</strong>
          <span>{{ product.name_1 }}</span>
          <span class="unit">{{ product.unit_standard || '-' }}</span>
        </div>
      </div>
    </Dialog>

    <!-- Delete confirm dialog -->
    <Dialog v-model:visible="deleteTarget" modal header="ยืนยันการลบ" :style="{ width: '420px', maxWidth: '96vw' }">
      <p v-if="deleteTarget">ต้องการลบเงื่อนไข "<strong>{{ deleteTarget.permium_code }}</strong>" ({{ deleteTarget.name_1 }}) ใช่หรือไม่?</p>
      <template #footer>
        <Button label="ยกเลิก" severity="secondary" outlined @click="deleteTarget = null" />
        <Button label="ลบ" icon="pi pi-trash" severity="danger" @click="confirmDelete" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.purchase-premium-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
}

.page-header h1 {
  margin: 0;
  font-size: 1.4rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.subtitle {
  margin: 0.25rem 0 0;
  color: var(--p-text-color-secondary);
  font-size: 0.88rem;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.search-box {
  flex: 1;
  min-width: 240px;
}

.inactive-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.86rem;
  cursor: pointer;
}

.premium-table {
  background: var(--p-content-background);
}

.num-badge {
  display: inline-block;
  min-width: 2rem;
  padding: 0.1rem 0.5rem;
  border-radius: 1rem;
  text-align: center;
  background: color-mix(in srgb, var(--p-primary-500, #3b82f6) 15%, transparent);
  color: var(--p-primary-600, #2563eb);
  font-weight: 600;
}

.num-badge.free {
  background: color-mix(in srgb, var(--p-green-500, #22c55e) 18%, transparent);
  color: var(--p-green-600, #16a34a);
}

.status-pill {
  display: inline-block;
  padding: 0.1rem 0.6rem;
  border-radius: 1rem;
  font-size: 0.78rem;
  background: color-mix(in srgb, var(--p-green-500, #22c55e) 18%, transparent);
  color: var(--p-green-600, #16a34a);
  font-weight: 600;
}

.status-pill.inactive {
  background: color-mix(in srgb, var(--p-surface-500, #6b7280) 18%, transparent);
  color: var(--p-surface-600, #4b5563);
}

.row-actions {
  display: flex;
  gap: 0.25rem;
}

.empty-row {
  padding: 2rem;
  text-align: center;
  color: var(--p-text-color-secondary);
}

/* editor */
.dialog-loading {
  padding: 2rem;
  text-align: center;
}

.editor-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-height: 70vh;
  overflow-y: auto;
}

.form-section h3 {
  margin: 0 0 0.6rem;
  font-size: 1rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.form-field-wide {
  grid-column: 1 / -1;
}

.form-field label {
  font-size: 0.82rem;
  color: var(--p-text-color-secondary);
}

.form-field label.inline-check {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  cursor: pointer;
  color: var(--p-text-color);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.section-actions {
  display: flex;
  gap: 0.4rem;
}

.mini-table {
  width: 100%;
  border-collapse: collapse;
}

.mini-table th,
.mini-table td {
  border: 1px solid var(--p-content-border-color);
  padding: 0.35rem 0.4rem;
  text-align: left;
  font-size: 0.86rem;
}

.mini-table th {
  background: var(--p-content-background);
  font-weight: 600;
}

.mini-table .num {
  text-align: right;
}

.mini-table tr.free-row {
  background: color-mix(in srgb, var(--p-green-500, #22c55e) 6%, transparent);
}

.mini-input {
  width: 100%;
}

.mini-input.name {
  min-width: 200px;
}

.mini-input.unit {
  width: 90px;
}

.qty-input {
  width: 110px;
}

.hint {
  margin: 0.4rem 0 0;
  font-size: 0.78rem;
  color: var(--p-text-color-secondary);
}

/* product picker */
.product-picker {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.picker-search {
  flex: 1;
}

.product-results {
  max-height: 360px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.picker-loading,
.picker-empty {
  padding: 1.5rem;
  text-align: center;
  color: var(--p-text-color-secondary);
}

.product-result-row {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr) 80px;
  gap: 0.5rem;
  align-items: center;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 0.4rem;
  cursor: pointer;
}

.product-result-row:hover {
  background: color-mix(in srgb, var(--p-primary-500, #3b82f6) 10%, transparent);
}

.product-result-row .unit {
  color: var(--p-text-color-secondary);
  font-size: 0.82rem;
}

@media (max-width: 640px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
