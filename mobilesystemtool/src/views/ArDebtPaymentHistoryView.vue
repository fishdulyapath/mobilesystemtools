<script setup>
import { computed, onMounted, ref, watch } from "vue";
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
import { useToast } from "primevue/usetoast";
import { useRouter } from "vue-router";
import {
  getArDebtPaymentDetail,
  getArDebtPaymentList,
  getArDebtPaymentPrintForms,
  getArDebtPaymentPrintUrl,
} from "@/services/arDebtPaymentService";
import { deleteDocImage, getDocImageUrl, getDocImagesList, saveDocImage } from "@/services/docImageService";
import { useAuthStore } from "@/stores/auth";
import { formatCurrency, formatDate, todayISO, toISO } from "@/utils/formatters";
import { scrollReportToTop } from "@/utils/pageScroll";
import { PERMISSIONS } from "@/utils/permissions";

const authStore = useAuthStore();
const toast = useToast();
const router = useRouter();

const presetOptions = [
  { label: "วันนี้", value: "today" },
  { label: "7 วัน", value: "7d" },
  { label: "30 วัน", value: "30d" },
  { label: "กำหนดเอง", value: "custom" },
];

const rows = ref([]);
const loading = ref(false);
const search = ref("");
const preset = ref("today");
const dateRange = ref(null);
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

const canCreate = computed(() => authStore.hasPermission(PERMISSIONS.salesArDebtPaymentCreate));
const totalAmount = computed(() => rows.value.reduce((sum, row) => sum + toMoney(row.total_amount), 0));
const discountAmount = computed(() => rows.value.reduce((sum, row) => sum + toMoney(row.discount_amount), 0));
const cashAmount = computed(() => rows.value.reduce((sum, row) => sum + toMoney(row.cash_amount), 0));
const transferAmount = computed(() => rows.value.reduce((sum, row) => sum + toMoney(row.tranfer_amount), 0));
const detailHeader = computed(() => selectedDetail.value?.header || {});
const detailRows = computed(() => selectedDetail.value?.details || []);
const detailDiscountAmount = computed(() => toMoney(detailHeader.value?.discount_amount));
const detailPaymentSummaryRows = computed(() => paymentSummaryRows(selectedDetail.value?.payment));
const detailPaymentRows = computed(() => paymentDetailRows(selectedDetail.value?.payment_detail));

onMounted(() => {
  loadHistory(buildParams());
});

watch(preset, (value) => {
  if (value !== "custom") {
    dateRange.value = null;
    search.value = "";
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

function notify(severity, summary, detail) {
  toast.add({ severity, summary, detail, life: 4200 });
}

function paymentTypeName(type) {
  const map = {
    1: "โอน",
    2: "เช็ค",
    3: "บัตร",
    4: "เงินสดย่อย",
    5: "เงินล่วงหน้า/มัดจำ",
    9: "คูปอง",
    11: "รายจ่ายอื่น",
    12: "รายได้อื่น",
    19: "ต่างสกุลเงิน",
    21: "Wallet",
  };
  return map[Number(type)] || String(type || "");
}

function paymentSummaryRows(payment = {}) {
  return [
    { label: "เงินสด", amount: toMoney(payment?.cash_amount) },
    { label: "โอน", amount: toMoney(payment?.tranfer_amount) },
    { label: "บัตรเครดิต", amount: toMoney(payment?.card_amount) },
    { label: "รับเงินล่วงหน้า", amount: toMoney(payment?.deposit_amount) },
  ].filter((row) => row.amount > 0);
}

function paymentDetailRows(rows = []) {
  return (Array.isArray(rows) ? rows : []).filter((row) => [1, 3, 5].includes(Number(row.doc_type)) && toMoney(row.amount) > 0);
}

function statusLabel(row) {
  if (Number(row?.last_status || row?.is_cancel || 0) === 1) return "ยกเลิก";
  return "ปกติ";
}

function statusClass(row) {
  if (Number(row?.last_status || row?.is_cancel || 0) === 1) return "danger";
  return "success";
}

function buildParams() {
  const searchText = search.value.trim();
  const today = todayISO();
  if (searchText) return { search: searchText, fromdate: "", todate: "" };
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
  try {
    rows.value = await getArDebtPaymentList({
      ...params,
      limit: 250,
      user_code: currentUserCode(),
    });
  } catch (ex) {
    notify("error", "โหลดประวัติรับชำระหนี้ไม่สำเร็จ", ex.message);
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
  try {
    const [detail] = await Promise.all([
      getArDebtPaymentDetail(row.doc_no, currentUserCode()),
      loadDocImages(row.doc_no),
    ]);
    selectedDetail.value = detail;
  } catch (ex) {
    notify("error", "เปิดเอกสารรับชำระหนี้ไม่สำเร็จ", ex.message);
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
    const result = await getArDebtPaymentPrintForms(docNo, currentUserCode());
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
  const url = getArDebtPaymentPrintUrl(docNo, selectedPrintForms.value, currentUserCode());
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
    const result = await deleteDocImage(guidCode);
    if (!result.success) throw new Error(result.msg || "ลบรูปไม่สำเร็จ");
    await loadDocImages();
    confirmDeleteVisible.value = false;
    pendingDeleteImage.value = null;
  } catch (ex) {
    imageError.value = ex.message || "ลบรูปไม่สำเร็จ";
  }
}
</script>

<template>
  <div class="history-page">
    <div class="title-row">
      <h1 class="page-title">ประวัติรับชำระหนี้/ออกใบเสร็จรับเงิน</h1>
      <Button v-if="canCreate" icon="pi pi-plus" label="รับชำระหนี้" @click="router.push('/sales/ar-debt-payment')" />
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
          <InputText v-model="search" placeholder="ค้นหา เลขที่เอกสาร / ลูกหนี้" @input="onSearchInput" @keyup.enter="doSearch" />
        </IconField>

        <Button icon="pi pi-search" label="ค้นหา" :loading="loading" @click="doSearch" />
      </div>
    </div>

    <div class="summary-bar">
      <span class="summary-count">{{ rows.length }} รายการ</span>
      <span class="summary-divider" />
      <span class="summary-label">ยอดรับชำระ</span>
      <span class="summary-amount">{{ formatCurrency(totalAmount) }}</span>
      <span class="summary-divider summary-extra" />
      <span class="summary-meta summary-extra">ส่วนลด -{{ formatCurrency(discountAmount) }}</span>
      <span class="summary-meta summary-extra">เงินสด {{ formatCurrency(cashAmount) }}</span>
      <span class="summary-meta summary-extra">โอน {{ formatCurrency(transferAmount) }}</span>
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
      class="history-table"
      @page="scrollReportToTop"
      @row-click="openDetail($event.data)"
    >
        <template #empty>
          <div class="empty-msg">ไม่พบข้อมูล</div>
        </template>

        <Column field="doc_no" header="เลขที่" />
        <Column field="doc_date" header="วันที่">
          <template #body="{ data }">{{ formatDate(data.doc_date) }}</template>
        </Column>
        <Column field="cust_code" header-class="history-extra-col" body-class="history-extra-col" header="รหัสลูกหนี้" />
        <Column field="cust_name" header="ลูกหนี้"  style="white-space: nowrap" />
        <Column field="total_amount" header="ยอดรับชำระ">
          <template #body="{ data }">{{ formatCurrency(data.total_amount) }}</template>
        </Column>
        <Column field="discount_amount" header="ส่วนลด">
          <template #body="{ data }">
            <div class="discount-list-cell">
              <strong v-if="toMoney(data.discount_amount) > 0">-{{ formatCurrency(data.discount_amount) }}</strong>
              <span v-else>-</span>
              <small v-if="data.discount_word">{{ data.discount_word }}</small>
            </div>
          </template>
        </Column>
      
        <Column field="remark" header-class="history-extra-col" body-class="history-extra-col" header="หมายเหตุ" />
    </DataTable>

    <Dialog
      v-model:visible="detailDialogVisible"
      modal
      :draggable="false"
      dismissable-mask
      maximizable
      :style="{ width: 'min(940px, 96vw)' }"
    >
      <template #header>
        <div class="modal-header">
          <div class="header-left">
            <span class="doc-no">{{ detailHeader.doc_no || "รายละเอียดรับชำระหนี้" }}</span>
            <span class="doc-date">{{ formatDate(detailHeader.doc_date) }} {{ detailHeader.doc_time }}</span>
          </div>
          <Button label="พิมพ์ฟอร์ม" icon="pi pi-print" size="small" outlined @click="openPrintDialog" />
        </div>
      </template>

      <div v-if="detailLoading" class="dialog-state">
        <ProgressSpinner style="width: 40px; height: 40px" />
      </div>
      <div v-else-if="selectedDetail" class="detail-dialog">

        <div class="detail-meta">
          <span>{{ selectedDetail.header?.cust_code }}</span>
          <span>{{ selectedDetail.header?.cust_name }}</span>
          <strong>{{ formatCurrency(selectedDetail.header?.total_amount) }}</strong>
        </div>

        <div class="badge-row">
          <span class="status-pill" :class="statusClass(detailHeader)">{{ statusLabel(detailHeader) }}</span>
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
              <button type="button" class="proof-remove" aria-label="ลบรูป" @click="askDeleteImage(image)">
                <i class="pi pi-trash" />
              </button>
            </div>
          </div>
          <div v-else class="proof-empty">ยังไม่มีรูปหลักฐาน</div>
        </div>

        <section class="ref-box" v-if="selectedDetail.refs?.length">
          <span>ใบวางบิลอ้างอิง</span>
          <strong>{{ selectedDetail.refs.map((row) => row.billing_no).join(", ") }}</strong>
        </section>

        <DataTable :value="selectedDetail.details || []" size="small">
          <Column field="doc_ref" header="ใบวางบิล" />
          <Column field="billing_no" header="เอกสารต้นทาง" />
          <Column field="bill_type_name" header="ประเภท" />
          <Column field="balance_ref" header="ก่อนรับ">
            <template #body="{ data }">{{ formatCurrency(data.balance_ref) }}</template>
          </Column>
          <Column field="sum_pay_money" header="รับชำระ">
            <template #body="{ data }">{{ formatCurrency(data.sum_pay_money) }}</template>
          </Column>
        </DataTable>

        <section v-if="detailDiscountAmount > 0 || detailHeader.discount_word" class="discount-box">
          <div>
            <span>ส่วนลดท้ายบิล</span>
            <strong>{{ detailHeader.discount_word || "-" }}</strong>
          </div>
          <div>
            <span>มูลค่าส่วนลด</span>
            <strong>-{{ formatCurrency(detailDiscountAmount) }}</strong>
          </div>
          <div>
            <span>ยอดหลังส่วนลด</span>
            <strong>{{ formatCurrency(detailHeader.total_after_discount ?? detailHeader.total_amount) }}</strong>
          </div>
        </section>

        <div v-if="detailPaymentSummaryRows.length" class="summary-box">
          <div v-for="row in detailPaymentSummaryRows" :key="row.label">
            <span>{{ row.label }}</span>
            <strong>{{ formatCurrency(row.amount) }}</strong>
          </div>
        </div>
        <DataTable v-if="detailPaymentRows.length" :value="detailPaymentRows" size="small">
          <Column field="doc_type" header="ประเภท">
            <template #body="{ data }">{{ paymentTypeName(data.doc_type) }}</template>
          </Column>
          <Column field="trans_number" header="เลขอ้างอิง" />
          <Column field="bank_code" header="ธนาคาร" />
          <Column field="amount" header="ยอดเงิน">
            <template #body="{ data }">{{ formatCurrency(data.amount) }}</template>
          </Column>
          <Column field="charge" header="ค่าธรรมเนียม">
            <template #body="{ data }">{{ formatCurrency(data.charge) }}</template>
          </Column>
        </DataTable>
        <DataTable v-if="selectedDetail.vat_sale?.length" :value="selectedDetail.vat_sale" size="small">
          <Column field="vat_number" header="เลขใบกำกับ" />
          <Column field="vat_date" header="วันที่">
            <template #body="{ data }">{{ formatDate(data.vat_date) }}</template>
          </Column>
          <Column field="base_caltax_amount" header="ฐานภาษี">
            <template #body="{ data }">{{ formatCurrency(data.base_caltax_amount) }}</template>
          </Column>
          <Column field="tax_rate" header="อัตรา" />
          <Column field="amount" header="VAT sale">
            <template #body="{ data }">{{ formatCurrency(data.amount) }}</template>
          </Column>
        </DataTable>
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
              :input-id="`ar-debt-history-print-form-${form.formcode}`"
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
.history-page {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem 0.5rem;
  color: var(--p-text-color);
}

.title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0 0.5rem;
}

.page-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 0;
}

.filter-bar {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  background: var(--p-surface-card);
}

.filter-top,
.filter-bottom {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
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
.ref-box span,
.summary-box span,
.discount-box span {
  color: var(--p-text-color-secondary);
  font-size: 0.875rem;
}

.summary-divider {
  width: 1px;
  height: 1rem;
  background: var(--p-surface-border);
}

.summary-amount {
  margin-left: auto;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--p-primary-color);
}

.history-table {
  height: 100%;
}

.history-table :deep(tr) {
  cursor: pointer;
}

.history-table :deep(.p-datatable-table) {
  font-size: 0.9rem;
}

.history-table :deep(.p-paginator) {
  padding: 0.5rem;
}

.discount-list-cell {
  display: grid;
  gap: 0.15rem;
  min-width: 6.5rem;
}

.discount-list-cell strong {
  color: var(--p-red-600);
}

.discount-list-cell small {
  color: var(--p-text-color-secondary);
  overflow-wrap: anywhere;
}

.empty-msg {
  text-align: center;
  padding: 1rem;
  color: var(--p-text-color-secondary);
}

.dialog-state {
  min-height: 8rem;
  display: grid;
  place-items: center;
  color: var(--p-text-color-secondary);
}

.detail-dialog {
  display: grid;
  gap: 0.75rem;
}

.detail-title,
.detail-meta,
.ref-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.ref-box,
.summary-box,
.discount-box {
  padding: 0.75rem;
  border-radius: 8px;
  background: var(--p-surface-100);
}

.summary-box {
  display: grid;
  gap: 0.35rem;
}

.discount-box {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
}

.discount-box div {
  display: grid;
  gap: 0.2rem;
}

.discount-box strong {
  overflow-wrap: anywhere;
}

.summary-box div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.modal-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.doc-no {
  font-weight: 800;
  font-size: 1.05rem;
}

.doc-date,
.proof-subtitle,
.print-form-row small {
  color: var(--p-text-color-secondary);
  font-size: 0.85rem;
}

.badge-row {
  display: flex;
  justify-content: flex-start;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.2rem 0.65rem;
  font-size: 0.82rem;
  font-weight: 800;
}

.status-pill.success {
  background: #dcfce7;
  color: #166534;
}

.status-pill.danger {
  background: #fee2e2;
  color: #991b1b;
}

.proof-section {
  display: grid;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 8px;
  background: var(--p-surface-50);
  border: 1px solid var(--p-surface-border);
}

.proof-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.proof-title {
  font-weight: 900;
}

.proof-upload-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border-radius: 8px;
  padding: 0.55rem 0.75rem;
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
  font-weight: 800;
  cursor: pointer;
}

.proof-upload-btn input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.proof-upload-btn.disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.proof-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 0.65rem;
}

.proof-item {
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid var(--p-surface-border);
  background: var(--p-surface-0);
  aspect-ratio: 1 / 1;
}

.proof-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.proof-remove {
  position: absolute;
  top: 0.35rem;
  right: 0.35rem;
  width: 2rem;
  height: 2rem;
  border: 0;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(220, 38, 38, 0.92);
  color: white;
  cursor: pointer;
}

.proof-empty,
.confirm-body,
.print-loading {
  min-height: 4rem;
  display: grid;
  place-items: center;
  color: var(--p-text-color-secondary);
}

.print-dialog-body,
.print-form-list {
  display: grid;
  gap: 0.7rem;
}

.print-doc-no {
  font-weight: 900;
  text-align: center;
}

.print-form-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.65rem;
  align-items: center;
  padding: 0.65rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
}

.print-form-row.disabled {
  opacity: 0.55;
}

.print-form-row span {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

@media (max-width: 768px) {
  .history-page {
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

  .discount-box {
    grid-template-columns: 1fr;
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

  .history-table :deep(.p-datatable-table) {
    font-size: 0.85rem;
  }

  .history-table :deep(.p-paginator-bottom) {
    flex-wrap: wrap;
  }

  .history-table :deep(.p-paginator .p-paginator-rpp-options) {
    display: none;
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
  .summary-extra {
    display: none;
  }

  .modal-header,
  .proof-head {
    align-items: stretch;
    flex-direction: column;
  }

  .modal-header :deep(.p-button),
  .proof-upload-btn {
    width: 100%;
    justify-content: center;
  }

  .detail-title,
  .detail-meta {
    align-items: flex-start;
    flex-direction: column;
  }

  .proof-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .history-table :deep(.history-extra-col) {
    display: none;
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
