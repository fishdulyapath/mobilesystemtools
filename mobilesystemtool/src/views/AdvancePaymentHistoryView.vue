<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import Button from "primevue/button";
import Checkbox from "primevue/checkbox";
import Column from "primevue/column";
import DataTable from "primevue/datatable";
import DatePicker from "primevue/datepicker";
import Dialog from "primevue/dialog";
import IconField from "primevue/iconfield";
import InputIcon from "primevue/inputicon";
import InputText from "primevue/inputtext";
import Message from "primevue/message";
import ProgressSpinner from "primevue/progressspinner";
import SelectButton from "primevue/selectbutton";
import {
  getAdvancePaymentDetail,
  getAdvancePaymentList,
  getAdvancePaymentPrintForms,
  getAdvancePaymentPrintUrl,
} from "@/services/advancePaymentService";
import { deleteDocImage, getDocImageUrl, getDocImagesList, saveDocImage } from "@/services/docImageService";
import { useAuthStore } from "@/stores/auth";
import { formatCurrency, formatDate, todayISO, toISO } from "@/utils/formatters";
import { scrollReportToTop } from "@/utils/pageScroll";
import { PERMISSIONS } from "@/utils/permissions";

const router = useRouter();
const authStore = useAuthStore();

const presetOptions = [
  { label: "วันนี้", value: "today" },
  { label: "7 วัน", value: "7d" },
  { label: "30 วัน", value: "30d" },
  { label: "กำหนดเอง", value: "custom" },
];

const rows = ref([]);
const loading = ref(false);
const errorMsg = ref("");
const preset = ref("today");
const dateRange = ref(null);
const searchText = ref("");
const detailDialogVisible = ref(false);
const detailLoading = ref(false);
const selectedDetail = ref(null);
const docImages = ref([]);
const imageUploading = ref(false);
const imageError = ref("");
const confirmDeleteVisible = ref(false);
const pendingDeleteImage = ref(null);
const printDialogVisible = ref(false);
const printLoading = ref(false);
const printError = ref("");
const printForms = ref([]);
const selectedPrintForms = ref([]);

const totalAmount = computed(() => rows.value.reduce((sum, row) => sum + toMoney(row.total_amount), 0));
const canCreate = computed(() => authStore.hasPermission(PERMISSIONS.salesAdvancePaymentCreate));
const detailHeader = computed(() => selectedDetail.value?.header || {});
const detailRows = computed(() => selectedDetail.value?.details || []);

onMounted(() => {
  loadHistory(buildParams());
});

watch(preset, (value) => {
  if (value !== "custom") {
    dateRange.value = null;
    searchText.value = "";
    loadHistory(buildParams());
  }
});

watch(dateRange, (value) => {
  if (preset.value === "custom" && value?.[0] && value?.[1]) loadHistory(buildParams());
});

function toMoney(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function currentUserCode() {
  return authStore.employee?.user_code || "";
}

function buildParams() {
  const search = searchText.value.trim();
  const today = todayISO();
  if (search) return { search, fromdate: "", todate: "" };
  if (preset.value === "7d") {
    const from = new Date();
    from.setDate(from.getDate() - 6);
    return { search: "", fromdate: toISO(from), todate: today };
  }
  if (preset.value === "30d") {
    const from = new Date();
    from.setDate(from.getDate() - 29);
    return { search: "", fromdate: toISO(from), todate: today };
  }
  if (preset.value === "custom" && dateRange.value?.[0] && dateRange.value?.[1]) {
    return { search: "", fromdate: toISO(dateRange.value[0]), todate: toISO(dateRange.value[1]) };
  }
  return { search: "", fromdate: today, todate: today };
}

async function loadHistory(params = buildParams()) {
  loading.value = true;
  errorMsg.value = "";
  try {
    rows.value = await getAdvancePaymentList({
      ...params,
      limit: 300,
      user_code: currentUserCode(),
    });
  } catch (ex) {
    errorMsg.value = ex.message || "โหลดประวัติไม่สำเร็จ";
    rows.value = [];
  } finally {
    loading.value = false;
  }
}

function doSearch() {
  loadHistory(buildParams());
}

function onSearchInput(event) {
  if (!event.target.value.trim()) loadHistory(buildParams());
}

async function openDetail(row) {
  if (!row?.doc_no) return;
  detailDialogVisible.value = true;
  detailLoading.value = true;
  selectedDetail.value = null;
  docImages.value = [];
  imageError.value = "";
  printDialogVisible.value = false;
  printError.value = "";
  printForms.value = [];
  selectedPrintForms.value = [];
  errorMsg.value = "";
  try {
    const [detail] = await Promise.all([
      getAdvancePaymentDetail(row.doc_no, currentUserCode()),
      loadDocImages(row.doc_no),
    ]);
    selectedDetail.value = detail;
  } catch (ex) {
    errorMsg.value = ex.message || "เปิดเอกสารไม่สำเร็จ";
  } finally {
    detailLoading.value = false;
  }
}

function currentDetailDocNo() {
  return detailHeader.value?.doc_no || "";
}

async function loadDocImages(docNo = currentDetailDocNo()) {
  if (!docNo) {
    docImages.value = [];
    return;
  }
  docImages.value = await getDocImagesList(docNo);
}

async function openPrintDialog() {
  const docNo = currentDetailDocNo();
  if (!docNo || printLoading.value) return;
  printDialogVisible.value = true;
  printLoading.value = true;
  printError.value = "";
  printForms.value = [];
  selectedPrintForms.value = [];
  try {
    const result = await getAdvancePaymentPrintForms(docNo, currentUserCode());
    const forms = result?.forms || [];
    printForms.value = forms;
    selectedPrintForms.value = forms.filter((form) => form.available && form.is_default).map((form) => form.formcode);
    if (!selectedPrintForms.value.length) {
      selectedPrintForms.value = forms.filter((form) => form.available).slice(0, 1).map((form) => form.formcode);
    }
    if (!forms.length) {
      printError.value = "เอกสารนี้ยังไม่ได้กำหนด form_code สำหรับพิมพ์";
    } else if (!selectedPrintForms.value.length) {
      printError.value = "ไม่พบฟอร์มที่พร้อมใช้งานใน formdesign";
    }
  } catch (ex) {
    printError.value = ex.message || "โหลดฟอร์มพิมพ์ไม่สำเร็จ";
  } finally {
    printLoading.value = false;
  }
}

function confirmPrintForms() {
  const docNo = currentDetailDocNo();
  if (!docNo || !selectedPrintForms.value.length) return;
  const url = getAdvancePaymentPrintUrl(docNo, selectedPrintForms.value, currentUserCode());
  window.open(url, "_blank", "noopener");
  printDialogVisible.value = false;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function onDocImageSelected(event) {
  const docNo = currentDetailDocNo();
  const files = Array.from(event.target.files || []);
  if (!files.length || !docNo) return;
  imageUploading.value = true;
  imageError.value = "";
  try {
    for (const file of files) {
      if (!file.type.startsWith("image/")) throw new Error("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
      const imageFile = await fileToDataUrl(file);
      const result = await saveDocImage(docNo, imageFile);
      if (!result.success) throw new Error(result.msg || "บันทึกรูปไม่สำเร็จ");
    }
    await loadDocImages(docNo);
    event.target.value = "";
  } catch (ex) {
    imageError.value = ex.message || "บันทึกรูปไม่สำเร็จ";
  } finally {
    imageUploading.value = false;
  }
}

function askDeleteImage(image) {
  pendingDeleteImage.value = image;
  confirmDeleteVisible.value = true;
}

async function confirmDeleteImage() {
  const guidCode = pendingDeleteImage.value?.guid_code;
  if (!guidCode) return;
  imageError.value = "";
  try {
    await deleteDocImage(guidCode);
    await loadDocImages();
  } catch (ex) {
    imageError.value = ex.message || "ลบรูปไม่สำเร็จ";
  } finally {
    confirmDeleteVisible.value = false;
    pendingDeleteImage.value = null;
  }
}
</script>

<template>
  <div class="advance-history">
    <div class="title-row">
      <h1 class="page-title">ประวัติรับเงินล่วงหน้า</h1>
      <Button v-if="canCreate" icon="pi pi-plus" label="รับเงินล่วงหน้า" @click="router.push('/sales/advance-payment')" />
    </div>

    <div class="filter-bar">
      <div class="filter-top">
        <SelectButton v-model="preset" :options="presetOptions" option-label="label" option-value="value" :allow-empty="false" />
      </div>

      <div class="filter-bottom">
        <DatePicker
          v-if="preset === 'custom'"
          v-model="dateRange"
          selection-mode="range"
          :manual-input="false"
          date-format="dd/mm/yy"
          placeholder="เลือกช่วงวันที่"
          show-icon
          class="date-picker"
        />

        <IconField class="search-field">
          <InputIcon class="pi pi-search" />
          <InputText
            v-model="searchText"
            placeholder="ค้นหา เลขที่เอกสาร / ลูกหนี้"
            @input="onSearchInput"
            @keyup.enter="doSearch"
          />
        </IconField>

        <Button icon="pi pi-search" label="ค้นหา" :loading="loading" @click="doSearch" />
      </div>
    </div>

    <Message v-if="errorMsg" severity="error" :closable="false" class="mt-1">{{ errorMsg }}</Message>

    <div class="summary-bar">
      <span class="summary-count">{{ rows.length }} รายการ</span>
      <span class="summary-divider" />
      <span class="summary-label">ยอดรวม</span>
      <span class="summary-amount">{{ formatCurrency(totalAmount) }}</span>
    </div>

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
      class="advance-table"
      @row-click="openDetail($event.data)"
      @page="scrollReportToTop"
    >
      <template #empty>
        <div class="empty-msg">ไม่พบข้อมูล</div>
      </template>

      <Column field="doc_date" header="วันที่" :sortable="true">
        <template #body="{ data }">{{ formatDate(data.doc_date) }}</template>
      </Column>
      <Column field="doc_no" header="เลขที่เอกสาร" :sortable="true" />
      <Column field="cust_code" header="รหัสลูกหนี้" class="hidden-mobile" />
      <Column field="cust_name" header="ชื่อลูกหนี้" />
      <Column field="total_amount" header="ยอด" :sortable="true">
        <template #body="{ data }">{{ formatCurrency(data.total_amount) }}</template>
      </Column>
    </DataTable>

    <Dialog
      v-model:visible="detailDialogVisible"
      modal
      :draggable="false"
      dismissable-mask
      maximizable
      :style="{ width: 'min(920px, 96vw)' }"
    >
      <template #header>
        <div class="modal-header">
          <div class="header-left">
            <span class="doc-no">{{ detailHeader.doc_no || "รายละเอียดรับเงินล่วงหน้า" }}</span>
            <span class="doc-date">{{ formatDate(detailHeader.doc_date) }} {{ detailHeader.doc_time }}</span>
          </div>
          <Button label="พิมพ์ฟอร์ม" icon="pi pi-print" size="small" outlined @click="openPrintDialog" />
        </div>
      </template>

      <div v-if="detailLoading" class="dialog-state">
        <ProgressSpinner style="width: 40px; height: 40px" />
      </div>

      <div v-else-if="selectedDetail" class="modal-body">
        <div class="doc-meta">
          <div>
            <div class="cust-name">{{ detailHeader.cust_name || "ลูกค้าทั่วไป" }}</div>
            <div class="cust-code">{{ detailHeader.cust_code || "-" }}</div>
          </div>
          <div class="doc-total">{{ formatCurrency(detailHeader.total_amount) }}</div>
        </div>

        <div class="proof-section">
          <div class="proof-head">
            <div>
              <div class="proof-title">หลักฐานการรับชำระ</div>
              <div class="proof-subtitle">เพิ่มหรือลบรูปหลักฐานของเอกสารนี้</div>
            </div>
            <label class="proof-upload-btn" :class="{ disabled: imageUploading }">
              <i class="pi pi-upload" />
              <span>{{ imageUploading ? "กำลังบันทึก..." : "เพิ่มรูป" }}</span>
              <input type="file" accept="image/*" multiple :disabled="imageUploading" @change="onDocImageSelected" />
            </label>
          </div>
          <Message v-if="imageError" severity="error" :closable="false">{{ imageError }}</Message>
          <div v-if="docImages.length" class="proof-grid">
            <div v-for="image in docImages" :key="image.guid_code" class="proof-item">
              <a :href="getDocImageUrl(image.guid_code)" target="_blank" rel="noopener">
                <img :src="getDocImageUrl(image.guid_code)" alt="หลักฐานการรับชำระ" />
              </a>
              <button type="button" class="proof-remove" @click="askDeleteImage(image)" aria-label="ลบรูป">
                <i class="pi pi-trash" />
              </button>
            </div>
          </div>
          <div v-else class="proof-empty">ยังไม่มีรูปหลักฐาน</div>
        </div>

        <DataTable :value="detailRows" responsive-layout="stack" size="small">
          <template #empty>
            <div class="empty-msg">ไม่มีรายการรับเงิน</div>
          </template>
          <Column field="remark" header="รายการ" />
          <Column field="amount" header="ยอด">
            <template #body="{ data }">{{ formatCurrency(data.amount) }}</template>
          </Column>
        </DataTable>

        <div class="payment-summary">
          <div><span>เงินสด</span><strong>{{ formatCurrency(selectedDetail.payment?.cash_amount) }}</strong></div>
          <div><span>เงินโอน</span><strong>{{ formatCurrency(selectedDetail.payment?.tranfer_amount) }}</strong></div>
          <div><span>บัตรเครดิต</span><strong>{{ formatCurrency(selectedDetail.payment?.card_amount) }}</strong></div>
          <div v-if="Number(selectedDetail.payment?.chq_amount || 0) > 0"><span>เช็ค</span><strong>{{ formatCurrency(selectedDetail.payment?.chq_amount) }}</strong></div>
        </div>
      </div>
    </Dialog>

    <Dialog
      v-model:visible="printDialogVisible"
      modal
      header="เลือกฟอร์มสำหรับพิมพ์"
      :draggable="false"
      :style="{ width: 'min(460px, 95vw)' }"
    >
      <div class="print-dialog-body">
        <div class="print-doc-no">{{ currentDetailDocNo() }}</div>
        <div v-if="printLoading" class="print-loading">
          <ProgressSpinner style="width: 32px; height: 32px" />
        </div>
        <Message v-else-if="printError" severity="error" :closable="false">{{ printError }}</Message>
        <div v-else class="print-form-list">
          <label
            v-for="form in printForms"
            :key="form.formcode"
            class="print-form-row"
            :class="{ disabled: !form.available }"
          >
            <Checkbox
              v-model="selectedPrintForms"
              :input-id="`advance-history-print-form-${form.formcode}`"
              :value="form.formcode"
              :disabled="!form.available"
            />
            <span>
              <strong>{{ form.formname }}</strong>
              <small>{{ form.formcode }}<template v-if="!form.available"> · ไม่พบใน formdesign</template></small>
            </span>
          </label>
        </div>
      </div>
      <template #footer>
        <Button label="ยกเลิก" severity="secondary" outlined @click="printDialogVisible = false" />
        <Button label="พิมพ์" icon="pi pi-print" :disabled="printLoading || !selectedPrintForms.length" @click="confirmPrintForms" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="confirmDeleteVisible"
      modal
      header="ยืนยันการลบ"
      :draggable="false"
      :style="{ width: 'min(400px, 95vw)' }"
    >
      <div class="confirm-body">ต้องการลบรูปหลักฐานการรับชำระนี้หรือไม่</div>
      <template #footer>
        <Button label="ยกเลิก" severity="secondary" outlined @click="confirmDeleteVisible = false" />
        <Button label="ลบรูป" severity="danger" icon="pi pi-trash" @click="confirmDeleteImage" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.advance-history {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem 0.5rem;
  min-height: 100%;
}

.title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0 0.5rem;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
  letter-spacing: 0;
}

.filter-bar {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--p-surface-card);
  border-radius: 8px;
  border: 1px solid var(--p-surface-border);
}

.filter-top,
.filter-bottom {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.date-picker {
  width: 220px;
}

.search-field {
  flex: 1;
  min-width: 220px;
}

.search-field :deep(input) {
  width: 100%;
}

.mt-1 {
  margin-top: 0.25rem;
}

.summary-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 1rem;
  background: var(--p-primary-50);
  border-radius: 8px;
  border: 1px solid var(--p-primary-200);
}

.summary-count,
.summary-label,
.summary-meta,
.payment-summary span {
  font-size: 0.875rem;
  color: var(--p-text-color-secondary);
}

.summary-divider {
  width: 1px;
  height: 1rem;
  background: var(--p-surface-border);
}

.summary-amount {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--p-primary-color);
  margin-left: auto;
}

.empty-msg {
  text-align: center;
  padding: 1rem;
  color: var(--p-text-color-secondary);
}

.advance-table :deep(tr) {
  cursor: pointer;
}

.advance-table :deep(.p-datatable-table) {
  font-size: 0.9rem;
}

.advance-table :deep(.p-paginator) {
  padding: 0.5rem;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 1rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  flex-wrap: wrap;
  min-width: 0;
}

.doc-no {
  font-weight: 700;
  font-size: 1rem;
  overflow-wrap: anywhere;
}

.doc-date,
.cust-code {
  font-size: 0.875rem;
  color: var(--p-text-color-secondary);
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.doc-meta {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--p-surface-border);
}

.cust-name {
  font-weight: 700;
  overflow-wrap: anywhere;
}

.doc-total {
  font-weight: 800;
  font-size: 1.15rem;
  color: var(--p-primary-color);
  white-space: nowrap;
}

.badge-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.proof-section {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  padding: 0.75rem;
}

.proof-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.proof-title {
  font-weight: 700;
  font-size: 0.9rem;
}

.proof-subtitle {
  color: var(--p-text-color-secondary);
  font-size: 0.78rem;
  margin-top: 0.15rem;
}

.proof-upload-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  border: 1px solid var(--p-primary-color);
  border-radius: 6px;
  padding: 0.45rem 0.75rem;
  color: var(--p-primary-color);
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.proof-upload-btn.disabled {
  opacity: 0.6;
  cursor: default;
}

.proof-upload-btn input {
  display: none;
}

.proof-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
  gap: 0.625rem;
}

.proof-item {
  position: relative;
  aspect-ratio: 1;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--p-surface-ground);
}

.proof-item a {
  display: block;
  width: 100%;
  height: 100%;
}

.proof-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.proof-remove {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  width: 1.75rem;
  height: 1.75rem;
  border: none;
  border-radius: 50%;
  background: rgba(15, 23, 42, 0.72);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.proof-empty {
  text-align: center;
  color: var(--p-text-color-secondary);
  border: 1px dashed var(--p-surface-border);
  border-radius: 8px;
  padding: 1rem;
  font-size: 0.9rem;
}

.payment-summary {
  display: grid;
  gap: 0.35rem;
  padding: 0.75rem;
  border-radius: 8px;
  background: var(--p-surface-100);
}

.payment-summary div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.dialog-state {
  min-height: 10rem;
  display: grid;
  place-items: center;
  color: var(--p-text-color-secondary);
}

.confirm-body {
  color: var(--p-text-color);
  line-height: 1.6;
}

.print-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.print-doc-no {
  font-weight: 700;
  color: var(--p-text-color);
}

.print-loading {
  display: flex;
  justify-content: center;
  padding: 1rem;
}

.print-form-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.print-form-row {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  cursor: pointer;
}

.print-form-row.disabled {
  opacity: 0.55;
  cursor: default;
}

.print-form-row span {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.print-form-row strong,
.print-form-row small {
  overflow-wrap: anywhere;
}

.print-form-row small {
  color: var(--p-text-color-secondary);
}

@media (max-width: 768px) {
  .advance-history {
    gap: 0.75rem;
    padding: 0.75rem 0.25rem;
  }

  .title-row {
    align-items: stretch;
    flex-direction: column;
    padding: 0 0.25rem;
  }

  .page-title {
    font-size: 1.25rem;
  }

  .filter-bar {
    padding: 0.75rem;
    gap: 0.5rem;
  }

  .filter-top,
  .filter-bottom {
    gap: 0.5rem;
  }

  .filter-top :deep(.p-selectbutton) {
    flex: 1;
    min-width: auto;
  }

  .filter-top :deep(.p-selectbutton .p-button) {
    padding: 0.4rem 0.6rem;
    font-size: 0.8rem;
  }

  .date-picker {
    width: 100%;
    flex: 1;
  }

  .search-field {
    flex: 1;
    min-width: auto;
  }

  .filter-bottom {
    flex-direction: column;
  }

  .filter-bottom > * {
    width: 100%;
  }

  .summary-bar {
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
  }

  .summary-count,
  .summary-label,
  .summary-meta {
    font-size: 0.8rem;
  }

  .summary-amount {
    font-size: 1rem;
    margin-left: auto;
  }

  .advance-table :deep(.p-datatable-table) {
    font-size: 0.85rem;
  }

  .advance-table :deep(.p-paginator-bottom) {
    flex-wrap: wrap;
  }

  .advance-table :deep(.p-paginator .p-paginator-rpp-options) {
    display: none;
  }

  .modal-header {
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .header-left {
    width: 100%;
    gap: 0.5rem;
  }

  .modal-body {
    gap: 0.75rem;
  }

  .doc-meta {
    flex-direction: column;
    gap: 0.35rem;
  }

  .proof-head {
    align-items: stretch;
    flex-direction: column;
    gap: 0.625rem;
  }

  .proof-upload-btn {
    width: 100%;
  }
}

@media (min-width: 641px) and (max-width: 900px) {
  .filter-bar {
    padding: 0.75rem;
  }

  .filter-top :deep(.p-selectbutton) {
    flex: 0 0 auto;
  }

  .filter-bottom {
    flex-direction: row;
    align-items: center;
  }

  .filter-bottom > * {
    width: auto;
  }

  .date-picker {
    flex: 0 0 220px;
    width: 220px;
  }

  .search-field {
    flex: 1 1 0;
    min-width: 0;
  }
}

@media (max-width: 640px) {
  .hidden-mobile {
    display: none;
  }

  .advance-table :deep(.p-datatable .p-datatable-thead > tr > th) {
    padding: 0.4rem 0.2rem;
    font-size: 0.8rem;
  }

  .advance-table :deep(.p-datatable .p-datatable-tbody > tr > td) {
    padding: 0.4rem 0.2rem;
    font-size: 0.8rem;
  }
}

@media (max-width: 480px) {
  .filter-bar {
    padding: 0.5rem;
  }

  .filter-top :deep(.p-selectbutton .p-button) {
    padding: 0.3rem 0.4rem;
    font-size: 0.75rem;
  }

  .summary-bar {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
    padding: 0.5rem;
  }

  .summary-divider {
    display: none;
  }

  .summary-amount {
    margin-left: 0;
    width: 100%;
    text-align: right;
  }
}
</style>
