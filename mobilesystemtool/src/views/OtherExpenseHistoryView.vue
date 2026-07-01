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
import { deleteDocImage, getDocImageUrl, getDocImagesList, saveDocImage } from "@/services/docImageService";
import {
  getOtherExpenseDetail,
  getOtherExpenseList,
  getOtherExpensePrintForms,
  getOtherExpensePrintUrl,
} from "@/services/otherExpenseService";
import { useAuthStore } from "@/stores/auth";
import { formatCurrency, formatDate, todayISO, toISO } from "@/utils/formatters";
import { PERMISSIONS } from "@/utils/permissions";
import { scrollReportToTop } from "@/utils/pageScroll";

const toast = useToast();
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

const totalAmount = computed(() => rows.value.reduce((sum, row) => sum + toMoney(row.total_amount), 0));
const totalVat = computed(() => rows.value.reduce((sum, row) => sum + toMoney(row.total_vat_value), 0));
const totalWht = computed(() => rows.value.reduce((sum, row) => sum + toMoney(row.total_wht_value), 0));
const totalNetPayable = computed(() => rows.value.reduce((sum, row) => sum + toMoney(row.total_net_payable ?? row.total_amount), 0));
const activeCount = computed(() => rows.value.filter((row) => Number(row.last_status || 0) === 0).length);
const detailCount = computed(() => rows.value.reduce((sum, row) => sum + Number(row.detail_count || 0), 0));
const canCreate = computed(() => authStore.hasPermission(PERMISSIONS.cashOtherExpenseCreate));
const detailHeader = computed(() => selectedDetail.value?.header || {});
const detailPaymentSummaryRows = computed(() => paymentSummaryRows(selectedDetail.value?.payment));
const detailIsCashExpense = computed(() => [1, 2].includes(Number(detailHeader.value?.inquiry_type || 0)));

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
  errorMsg.value = "";
  try {
    rows.value = await getOtherExpenseList({
      ...params,
      limit: 300,
      user_code: currentUserCode(),
    });
  } catch (ex) {
    rows.value = [];
    errorMsg.value = ex.message || "โหลดประวัติค่าใช้จ่ายอื่นๆ ไม่สำเร็จ";
    notify("error", "โหลดประวัติค่าใช้จ่ายอื่นๆ ไม่สำเร็จ", ex.message);
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

function statusLabel(row) {
  if (Number(row?.last_status || 0) === 1) return "ยกเลิก";
  if (Number(row?.used_status || 0) === 1) return "ถูกอ้างอิง";
  return "ปกติ";
}

function statusClass(row) {
  if (Number(row?.last_status || 0) === 1) return "danger";
  if (Number(row?.used_status || 0) === 1) return "info";
  return "success";
}

function expensePreview(row) {
  const text = String(row?.expense_names || "").trim();
  return text || row?.remark || "-";
}

function inquiryTypeLabel(row) {
  const type = Number(row?.inquiry_type ?? row);
  if (type === 1) return "ค่าใช้จ่ายเงินสด";
  if (type === 2) return "ค่าใช้จ่ายเงินสด (สินค้าบริการ)";
  if (type === 3) return "ค่าใช้จ่ายเงินเชื่อ (สินค้าบริการ)";
  return "ค่าใช้จ่ายเงินเชื่อ";
}

function vatTypeLabel(row) {
  const type = Number(row?.vat_type ?? row);
  if (type === 1) return "ภาษีรวมใน";
  if (type === 2) return "ภาษีอัตราศูนย์";
  if (type === 3) return "ไม่กระทบภาษี";
  return "ภาษีแยกนอก";
}

function detailAmount(row) {
  const sumAmount = toMoney(row?.sum_amount);
  return sumAmount || toMoney(row?.amount);
}

function paymentTypeLabel(row) {
  const type = Number(row?.doc_type || 0);
  if (type === 1) return "โอน";
  if (type === 2) return "เช็ค";
  if (type === 3) return "บัตร";
  if (type === 4) return "เงินสดย่อย";
  if (type === 11) return "ค่าใช้จ่ายอื่น";
  if (type === 12) return "รายได้อื่น";
  return type ? `ประเภท ${type}` : "-";
}

function paymentSummaryRows(payment = {}) {
  if (!payment) return [];
  const rows = [
    { label: "เงินสด", amount: toMoney(payment?.cash_amount) },
    { label: "โอน", amount: toMoney(payment?.tranfer_amount) },
    { label: "เช็ค", amount: toMoney(payment?.chq_amount) },
    { label: "บัตร", amount: toMoney(payment?.card_amount) },
    { label: "หัก ณ ที่จ่าย", amount: toMoney(payment?.total_tax_at_pay) },
  ].filter((row) => row.amount > 0);
  const netAmount = toMoney(payment?.total_net_amount);
  if (netAmount > 0) rows.push({ label: "จ่ายสุทธิ", amount: netAmount });
  return rows;
}

async function openDetail(row) {
  if (!row?.doc_no) return;
  detailDialogVisible.value = true;
  detailLoading.value = true;
  selectedDetail.value = null;
  docImages.value = [];
  imageError.value = "";
  errorMsg.value = "";
  printDialogVisible.value = false;
  printError.value = "";
  printForms.value = [];
  selectedPrintForms.value = [];
  try {
    const [detail] = await Promise.all([
      getOtherExpenseDetail(row.doc_no, currentUserCode()),
      loadDocImages(row.doc_no),
    ]);
    selectedDetail.value = detail;
  } catch (ex) {
    notify("error", "เปิดเอกสารค่าใช้จ่ายไม่สำเร็จ", ex.message);
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
    const result = await getOtherExpensePrintForms(docNo, currentUserCode());
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
  const url = getOtherExpensePrintUrl(docNo, selectedPrintForms.value, currentUserCode());
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
    event.target.value = "";
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
    if (result?.success === false) throw new Error(result.msg || "ลบรูปไม่สำเร็จ");
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
  <div class="expense-history-page">
    <div class="title-row">
      <h1 class="page-title">ประวัติค่าใช้จ่ายอื่นๆ</h1>
      <Button
        v-if="canCreate"
        icon="pi pi-plus"
        label="ค่าใช้จ่ายอื่นๆ"
        class="create-button"
        @click="router.push('/cash/other-expense')"
      />
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
          <InputText v-model="search" placeholder="ค้นหา เลขที่เอกสาร / เจ้าหนี้ / รหัสค่าใช้จ่าย" @input="onSearchInput" @keyup.enter="doSearch" />
        </IconField>

        <Button icon="pi pi-search" label="ค้นหา" :loading="loading" @click="doSearch" />
      </div>
    </div>

    <Message v-if="errorMsg" severity="error" :closable="false" class="mt-1">{{ errorMsg }}</Message>

    <div class="summary-bar">
      <span class="summary-count">{{ rows.length }} รายการ</span>
      <span class="summary-divider" />
      <span class="summary-label">ยอดสุทธิ</span>
      <span class="summary-amount">{{ formatCurrency(totalAmount) }}</span>
      <span class="summary-divider summary-extra" />
      <span class="summary-meta summary-extra">WHT {{ formatCurrency(totalWht) }}</span>
      <span class="summary-meta summary-extra">จ่ายสุทธิ {{ formatCurrency(totalNetPayable) }}</span>
      <span class="summary-divider summary-extra" />
      <span class="summary-meta summary-extra">ปกติ {{ activeCount }}</span>
      <span class="summary-meta summary-extra">VAT {{ formatCurrency(totalVat) }}</span>
      <span class="summary-meta summary-extra">รายการ {{ detailCount }}</span>
    </div>

    <section class="table-panel">
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
        <Column field="cust_code" header="เจ้าหนี้" />
        <Column field="cust_name" header="ชื่อ" style="white-space: nowrap" />
        <Column header="ประเภท">
          <template #body="{ data }">{{ data.inquiry_type_name || inquiryTypeLabel(data) }}</template>
        </Column>
        <Column field="remark" header="หมายเหตุ">
          <template #body="{ data }">
            <span class="remark-cell">{{ data.remark || "-" }}</span>
          </template>
        </Column>
        <Column field="total_net_payable" header="จ่ายสุทธิ">
          <template #body="{ data }">{{ formatCurrency(data.total_net_payable ?? data.total_amount) }}</template>
        </Column>

      </DataTable>

      <div class="expense-card-list" :class="{ loading }">
        <div v-if="loading" class="card-state">กำลังโหลด...</div>
        <div v-else-if="!rows.length" class="card-state">ไม่พบประวัติค่าใช้จ่ายอื่นๆ</div>
        <button v-for="row in rows" v-else :key="row.doc_no" class="expense-card" @click="openDetail(row)">
          <div class="expense-card-head">
            <strong>{{ row.doc_no }}</strong>
            <span class="status-pill" :class="statusClass(row)">{{ statusLabel(row) }}</span>
          </div>
          <div class="expense-card-meta">
            <span>{{ formatDate(row.doc_date) }}</span>
            <span>{{ row.cust_code || "-" }} {{ row.cust_name || "" }}</span>
          </div>
          <div class="expense-card-desc">{{ row.inquiry_type_name || inquiryTypeLabel(row) }}</div>
          <div class="expense-card-desc">{{ expensePreview(row) }}</div>
          <div v-if="row.remark" class="expense-card-remark">หมายเหตุ: {{ row.remark }}</div>
          <div class="expense-card-money">
            <span>VAT {{ formatCurrency(row.total_vat_value) }} / WHT {{ formatCurrency(row.total_wht_value) }}</span>
            <strong>{{ formatCurrency(row.total_net_payable ?? row.total_amount) }}</strong>
          </div>
        </button>
      </div>
    </section>

    <Dialog
      v-model:visible="detailDialogVisible"
      modal
      :draggable="false"
      dismissable-mask
      maximizable
      :style="{ width: 'min(920px, 96vw)' }"
      :breakpoints="{ '900px': 'calc(100vw - 1rem)' }"
    >
      <template #header>
        <div class="modal-header">
          <div class="header-left">
            <span class="doc-no">{{ detailHeader.doc_no || "รายละเอียดค่าใช้จ่าย" }}</span>
            <span class="doc-date">{{ formatDate(detailHeader.doc_date) }} {{ detailHeader.doc_time || "" }}</span>
          </div>
          <Button label="พิมพ์ฟอร์ม" icon="pi pi-print" size="small" outlined :disabled="!currentDetailDocNo()" @click="openPrintDialog" />
        </div>
      </template>
      <div v-if="detailLoading" class="dialog-state">
        <ProgressSpinner style="width: 40px; height: 40px" />
      </div>
      <div v-else-if="selectedDetail" class="detail-dialog">


        <div class="detail-meta">
          <div>
            <span>เจ้าหนี้</span>
            <strong>{{ selectedDetail.header?.cust_code || "-" }} {{ selectedDetail.header?.cust_name || "" }}</strong>
          </div>
          <div>
            <span>ประเภทรายการ</span>
            <strong>{{ selectedDetail.header?.inquiry_type_name || inquiryTypeLabel(selectedDetail.header) }}</strong>
          </div>
          <div>
            <span>ประเภท VAT</span>
            <strong>{{ selectedDetail.header?.vat_type_name || vatTypeLabel(selectedDetail.header) }}</strong>
          </div>
          <div>
            <span>ใบกำกับภาษี</span>
            <strong>{{ selectedDetail.header?.tax_doc_no || "-" }}</strong>
          </div>
          <div>
            <span>ยอดสุทธิ</span>
            <strong>{{ formatCurrency(selectedDetail.header?.total_amount) }}</strong>
          </div>
        </div>

        <div class="detail-remark">
          <span>หมายเหตุ</span>
          <strong>{{ selectedDetail.header?.remark || "-" }}</strong>
        </div>

        <div class="proof-section">
          <div class="proof-head">
            <div>
              <div class="proof-title">หลักฐานการจ่ายเงิน</div>
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
                <img :src="getDocImageUrl(image.guid_code)" alt="หลักฐานการจ่ายเงิน" />
              </a>
              <button type="button" class="proof-remove" aria-label="ลบรูป" @click="askDeleteImage(image)">
                <i class="pi pi-trash" />
              </button>
            </div>
          </div>
          <div v-else class="proof-empty">ยังไม่มีรูปหลักฐาน</div>
        </div>

        <DataTable :value="selectedDetail.details || []" size="small" class="dialog-table">
          <Column field="expense_code" header="รหัสค่าใช้จ่าย" />
          <Column field="expense_name" header="ชื่อค่าใช้จ่าย" />
          <Column field="remark" header="หมายเหตุ" />
          <Column header="ยอด">
            <template #body="{ data }">{{ formatCurrency(detailAmount(data)) }}</template>
          </Column>
        </DataTable>

        <div class="summary-box">
          <div><span>มูลค่าก่อน VAT</span><strong>{{ formatCurrency(selectedDetail.header?.total_before_vat || selectedDetail.header?.total_value) }}</strong></div>
          <div><span>VAT</span><strong>{{ formatCurrency(selectedDetail.header?.total_vat_value) }}</strong></div>
          <div><span>ยอดยกเว้น VAT</span><strong>{{ formatCurrency(selectedDetail.header?.total_except_vat) }}</strong></div>
          <div><span>รวมสุทธิ</span><strong>{{ formatCurrency(selectedDetail.header?.total_amount) }}</strong></div>
        </div>

        <div v-if="detailPaymentSummaryRows.length" class="payment-section">
          <h2>การจ่ายเงิน</h2>
          <div class="summary-box">
            <div v-for="row in detailPaymentSummaryRows" :key="row.label">
              <span>{{ row.label }}</span>
              <strong>{{ formatCurrency(row.amount) }}</strong>
            </div>
          </div>
        </div>
        <div v-else-if="!detailIsCashExpense" class="payment-section">
          <h2>การจ่ายเงิน</h2>
          <div class="summary-box">
            <div><span>สถานะ</span><strong>เงินเชื่อ ไม่ต้องจ่ายเงินในเอกสารนี้</strong></div>
          </div>
        </div>

        <div v-if="selectedDetail.wht_list?.length || selectedDetail.wht_detail?.length" class="payment-section">
          <h2>หัก ณ ที่จ่าย</h2>
          <div class="payment-summary">
            <div><span>ฐานภาษี</span><strong>{{ formatCurrency(selectedDetail.wht_list?.[0]?.amount) }}</strong></div>
            <div><span>ภาษีหัก</span><strong>{{ formatCurrency(selectedDetail.wht_list?.[0]?.tax_value) }}</strong></div>
            <div><span>เลขที่หนังสือ</span><strong>{{ selectedDetail.wht_list?.[0]?.tax_doc_no || "-" }}</strong></div>
            <div><span>วันที่หัก</span><strong>{{ selectedDetail.wht_list?.[0]?.due_date ? formatDate(selectedDetail.wht_list?.[0]?.due_date) : "-" }}</strong></div>
          </div>
          <DataTable :value="selectedDetail.wht_detail || []" size="small" class="dialog-table">
            <Column field="income_type" header="ประเภทเงินได้" />
            <Column field="tax_rate" header="อัตรา">
              <template #body="{ data }">{{ Number(data.tax_rate || 0).toFixed(2) }}%</template>
            </Column>
            <Column field="amount" header="ฐานภาษี">
              <template #body="{ data }">{{ formatCurrency(data.amount) }}</template>
            </Column>
            <Column field="tax_value" header="ภาษีหัก">
              <template #body="{ data }">{{ formatCurrency(data.tax_value) }}</template>
            </Column>
            <Column field="sum_amount" header="สุทธิ">
              <template #body="{ data }">{{ formatCurrency(data.sum_amount) }}</template>
            </Column>
          </DataTable>
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
              :input-id="`other-expense-history-print-form-${form.formcode}`"
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
      <div class="confirm-body">ต้องการลบรูปหลักฐานการจ่ายเงินนี้หรือไม่</div>
      <template #footer>
        <Button label="ยกเลิก" severity="secondary" outlined @click="confirmDeleteVisible = false" />
        <Button label="ลบรูป" severity="danger" icon="pi pi-trash" @click="confirmDeleteImage" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.expense-history-page {
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

.summary-count,
.summary-label,
.summary-meta,
.detail-meta span,
.payment-summary span,
.summary-box span {
  color: var(--p-text-color-secondary);
  font-size: 0.875rem;
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

.table-panel {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.history-table {
  height: 100%;
}

.history-table :deep(.p-datatable-tbody > tr) {
  cursor: pointer;
}

.history-table :deep(.p-datatable-table) {
  font-size: 0.9rem;
}

.history-table :deep(.p-datatable-tbody > tr > td) {
  padding-top: 0.8rem;
  padding-bottom: 0.8rem;
  vertical-align: top;
}

.remark-cell {
  display: inline-block;
  max-width: 18rem;
  white-space: normal;
  overflow-wrap: anywhere;
  color: var(--p-text-color-secondary);
}

.history-table :deep(.p-paginator) {
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

.doc-date {
  font-size: 0.875rem;
  color: var(--p-text-color-secondary);
}

.empty-msg {
  text-align: center;
  padding: 1rem;
  color: var(--p-text-color-secondary);
}

.expense-card-list {
  display: none;
}

.expense-card {
  width: 100%;
  display: grid;
  gap: 0.45rem;
  padding: 0.85rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  background: var(--p-surface-0);
  color: var(--p-text-color);
  text-align: left;
  font: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.expense-card:active {
  background: var(--p-surface-100);
}

.expense-card-head,
.expense-card-meta,
.expense-card-money {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.expense-card-head strong,
.expense-card-money strong {
  font-size: 1rem;
}

.expense-card-meta,
.expense-card-desc,
.expense-card-remark,
.expense-card-money span {
  color: var(--p-text-color-secondary);
  font-size: 0.86rem;
}

.expense-card-meta span,
.expense-card-desc {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.expense-card-remark {
  overflow-wrap: anywhere;
  line-height: 1.35;
}

.card-state {
  min-height: 7rem;
  display: grid;
  place-items: center;
  color: var(--p-text-color-secondary);
}

.status-pill {
  display: inline-flex;
  align-items: center;
  min-height: 1.6rem;
  padding: 0 0.55rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;
  white-space: nowrap;
}

.status-pill.success {
  color: #047857;
  background: #d1fae5;
}

.status-pill.info {
  color: #0369a1;
  background: #e0f2fe;
}

.status-pill.danger {
  color: #b91c1c;
  background: #fee2e2;
}

.detail-dialog {
  display: grid;
  gap: 0.75rem;
  max-height: calc(100dvh - 8rem);
  overflow-y: auto;
  padding-right: 0.15rem;
}

.detail-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.detail-title > div {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
}

.detail-meta,
.payment-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.625rem;
}

.payment-summary {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.detail-meta div,
.payment-summary div,
.detail-remark {
  display: grid;
  gap: 0.2rem;
  padding: 0.7rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  background: var(--p-surface-50);
}

.detail-remark span {
  color: var(--p-text-color-secondary);
  font-size: 0.875rem;
}

.detail-remark strong {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
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

.proof-item a,
.proof-item img {
  display: block;
  width: 100%;
  height: 100%;
}

.proof-item img {
  object-fit: cover;
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

.payment-section {
  display: grid;
  gap: 0.65rem;
}

.payment-section h2 {
  margin: 0;
  font-size: 1rem;
  letter-spacing: 0;
}

.summary-box {
  display: grid;
  gap: 0.35rem;
  padding: 0.75rem;
  border-radius: 8px;
  background: var(--p-surface-100);
}

.summary-box div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.dialog-table {
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  overflow: hidden;
}

.dialog-state {
  min-height: 8rem;
  display: grid;
  place-items: center;
  color: var(--p-text-color-secondary);
}

.confirm-body {
  color: var(--p-text-color);
  line-height: 1.6;
}

.print-dialog-body,
.print-form-list {
  display: grid;
  gap: 0.75rem;
}

.print-doc-no {
  padding: 0.75rem;
  border-radius: 8px;
  background: var(--p-surface-100);
  color: var(--p-primary-color);
  font-size: 1.1rem;
  font-weight: 900;
  text-align: center;
}

.print-loading {
  min-height: 6rem;
  display: grid;
  place-items: center;
}

.print-form-row {
  min-height: 3.5rem;
  padding: 0.6rem 0.7rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.65rem;
}

.print-form-row.disabled {
  opacity: 0.55;
}

.print-form-row span {
  min-width: 0;
  display: grid;
  gap: 0.15rem;
}

.print-form-row strong,
.print-form-row small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.print-form-row small {
  color: var(--p-text-color-secondary);
}

@media (max-width: 768px) {
  .expense-history-page {
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

  .payment-summary,
  .detail-meta {
    grid-template-columns: 1fr 1fr;
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
  .history-table {
    display: none;
  }

  .expense-card-list {
    display: grid;
    gap: 0.625rem;
  }

  .summary-extra {
    display: none;
  }
}

@media (max-width: 560px) {
  .payment-summary,
  .detail-meta {
    grid-template-columns: 1fr;
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
