<script setup>
import { computed, onMounted, ref, watch } from "vue";
import Button from "primevue/button";
import Checkbox from "primevue/checkbox";
import Column from "primevue/column";
import DataTable from "primevue/datatable";
import Dialog from "primevue/dialog";
import InputNumber from "primevue/inputnumber";
import InputText from "primevue/inputtext";
import Message from "primevue/message";
import ProgressSpinner from "primevue/progressspinner";
import Select from "primevue/select";
import { useToast } from "primevue/usetoast";
import { useRouter } from "vue-router";
import { getCustomerList } from "@/services/sellService";
import {
  getArBillingDetail,
  getArBillingDocFormats,
  getArBillingList,
  getArBillingOpenDocs,
  getArBillingPrintForms,
  getArBillingPrintUrl,
  getArBillingSalesUsers,
  getNextArBillingDocNo,
  saveArBilling,
} from "@/services/arBillingService";
import { deleteDocImage, getDocImageUrl, getDocImagesList, saveDocImage } from "@/services/docImageService";
import { useAuthStore } from "@/stores/auth";
import { usePosStore } from "@/stores/pos";
import { formatCurrency, formatDate, todayISO } from "@/utils/formatters";
import { PERMISSIONS } from "@/utils/permissions";

const authStore = useAuthStore();
const posStore = usePosStore();
const toast = useToast();
const router = useRouter();

const docFormats = ref([]);
const selectedDocFormatCode = ref("");
const nextDoc = ref(null);
const docDate = ref(todayISO());
const docTime = ref(currentTime());
const creditDay = ref(0);
const dueDate = ref(todayISO());
const docRef = ref("");
const docRefDate = ref("");
const saleCode = ref(currentUserCode());
const remark = ref("");

const historyRows = ref([]);
const historySearch = ref("");
const historyLoading = ref(false);
const historyFromDate = ref(todayISO());
const historyToDate = ref(todayISO());

const customerSearch = ref("");
const customers = ref([]);
const customerLoading = ref(false);
const selectedCustomer = ref(null);
const customerDialogVisible = ref(false);
let customerTimer = null;

const salesUserSearch = ref("");
const salesUsers = ref([]);
const salesUserLoading = ref(false);
const selectedSalesUser = ref(null);
const salesUserDialogVisible = ref(false);
let salesUserTimer = null;

const openDocSearch = ref("");
const openDocs = ref([]);
const openDocsLoading = ref(false);
const selectedRows = ref([]);

const saving = ref(false);
const savedDocNo = ref("");
const detailDialogVisible = ref(false);
const detailLoading = ref(false);
const savedDetail = ref(null);
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
const currentStep = ref("document");

const canCreate = computed(() => authStore.hasPermission(PERMISSIONS.salesArBillingCreate));
const docFormatOptions = computed(() =>
  docFormats.value.map((row) => ({
    ...row,
    label: `${row.code || ""} - ${row.name_1 || ""}`.trim(),
  })),
);
const openDocRows = computed(() =>
  openDocs.value
    .filter((row) => !selectedRows.value.some((selected) => selected.billing_no === row.doc_no && selected.bill_type === row.bill_type))
    .map((row) => ({
      ...row,
      balance_ref_sort: toMoney(row.balance_ref),
    })),
);
const selectedTotal = computed(() => rnd(selectedRows.value.reduce((sum, row) => sum + toMoney(row.sum_pay_money), 0)));
const showCustomerResults = computed(() => !selectedCustomer.value && customerSearch.value.trim().length >= 2);
const salesUserDisplay = computed(() => {
  if (selectedSalesUser.value?.code) {
    return `${selectedSalesUser.value.code} - ${salesUserName(selectedSalesUser.value)}`.trim();
  }
  return saleCode.value || "";
});
const validationErrors = computed(() => {
  const errors = [];
  if (!selectedDocFormatCode.value || !nextDoc.value?.doc_no) errors.push("ไม่พบรูปแบบเลขเอกสาร ED");
  if (!selectedCustomer.value?.code) errors.push("เลือกลูกหนี้ก่อนบันทึก");
  if (!selectedRows.value.length) errors.push("เลือกเอกสารค้างวางบิลอย่างน้อย 1 รายการ");
  selectedRows.value.forEach((row, index) => {
    if (!isNonZeroAmount(row.sum_pay_money)) errors.push(`แถว ${index + 1}: ระบุยอดวางบิล`);
    if (amountExceedsBalance(row.sum_pay_money, row.balance_ref)) errors.push(`แถว ${index + 1}: ยอดวางบิลเกินคงเหลือ`);
  });
  return errors;
});
const canSave = computed(() => canCreate.value && validationErrors.value.length === 0 && !saving.value);
const steps = [
  { key: "document", label: "ข้อมูลเอกสาร", icon: "pi pi-file" },
  { key: "detail", label: "เลือกเอกสาร", icon: "pi pi-list" },
  { key: "review", label: "ตรวจสอบ", icon: "pi pi-check-square" },
  { key: "summary", label: "สรุป", icon: "pi pi-check-circle" },
];
const currentStepIndex = computed(() => Math.max(0, steps.findIndex((step) => step.key === currentStep.value)));
const isFirstStep = computed(() => currentStepIndex.value === 0);
const stepIssues = computed(() => ({
  document: [
    ...(!docDate.value ? ["เลือกวันที่เอกสารก่อน"] : []),
    ...(!selectedDocFormatCode.value || !nextDoc.value?.doc_no ? ["ไม่พบรูปแบบเลขเอกสาร ED"] : []),
    ...(!selectedCustomer.value?.code ? ["เลือกลูกหนี้ก่อน"] : []),
  ],
  detail: selectedRows.value.length ? [] : ["เลือกเอกสารค้างวางบิลอย่างน้อย 1 รายการ"],
  review: validationErrors.value,
  summary: savedDocNo.value ? [] : ["บันทึกเอกสารก่อนเข้าสู่หน้าสรุป"],
}));
const currentStepIssues = computed(() => stepIssues.value[currentStep.value] || []);
const canGoNext = computed(() => currentStep.value !== "summary" && currentStepIssues.value.length === 0);

watch(selectedDocFormatCode, () => loadNextDoc());
watch(docDate, () => {
  dueDate.value = addDaysISO(docDate.value, creditDay.value);
  loadNextDoc();
  if (selectedCustomer.value?.code) {
    selectedRows.value = [];
    loadOpenDocs();
  }
});
watch(creditDay, () => {
  if (creditDay.value < 0) creditDay.value = 0;
  dueDate.value = addDaysISO(docDate.value, creditDay.value);
});

onMounted(async () => {
  saleCode.value = currentUserCode();
  await Promise.all([loadDocFormats(), loadHistory(), loadDefaultSalesUser()]);
});

function currentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function currentUserCode() {
  return authStore.employee?.user_code || "";
}

function toMoney(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function rnd(value) {
  return Math.round(toMoney(value) * 100) / 100;
}

function isNonZeroAmount(value) {
  return Math.abs(rnd(value)) > 0.0001;
}

function sameDirectionAmount(amount, balance) {
  const amountValue = rnd(amount);
  const balanceValue = rnd(balance);
  if (!isNonZeroAmount(amountValue) || !isNonZeroAmount(balanceValue)) return false;
  return (amountValue > 0 && balanceValue > 0) || (amountValue < 0 && balanceValue < 0);
}

function amountExceedsBalance(amount, balance) {
  if (!sameDirectionAmount(amount, balance)) return true;
  return Math.abs(rnd(amount)) > Math.abs(rnd(balance)) + 0.01;
}

function amountMin(row) {
  return toMoney(row?.balance_ref) < 0 ? toMoney(row.balance_ref) : 0;
}

function amountMax(row) {
  return toMoney(row?.balance_ref) < 0 ? 0 : toMoney(row?.balance_ref);
}

function addDaysISO(dateText, days) {
  const date = new Date(`${dateText || todayISO()}T00:00:00`);
  date.setDate(date.getDate() + Number(days || 0));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function notify(severity, summary, detail) {
  toast.add({ severity, summary, detail, life: 4200 });
}

async function loadDocFormats() {
  docFormats.value = await getArBillingDocFormats({ user_code: currentUserCode() });
  selectedDocFormatCode.value = docFormats.value[0]?.code || "";
  await loadNextDoc();
}

async function loadNextDoc() {
  if (!selectedDocFormatCode.value || !docDate.value) return;
  try {
    nextDoc.value = await getNextArBillingDocNo({
      doc_format_code: selectedDocFormatCode.value,
      doc_date: docDate.value,
      user_code: currentUserCode(),
    });
  } catch {
    nextDoc.value = null;
  }
}

async function loadHistory() {
  historyLoading.value = true;
  try {
    historyRows.value = await getArBillingList({
      search: historySearch.value,
      fromdate: historyFromDate.value,
      todate: historyToDate.value,
      limit: 120,
      user_code: currentUserCode(),
    });
  } catch (ex) {
    notify("error", "โหลดประวัติไม่สำเร็จ", ex.message);
  } finally {
    historyLoading.value = false;
  }
}

function scheduleCustomerSearch() {
  clearTimeout(customerTimer);
  customerTimer = setTimeout(() => searchCustomers(), 260);
}

function handleCustomerInput() {
  if (selectedCustomer.value) clearCustomer(false);
  scheduleCustomerSearch();
}

async function searchCustomers() {
  if (customerSearch.value.trim().length < 2) {
    customers.value = [];
    return;
  }
  customerLoading.value = true;
  try {
    customers.value = await getCustomerList(customerSearch.value);
  } catch (ex) {
    notify("error", "ค้นหาลูกค้าไม่สำเร็จ", ex.message);
  } finally {
    customerLoading.value = false;
  }
}

async function selectCustomer(row) {
  selectedCustomer.value = row;
  customerSearch.value = `${row.code || ""} ${customerName(row)}`.trim();
  customerDialogVisible.value = false;
  selectedRows.value = [];
  await loadOpenDocs();
}

function customerName(row) {
  return row?.name_1 || row?.name || "";
}

function clearCustomer(clearText = true) {
  selectedCustomer.value = null;
  selectedRows.value = [];
  openDocs.value = [];
  if (clearText) customerSearch.value = "";
}

function clearCustomerSearch() {
  clearTimeout(customerTimer);
  customerSearch.value = "";
  customers.value = [];
  customerLoading.value = false;
}

function openCustomerDialog() {
  customerDialogVisible.value = true;
  if (!selectedCustomer.value) customers.value = [];
}

function salesUserName(row) {
  return row?.name_1 || row?.name || "";
}

function scheduleSalesUserSearch() {
  clearTimeout(salesUserTimer);
  salesUserTimer = setTimeout(() => searchSalesUsers(), 260);
}

async function searchSalesUsers() {
  salesUserLoading.value = true;
  try {
    salesUsers.value = await getArBillingSalesUsers({
      search: salesUserSearch.value.trim(),
      user_code: currentUserCode(),
    });
  } catch (ex) {
    notify("error", "ค้นหาพนักงานขายไม่สำเร็จ", ex.message);
  } finally {
    salesUserLoading.value = false;
  }
}

async function loadDefaultSalesUser() {
  const code = currentUserCode();
  saleCode.value = code;
  if (!code) {
    selectedSalesUser.value = null;
    return;
  }
  try {
    const rows = await getArBillingSalesUsers({ search: code, user_code: code });
    selectedSalesUser.value = rows.find((row) => String(row.code || "").toUpperCase() === code.toUpperCase()) || null;
  } catch {
    selectedSalesUser.value = null;
  }
}

async function openSalesUserDialog() {
  salesUserDialogVisible.value = true;
  salesUserSearch.value = saleCode.value || selectedSalesUser.value?.code || "";
  await searchSalesUsers();
}

function selectSalesUser(row) {
  selectedSalesUser.value = row;
  saleCode.value = row?.code || "";
  salesUserSearch.value = `${row?.code || ""} ${salesUserName(row)}`.trim();
  salesUserDialogVisible.value = false;
}

async function loadOpenDocs() {
  if (!selectedCustomer.value?.code) return;
  openDocsLoading.value = true;
  try {
    openDocs.value = await getArBillingOpenDocs({
      cust_code: selectedCustomer.value.code,
      doc_date: docDate.value,
      due_date: dueDate.value,
      branch_code: posStore.selectedPos?.branch_code || "",
      search: openDocSearch.value,
      user_code: currentUserCode(),
    });
  } catch (ex) {
    notify("error", "โหลดเอกสารค้างวางบิลไม่สำเร็จ", ex.message);
  } finally {
    openDocsLoading.value = false;
  }
}

function billTypeName(value) {
  const type = Number(value);
  if (type === 44) return "ขายเชื่อ";
  if (type === 46) return "เพิ่มหนี้";
  if (type === 48) return "ลดหนี้";
  if (type === 93) return "ตั้งหนี้ยกมา";
  if (type === 95) return "เพิ่มหนี้ยกมา";
  if (type === 97) return "ลดหนี้ยกมา";
  if (type === 99) return "ตั้งหนี้อื่น";
  if (type === 101) return "เพิ่มหนี้อื่น";
  if (type === 103) return "ลดหนี้อื่น";
  return String(value || "");
}

function addOpenDoc(row) {
  if (!row?.doc_no) return;
  if (row.ar_bill_blocked) {
    notify("warn", "ห้ามวางบิลซ้ำ", row.doc_no);
    return;
  }
  selectedRows.value.push({
    billing_no: row.doc_no,
    billing_date: row.doc_date,
    bill_type: Number(row.bill_type),
    bill_type_name: row.bill_type_name || billTypeName(row.bill_type),
    ref_doc_no: row.ref_doc_no || "",
    ref_doc_date: row.ref_doc_date || "",
    bill_tax_no: row.tax_doc_no || "",
    bill_tax_date: row.tax_doc_date || "",
    due_date: row.due_date,
    due_day: toMoney(row.due_day),
    ship_code: row.ship_code || "",
    sum_debt_amount: toMoney(row.sum_debt_amount),
    balance_ref: toMoney(row.balance_ref),
    sum_debt_amount_2: toMoney(row.sum_debt_amount_2),
    balance_ref_2: toMoney(row.balance_ref_2),
    currency_code: row.currency_code || "",
    exchange_rate: toMoney(row.exchange_rate || 1),
    sum_pay_money: toMoney(row.balance_ref),
    remark: "",
  });
}

function sourceDocSubtitle(row) {
  const parts = [formatDate(row?.doc_date || row?.billing_date), row?.bill_type_name || billTypeName(row?.bill_type)];
  if (row?.ref_doc_no) parts.push(`อ้างอิง ${row.ref_doc_no}`);
  return parts.filter(Boolean).join(" · ");
}

function removeSelectedRow(index) {
  selectedRows.value.splice(index, 1);
}

function fillAllBalances() {
  selectedRows.value = selectedRows.value.map((row) => ({
    ...row,
    sum_pay_money: toMoney(row.balance_ref),
  }));
}

function resetForm(keepCustomer = false, keepSavedDoc = false) {
  if (!keepSavedDoc) savedDocNo.value = "";
  if (!keepSavedDoc) {
    docImages.value = [];
    imageError.value = "";
    printDialogVisible.value = false;
    printError.value = "";
    printForms.value = [];
    selectedPrintForms.value = [];
  }
  docDate.value = todayISO();
  docTime.value = currentTime();
  creditDay.value = 0;
  dueDate.value = todayISO();
  docRef.value = "";
  docRefDate.value = "";
  saleCode.value = currentUserCode();
  selectedSalesUser.value = null;
  remark.value = "";
  selectedRows.value = [];
  openDocSearch.value = "";
  if (!keepCustomer) clearCustomer();
  currentStep.value = "document";
  loadDefaultSalesUser();
  loadNextDoc();
  if (keepCustomer && selectedCustomer.value?.code) loadOpenDocs();
}

function buildPayload() {
  const userCode = currentUserCode();
  return {
    doc_date: docDate.value,
    doc_time: docTime.value,
    doc_format_code: selectedDocFormatCode.value || "",
    cust_code: selectedCustomer.value?.code || "",
    credit_day: creditDay.value,
    due_date: dueDate.value,
    doc_ref: docRef.value,
    doc_ref_date: docRefDate.value || null,
    sale_code: saleCode.value,
    branch_code: posStore.selectedPos?.branch_code || "",
    emp_code: userCode,
    creator_code: userCode,
    remark: remark.value,
    details: selectedRows.value.map((row) => ({
      billing_no: row.billing_no,
      bill_type: row.bill_type,
      billing_date: row.billing_date,
      due_date: row.due_date,
      ref_doc_no: row.ref_doc_no || "",
      ref_doc_date: row.ref_doc_date || "",
      bill_tax_no: row.bill_tax_no || "",
      bill_tax_date: row.bill_tax_date || "",
      sum_debt_amount: toMoney(row.sum_debt_amount),
      balance_ref: toMoney(row.balance_ref),
      sum_pay_money: toMoney(row.sum_pay_money),
      remark: row.remark || "",
    })),
  };
}

async function saveDoc() {
  if (!canSave.value) return;
  saving.value = true;
  try {
    const result = await saveArBilling(buildPayload());
    savedDocNo.value = result.doc_no || "";
    notify("success", "บันทึกใบวางบิลแล้ว", savedDocNo.value);
    resetForm(true, true);
    currentStep.value = "summary";
  } catch (ex) {
    notify("error", "บันทึกไม่สำเร็จ", ex.message);
    return;
  } finally {
    saving.value = false;
  }

  try {
    await Promise.allSettled([loadHistory(), loadNextDoc(), loadOpenDocs(), loadDocImages(savedDocNo.value)]);
  } catch {
    // Promise.allSettled should not throw; keep save success visible even if refresh APIs fail.
  }
}

function goToStep(stepKey) {
  const targetIndex = steps.findIndex((step) => step.key === stepKey);
  if (targetIndex < 0) return;
  if (stepKey === "summary" && !savedDocNo.value) {
    currentStep.value = "review";
    notify("warn", "ยังไม่ได้บันทึก", "บันทึกใบวางบิลก่อนเข้าสู่หน้าสรุป");
    return;
  }
  if (targetIndex <= currentStepIndex.value) {
    currentStep.value = stepKey;
    return;
  }
  const blockedStep = steps.slice(0, targetIndex).find((step) => stepIssues.value[step.key]?.length);
  if (blockedStep) {
    currentStep.value = blockedStep.key;
    notify("warn", "ข้อมูลยังไม่ครบ", stepIssues.value[blockedStep.key][0]);
    return;
  }
  currentStep.value = stepKey;
}

function goNext() {
  if (!canGoNext.value) return;
  currentStep.value = steps[Math.min(currentStepIndex.value + 1, steps.length - 1)].key;
}

function goBack() {
  if (isFirstStep.value) return;
  currentStep.value = steps[Math.max(currentStepIndex.value - 1, 0)].key;
}

function startNewDocument() {
  resetForm(false, false);
}

function currentSavedDocNo() {
  return savedDocNo.value || "";
}

async function loadDocImages(docNo = currentSavedDocNo()) {
  if (!docNo) {
    docImages.value = [];
    return;
  }
  docImages.value = await getDocImagesList(docNo);
}

async function openPrintDialog() {
  const docNo = currentSavedDocNo();
  if (!docNo || printLoading.value) return;
  printDialogVisible.value = true;
  printLoading.value = true;
  printError.value = "";
  printForms.value = [];
  selectedPrintForms.value = [];
  try {
    const result = await getArBillingPrintForms(docNo, currentUserCode());
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
  const docNo = currentSavedDocNo();
  if (!docNo || !selectedPrintForms.value.length) return;
  const url = getArBillingPrintUrl(docNo, selectedPrintForms.value, currentUserCode());
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
  const docNo = currentSavedDocNo();
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

async function openDetail(row) {
  if (!row?.doc_no) return;
  detailDialogVisible.value = true;
  detailLoading.value = true;
  savedDetail.value = null;
  try {
    savedDetail.value = await getArBillingDetail(row.doc_no, currentUserCode());
  } catch (ex) {
    notify("error", "เปิดเอกสารไม่สำเร็จ", ex.message);
  } finally {
    detailLoading.value = false;
  }
}
</script>

<template>
  <div class="billing-step-page">
    <section class="step-top-strip">
      <div class="title-block">
        <h1>ใบวางบิล (ลูกหนี้)</h1>
        <span>เลขที่ถัดไป {{ nextDoc?.doc_no || "-" }}</span>
      </div>
      <div class="top-actions">
        <Button icon="pi pi-history" label="ประวัติ" class="action-btn action-history" @click="router.push('/sales/ar-billing/history')" />
        <Button icon="pi pi-plus" label="เอกสารใหม่" class="action-btn action-new" @click="startNewDocument" />
      </div>
    </section>

    <section class="stepper">
      <button
        v-for="(step, index) in steps"
        :key="step.key"
        type="button"
        class="stepper-item"
        :class="{ active: currentStep === step.key, done: index < currentStepIndex }"
        :disabled="step.key === 'summary' && !savedDocNo"
        @click="goToStep(step.key)"
      >
        <span class="step-icon"><i :class="step.icon" /></span>
        <span>
          <small>ขั้นที่ {{ index + 1 }}</small>
          <strong>{{ step.label }}</strong>
        </span>
      </button>
    </section>

    <main class="step-card">
      <template v-if="currentStep === 'document'">
        <div class="step-head">
          <div>
            <span>ข้อมูลเอกสาร</span>
            <h2>ข้อมูลเอกสาร</h2>
          </div>
          <Button v-if="selectedCustomer" icon="pi pi-times" label="เปลี่ยนลูกหนี้" class="soft-btn" outlined @click="clearCustomer" />
        </div>

        <div class="doc-field-grid">
          <label>
            วันที่เอกสาร
            <InputText v-model="docDate" class="date-input" type="date" />
          </label>
          <label>
            รหัสเอกสาร
            <Select v-model="selectedDocFormatCode" :options="docFormatOptions" option-label="label" option-value="code" />
          </label>
          <label>
            เลขที่เอกสาร
            <InputText :model-value="nextDoc?.doc_no || ''" readonly />
          </label>
          <label>
            เวลา
            <InputText v-model="docTime" class="date-input" type="time" />
          </label>
          <label>
            ลูกหนี้
            <div class="customer-picker customer-picker-clearable">
              <InputText :model-value="selectedCustomer ? `${selectedCustomer.code} - ${customerName(selectedCustomer)}` : ''" placeholder="เลือกลูกหนี้" readonly />
              <Button icon="pi pi-search" label="ค้นหา" class="action-btn action-search" @click="openCustomerDialog" />
              <Button v-if="selectedCustomer" icon="pi pi-times" text rounded severity="danger" aria-label="ล้างลูกหนี้" @click="clearCustomer" />
            </div>
          </label>
                <label>
            พนักงานขาย
            <div class="customer-picker">
              <InputText :model-value="salesUserDisplay" placeholder="เลือกพนักงานขาย" readonly />
              <Button icon="pi pi-search" label="ค้นหา" class="action-btn action-search" @click="openSalesUserDialog" />
            </div>
          </label>
          <label>
            เครดิตวัน
            <InputNumber v-model="creditDay" :min="0" :max="999" input-class="text-input" />
          </label>
          <label>
            ครบกำหนด
            <InputText v-model="dueDate" class="date-input" type="date" />
          </label>
          <label>
            อ้างอิง
            <InputText v-model="docRef" />
          </label>
          <label>
            วันที่อ้างอิง
            <InputText v-model="docRefDate" class="date-input" type="date" />
          </label>
        </div>

        <div v-if="selectedCustomer" class="selected-panel">
          <div>
            <span>ลูกหนี้ที่เลือก</span>
            <strong>{{ selectedCustomer.code }} - {{ customerName(selectedCustomer) }}</strong>
          </div>
          <div>
            <span>เอกสารค้างวางบิล</span>
            <strong>{{ openDocs.length }} รายการ</strong>
          </div>
        </div>
      </template>

      <template v-else-if="currentStep === 'detail'">
        <div class="step-head">
          <div>
            <span>เอกสารค้างวางบิล</span>
            <h2>เลือกเอกสาร</h2>
          </div>
        </div>

        <div class="docs-filter">
          <InputText v-model="openDocSearch" placeholder="ค้นหาเลขที่เอกสาร / อ้างอิง" @keyup.enter="loadOpenDocs" />
          <Button icon="pi pi-search" label="ค้นหา" class="action-btn action-search" :disabled="!selectedCustomer" :loading="openDocsLoading" @click="loadOpenDocs" />
        </div>

        <DataTable
          :value="openDocRows"
          :loading="openDocsLoading"
          size="small"
          responsive-layout="stack"
          scrollable
          scroll-height="360px"
          removable-sort
          :table-style="{ minWidth: '760px' }"
          class="open-doc-table"
        >
          <template #empty>
            <div class="empty-state">ไม่พบเอกสารค้างวางบิล</div>
          </template>
          <Column field="doc_no" header="เอกสาร" sortable>
            <template #body="{ data }">
              <div class="doc-stack">
                <strong>{{ data.doc_no }}</strong>
                <span>{{ sourceDocSubtitle(data) }}</span>
                <div class="doc-badges">
                  <!-- <span v-if="data.tax_doc_no" class="mini-badge">ภาษี {{ data.tax_doc_no }}</span> -->
                  <span v-if="data.ship_code" class="mini-badge">ส่ง {{ data.ship_code }}</span>
                  <span v-if="data.ar_bill_blocked" class="mini-badge warn">วางบิลแล้ว</span>
                </div>
              </div>
            </template>
          </Column>
          <Column field="doc_date" header="วันที่" sortable>
            <template #body="{ data }">{{ formatDate(data.doc_date) }}</template>
          </Column>
          <Column field="due_date" header="ครบกำหนด" sortable>
            <template #body="{ data }">
              <div class="doc-stack compact">
                <strong>{{ formatDate(data.due_date) }}</strong>
                <span>{{ toMoney(data.due_day) }} วัน</span>
              </div>
            </template>
          </Column>
          <Column field="balance_ref" sort-field="balance_ref_sort" header="คงค้าง" sortable>
            <template #body="{ data }">{{ formatCurrency(data.balance_ref) }}</template>
          </Column>
          <Column header="">
            <template #body="{ data }">
              <Button
                icon="pi pi-plus"
                :label="data.ar_bill_blocked ? 'ใช้แล้ว' : 'เพิ่ม'"
                size="small"
                class="action-btn action-add"
                :disabled="data.ar_bill_blocked"
                @click="addOpenDoc(data)"
              />
            </template>
          </Column>
        </DataTable>

        <div class="selected-list">
          <div class="line-section-head">
            <h3>รายการที่เลือก</h3>
            <strong>{{ formatCurrency(selectedTotal) }}</strong>
          </div>
          <div v-for="(row, index) in selectedRows" :key="`${row.billing_no}-${row.bill_type}`" class="selected-row">
            <span class="line-index">{{ index + 1 }}</span>
            <div class="doc-cell">
              <strong>{{ row.billing_no }}</strong>
              <span>{{ sourceDocSubtitle(row) }}</span>
              <!-- <span v-if="row.bill_tax_no">ภาษี {{ row.bill_tax_no }} {{ row.bill_tax_date ? `· ${formatDate(row.bill_tax_date)}` : "" }}</span> -->
            </div>
            <div class="doc-cell">
              <span>ครบกำหนด</span>
              <strong>{{ formatDate(row.due_date) }}</strong>
            </div>
            <div class="doc-cell">
              <span>คงค้าง</span>
              <strong>{{ formatCurrency(row.balance_ref) }} / {{ formatCurrency(row.sum_debt_amount) }}</strong>
            </div>
            <InputNumber v-model="row.sum_pay_money" mode="currency" currency="THB" locale="th-TH" :min="amountMin(row)" :max="amountMax(row)" input-class="money-input" />
            <Button icon="pi pi-trash" severity="danger" text rounded aria-label="ลบแถว" @click="removeSelectedRow(index)" />
          </div>
          <div v-if="!selectedRows.length" class="empty-state">ยังไม่มีรายการ</div>
        </div>
      </template>

      <template v-else-if="currentStep === 'review'">
        <div class="step-head">
          <div>
            <span>ตรวจสอบก่อนบันทึก</span>
            <h2>สรุปใบวางบิล</h2>
          </div>
          <div class="review-total">{{ formatCurrency(selectedTotal) }}</div>
        </div>

        <div class="review-grid">
          <div><span>เลขที่เอกสาร</span><strong>{{ nextDoc?.doc_no || "-" }}</strong></div>
          <div><span>วันที่</span><strong>{{ formatDate(docDate) }}</strong></div>
          <div><span>ลูกหนี้</span><strong>{{ selectedCustomer?.code || "-" }} {{ customerName(selectedCustomer) }}</strong></div>
          <div><span>ครบกำหนด</span><strong>{{ formatDate(dueDate) }}</strong></div>
        </div>

        <DataTable :value="selectedRows" size="small" responsive-layout="stack">
          <Column field="billing_no" header="เอกสารต้นทาง" />
          <Column field="bill_type_name" header="ประเภท" />
          <Column field="sum_pay_money" header="ยอดวางบิล">
            <template #body="{ data }">{{ formatCurrency(data.sum_pay_money) }}</template>
          </Column>
        </DataTable>

        <label class="remark-field">
          หมายเหตุ
          <InputText v-model="remark" placeholder="บันทึกเพิ่มเติม" />
        </label>

        <Message v-if="!canCreate" severity="info" :closable="false">ผู้ใช้ปัจจุบันมีสิทธิ์ดูเอกสาร แต่ไม่มีสิทธิ์สร้างใบวางบิล</Message>
        <Message v-if="validationErrors.length" severity="warn" :closable="false">
          <div v-for="error in validationErrors" :key="error">{{ error }}</div>
        </Message>
      </template>

      <template v-else>
        <div class="summary-step">
          <div class="done-card">
            <i class="pi pi-check-circle done-icon" />
            <div>
              <div class="done-title">บันทึกใบวางบิลสำเร็จ</div>
              <div class="done-docno">{{ savedDocNo || "-" }}</div>
            </div>
          </div>

          <div class="proof-section">
            <div class="proof-head">
              <div>
                <div class="proof-title">หลักฐานเอกสาร</div>
                <div class="proof-subtitle">แนบรูปหลักฐานของใบวางบิลนี้</div>
              </div>
              <label class="proof-upload-btn" :class="{ disabled: imageUploading || !savedDocNo }">
                <i class="pi pi-upload" />
                <span>{{ imageUploading ? "กำลังบันทึก..." : "เพิ่มรูป" }}</span>
                <input type="file" accept="image/*" multiple :disabled="imageUploading || !savedDocNo" @change="onDocImageSelected" />
              </label>
            </div>
            <Message v-if="imageError" severity="error" :closable="false">{{ imageError }}</Message>
            <div v-if="docImages.length" class="proof-grid">
              <div v-for="image in docImages" :key="image.guid_code" class="proof-item">
                <a :href="getDocImageUrl(image.guid_code)" target="_blank" rel="noopener">
                  <img :src="getDocImageUrl(image.guid_code)" alt="หลักฐานใบวางบิล" />
                </a>
                <button type="button" class="proof-remove" @click="askDeleteImage(image)" aria-label="ลบรูป">
                  <i class="pi pi-trash" />
                </button>
              </div>
            </div>
            <div v-else class="proof-empty">ยังไม่มีรูปหลักฐาน</div>
          </div>

          <div class="done-actions">
            <Button icon="pi pi-print" label="พิมพ์ฟอร์ม" class="action-btn action-print" :disabled="!savedDocNo" @click="openPrintDialog" />
            <Button icon="pi pi-plus" label="เอกสารใหม่" class="action-btn action-new" @click="startNewDocument" />
            <Button icon="pi pi-history" label="ไปประวัติ" class="action-btn action-history" @click="router.push('/sales/ar-billing/history')" />
          </div>
        </div>
      </template>
    </main>

    <section v-if="currentStep !== 'summary'" class="step-footer">
      <div class="footer-issues">
        <span v-for="issue in currentStepIssues" :key="issue">{{ issue }}</span>
      </div>
      <div class="footer-actions">
        <Button icon="pi pi-chevron-left" label="กลับ" severity="secondary" outlined :disabled="isFirstStep" @click="goBack" />
        <Button v-if="currentStep !== 'review'" icon-pos="right" icon="pi pi-chevron-right" label="ถัดไป" class="action-btn action-new" :disabled="!canGoNext" @click="goNext" />
        <Button v-else icon="pi pi-save" label="บันทึก" class="action-btn action-new" :loading="saving" :disabled="!canSave" @click="saveDoc" />
      </div>
    </section>

    <Dialog v-model:visible="customerDialogVisible" modal header="เลือกลูกหนี้" :draggable="false" :style="{ width: 'min(760px, 95vw)' }">
      <div class="customer-dialog">
        <div class="customer-dialog-search">
          <div class="customer-search-input">
            <InputText v-model="customerSearch" class="customer-search-text" placeholder="ค้นหารหัสหรือชื่อลูกหนี้" autofocus @input="handleCustomerInput" @keyup.enter="searchCustomers" />
            <Button v-if="customerSearch || customers.length" icon="pi pi-times" text rounded severity="secondary" class="input-clear-btn" aria-label="ล้างคำค้นหา" @click="clearCustomerSearch" />
          </div>
          <Button icon="pi pi-search" label="ค้นหา" class="action-btn action-search" :loading="customerLoading" @click="searchCustomers" />
        </div>
        <div v-if="customerLoading" class="dialog-state">กำลังค้นหา...</div>
        <div v-else-if="customerSearch.trim().length < 2" class="dialog-state">พิมพ์อย่างน้อย 2 ตัวอักษร</div>
        <div v-else-if="!customers.length" class="dialog-state">ไม่พบลูกหนี้</div>
        <div v-else class="customer-dialog-list">
          <button v-for="row in customers" :key="row.code" type="button" @click="selectCustomer(row)">
            <strong>{{ row.code }}</strong>
            <span>{{ customerName(row) }}</span>
          </button>
        </div>
      </div>
    </Dialog>

    <Dialog v-model:visible="salesUserDialogVisible" modal header="เลือกพนักงานขาย" :draggable="false" :style="{ width: 'min(680px, 95vw)' }">
      <div class="customer-dialog">
        <div class="customer-dialog-search">
          <InputText v-model="salesUserSearch" placeholder="ค้นหารหัสหรือชื่อพนักงานขาย" autofocus @input="scheduleSalesUserSearch" @keyup.enter="searchSalesUsers" />
          <Button icon="pi pi-search" label="ค้นหา" class="action-btn action-search" :loading="salesUserLoading" @click="searchSalesUsers" />
        </div>
        <div v-if="salesUserLoading" class="dialog-state">กำลังค้นหา...</div>
        <div v-else-if="!salesUsers.length" class="dialog-state">ไม่พบพนักงานขาย</div>
        <div v-else class="customer-dialog-list">
          <button v-for="row in salesUsers" :key="row.code" type="button" @click="selectSalesUser(row)">
            <strong>{{ row.code }}</strong>
            <span>{{ salesUserName(row) }}</span>
          </button>
        </div>
      </div>
    </Dialog>

    <Dialog v-model:visible="printDialogVisible" modal header="เลือกฟอร์มสำหรับพิมพ์" :draggable="false" :style="{ width: 'min(460px, 95vw)' }">
      <div class="print-dialog-body">
        <div class="print-doc-no">{{ currentSavedDocNo() }}</div>
        <div v-if="printLoading" class="print-loading">
          <ProgressSpinner style="width: 32px; height: 32px" />
        </div>
        <Message v-else-if="printError" severity="error" :closable="false">{{ printError }}</Message>
        <div v-else class="print-form-list">
          <label v-for="form in printForms" :key="form.formcode" class="print-form-row" :class="{ disabled: !form.available }">
            <Checkbox v-model="selectedPrintForms" :input-id="`ar-billing-print-form-${form.formcode}`" :value="form.formcode" :disabled="!form.available" />
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

    <Dialog v-model:visible="confirmDeleteVisible" modal header="ยืนยันการลบ" :draggable="false" :style="{ width: 'min(400px, 95vw)' }">
      <div class="confirm-body">ต้องการลบรูปหลักฐานใบวางบิลนี้หรือไม่</div>
      <template #footer>
        <Button label="ยกเลิก" severity="secondary" outlined @click="confirmDeleteVisible = false" />
        <Button label="ลบรูป" severity="danger" icon="pi pi-trash" @click="confirmDeleteImage" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.billing-step-page {
  min-height: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0;
  padding: 0.2rem;
  overflow: hidden;
  background: var(--p-surface-0);
  color: var(--p-text-color);
}

.step-top-strip,
.step-card,
.step-footer {
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  background: var(--p-surface-0);
}

.step-top-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.65rem 0.75rem;
  border-color: transparent;
}

.step-top-strip h1 {
  margin: 0;
  font-size: 1.35rem;
  letter-spacing: 0;
}

.title-block {
  display: grid;
  gap: 0.15rem;
}

.title-block span,
.step-head span,
.review-grid span,
.selected-panel span,
.proof-subtitle {
  color: var(--p-text-color-secondary);
  font-size: 0.85rem;
}

.top-actions,
.footer-actions,
.detail-actions,
.done-actions {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.top-actions :deep(.p-button) {
  min-width: 7.5rem;
  white-space: nowrap;
}

.footer-actions :deep(.p-button) {
  min-width: 7rem;
  white-space: nowrap;
}

.action-btn {
  border: 0;
  font-weight: 900;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
}

.action-btn:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.12);
}

.action-history {
  background: #2563eb;
  color: #fff;
}

.action-new,
.action-add {
  background: #10b981;
  color: #fff;
}

.action-search {
  background: #0ea5e9;
  color: #fff;
}

.action-exact {
  background: #f59e0b;
  color: #111827;
}

.action-print {
  background: #7c3aed;
  color: #fff;
}

.action-btn:disabled {
  opacity: 0.55;
  transform: none;
  box-shadow: none;
}

.accent-btn {
  background: var(--p-primary-color);
  border-color: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
}

.accent-btn.p-button-outlined,
.soft-btn.p-button-outlined {
  background: color-mix(in srgb, var(--p-primary-color) 8%, var(--p-surface-0));
  color: var(--p-primary-color);
  border-color: color-mix(in srgb, var(--p-primary-color) 35%, var(--p-surface-border));
}

.stepper {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.25rem;
  padding: 0.25rem;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.stepper-item {
  min-height: 3.6rem;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--p-text-color);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.55rem;
  text-align: left;
  cursor: pointer;
}

.stepper-item.active {
  border-color: var(--p-primary-color);
  background: color-mix(in srgb, var(--p-primary-color) 10%, var(--p-surface-0));
}

.stepper-item.done .step-icon {
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
}

.step-icon {
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--p-surface-100);
  color: var(--p-text-color-secondary);
  flex: 0 0 auto;
}

.stepper-item small,
.stepper-item strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stepper-item small {
  color: var(--p-text-color-secondary);
}

.step-card {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0.4rem;
  border-color: transparent;
}

.step-head,
.line-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.step-head h2,
.line-section-head h3 {
  margin: 0;
  letter-spacing: 0;
}

.doc-field-grid,
.review-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
}

.doc-field-grid label,
.remark-field {
  display: grid;
  gap: 0.35rem;
  font-size: 0.82rem;
  color: var(--p-text-color-secondary);
}

.customer-picker,
.docs-filter {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.55rem;
}

.customer-picker-clearable {
  grid-template-columns: minmax(0, 1fr) auto auto;
}

.customer-picker :deep(.p-inputtext) {
  width: 100%;
}

.selected-panel,
.review-grid > div {
  margin-top: 0.75rem;
  padding: 0.75rem;
  border-radius: 8px;
  background: var(--p-surface-100);
}

.selected-panel {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.selected-panel div,
.review-grid > div {
  display: grid;
  gap: 0.2rem;
}

.open-doc-table,
.selected-list {
  margin-top: 0.75rem;
}

.open-doc-table {
  width: 100%;
}

.open-doc-table :deep(.p-datatable-wrapper) {
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
}

.open-doc-table :deep(.p-datatable-thead > tr > th),
.open-doc-table :deep(.p-datatable-tbody > tr > td) {
  white-space: nowrap;
}

.open-doc-table :deep(.p-datatable-tbody > tr > td:first-child) {
  white-space: normal;
}

.selected-list {
  display: grid;
  gap: 0.55rem;
}

.selected-row {
  display: grid;
  grid-template-columns: 2rem minmax(180px, 1.25fr) minmax(110px, 0.45fr) minmax(150px, 0.65fr) minmax(150px, 0.45fr) auto;
  align-items: center;
  gap: 0.55rem;
  padding: 0.55rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
}

.doc-stack {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.doc-stack strong {
  overflow-wrap: anywhere;
}

.doc-stack span {
  color: var(--p-text-color-secondary);
  font-size: 0.82rem;
}

.doc-stack.compact {
  gap: 0.1rem;
}

.doc-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.mini-badge {
  display: inline-flex;
  align-items: center;
  min-height: 1.35rem;
  padding: 0 0.45rem;
  border-radius: 999px;
  background: var(--p-surface-100);
  color: var(--p-text-color-secondary);
  font-size: 0.75rem;
  font-weight: 700;
}

.mini-badge.warn {
  color: #b45309;
  background: #fef3c7;
}

.line-index {
  color: var(--p-text-color-secondary);
  text-align: center;
}

.doc-cell {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}

.doc-cell span {
  color: var(--p-text-color-secondary);
  font-size: 0.8rem;
}

.doc-cell strong,
.review-grid strong {
  overflow-wrap: anywhere;
}

.review-total {
  color: var(--p-primary-color);
  font-weight: 900;
  font-size: 1.25rem;
}

.summary-step {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  text-align: center;
}

.done-card,
.proof-section,
.done-actions {
  width: min(100%, 620px);
}

.done-card {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.9rem;
  padding: 0.9rem 1rem;
  border: 1px solid color-mix(in srgb, #16a34a 35%, var(--p-surface-border));
  border-radius: 8px;
  background: color-mix(in srgb, #16a34a 8%, var(--p-surface-0));
}

.done-icon {
  font-size: 2.75rem;
  color: #16a34a;
}

.done-title {
  font-weight: 800;
}

.done-docno {
  margin-top: 0.15rem;
  font-size: 1.3rem;
  font-weight: 900;
  color: var(--p-primary-color);
}

.proof-section {
  display: grid;
  gap: 0.75rem;
  padding: 0.8rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  background: var(--p-surface-0);
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
  min-height: 2.5rem;
  padding: 0 0.85rem;
  border: 1px solid var(--p-primary-color);
  border-radius: 8px;
  color: var(--p-primary-color);
  background: var(--p-surface-0);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  font-weight: 800;
  cursor: pointer;
}

.proof-upload-btn.disabled {
  opacity: 0.55;
  pointer-events: none;
}

.proof-upload-btn input {
  display: none;
}

.proof-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 0.65rem;
}

.proof-item {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  background: var(--p-surface-100);
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
  background: rgba(220, 38, 38, 0.92);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.proof-empty,
.empty-state {
  min-height: 5rem;
  border-radius: 8px;
  background: var(--p-surface-50);
  color: var(--p-text-color-secondary);
  display: grid;
  place-items: center;
  padding: 0.75rem;
}

.step-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.65rem 0.75rem;
}

.footer-issues {
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  color: #b45309;
  font-size: 0.85rem;
}

.customer-dialog,
.customer-dialog-search,
.customer-dialog-list,
.print-dialog-body,
.print-form-list {
  display: grid;
  gap: 0.75rem;
}

.customer-dialog-search {
  grid-template-columns: minmax(0, 1fr) auto;
}

.customer-search-input {
  position: relative;
  min-width: 0;
}

.customer-search-input :deep(.p-inputtext) {
  width: 100%;
  padding-right: 2.65rem;
}

.input-clear-btn {
  position: absolute;
  top: 50%;
  right: 0.25rem;
  transform: translateY(-50%);
  width: 2rem;
  height: 2rem;
}

.customer-dialog-list {
  max-height: min(58vh, 520px);
  overflow: auto;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

.customer-dialog-list button {
  min-height: 4rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  background: var(--p-surface-0);
  color: var(--p-text-color);
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.65rem 0.75rem;
  text-align: left;
  cursor: pointer;
}

.print-doc-no {
  font-weight: 900;
  color: var(--p-primary-color);
  text-align: center;
}

.print-loading {
  display: grid;
  place-items: center;
  min-height: 6rem;
}

.print-form-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.65rem;
  min-height: 3.5rem;
  padding: 0.6rem 0.7rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
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

.confirm-body {
  line-height: 1.6;
}

.billing-page {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  color: var(--p-text-color);
}

.top-strip {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(180px, auto) auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  background: var(--p-surface-0);
}

.title-block h1,
.panel-head h2,
.detail-head h2 {
  margin: 0;
  letter-spacing: 0;
}

.title-block h1 {
  font-size: 1.25rem;
}

.title-block span,
.panel-head span,
.preview-label {
  color: var(--p-text-color-secondary);
  font-size: 0.82rem;
}

.doc-preview {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.125rem;
}

.doc-preview strong,
.payment-total strong {
  color: var(--p-primary-color);
}

.top-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.work-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(260px, 0.8fr) minmax(430px, 1.55fr) minmax(320px, 0.95fr);
  gap: 0.75rem;
}

.history-panel,
.editor-panel,
.docs-panel {
  min-height: 0;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  background: var(--p-surface-0);
}

.history-panel,
.docs-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-head,
.detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.panel-head,
.history-filter,
.docs-filter {
  padding: 0.875rem;
}

.history-filter,
.docs-filter {
  display: grid;
  gap: 0.5rem;
  border-top: 1px solid var(--p-surface-border);
  border-bottom: 1px solid var(--p-surface-border);
}

.docs-filter {
  grid-template-columns: minmax(0, 1fr) auto;
  border-top: none;
}

.date-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.date-input {
  width: 100%;
  min-height: 2.75rem;
  padding: 0 0.85rem;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: var(--p-surface-0);
  color: var(--p-text-color);
  font: inherit;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.date-input:focus {
  border-color: var(--p-primary-color);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--p-primary-color) 35%, transparent);
}

.editor-panel {
  overflow: auto;
  padding: 0.875rem;
}

.doc-fields {
  display: grid;
  grid-template-columns: 1.25fr 1fr 0.8fr 0.8fr;
  gap: 0.625rem;
}

label,
.remark-field {
  display: grid;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: var(--p-text-color-secondary);
}

.customer-zone {
  margin-top: 0.875rem;
  padding-top: 0.875rem;
  border-top: 1px solid var(--p-surface-border);
}

.customer-search {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 0.5rem;
}

.selected-customer,
.customer-results button {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  min-height: 2.75rem;
}

.selected-customer {
  margin-top: 0.625rem;
  padding: 0.625rem 0.75rem;
  border-radius: 8px;
  background: var(--p-primary-50);
}

.selected-customer span {
  flex: 1;
  min-width: 0;
}

.customer-results {
  display: grid;
  gap: 0.375rem;
  margin-top: 0.625rem;
}

.customer-results button {
  text-align: left;
  border: 1px solid var(--p-surface-border);
  border-radius: 6px;
  background: var(--p-surface-0);
  color: var(--p-text-color);
  padding: 0.5rem 0.625rem;
  font: inherit;
}

.detail-head {
  margin-top: 1rem;
  padding-top: 0.875rem;
  border-top: 1px solid var(--p-surface-border);
}

.selected-list {
  display: grid;
  gap: 0.5rem;
  margin-top: 0.625rem;
}

.selected-row {
  display: grid;
  grid-template-columns: 2rem minmax(180px, 1.25fr) minmax(110px, 0.45fr) minmax(150px, 0.65fr) minmax(150px, 0.45fr) auto;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
}

.line-index {
  color: var(--p-text-color-secondary);
  text-align: center;
}

.doc-cell {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}

.doc-cell span {
  color: var(--p-text-color-secondary);
  font-size: 0.78rem;
}

.remark-field {
  margin-top: 0.875rem;
}

.empty-state,
.dialog-state {
  min-height: 8rem;
  display: grid;
  place-items: center;
  color: var(--p-text-color-secondary);
}

.payment-total {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.875rem;
  border-bottom: 1px solid var(--p-surface-border);
}

.payment-total span {
  color: var(--p-text-color-secondary);
}

.payment-total strong {
  font-size: 1.35rem;
}

.detail-dialog {
  display: grid;
  gap: 0.75rem;
}

.detail-title,
.detail-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

@media (max-width: 1180px) {
  .billing-step-page {
    padding: 0rem;
  }

  .top-strip {
    grid-template-columns: 1fr auto;
  }

  .top-actions {
    grid-column: 1 / -1;
  }

  .work-grid {
    grid-template-columns: minmax(0, 1fr);
    overflow: visible;
  }

  .history-panel,
  .docs-panel {
    max-height: 340px;
  }

  .doc-fields {
    grid-template-columns: 1fr 1fr;
  }
}

@media (min-width: 960px) and (max-width: 1180px) {
  .top-strip {
    grid-template-columns: minmax(190px, 1fr) minmax(160px, auto) auto;
  }

  .top-actions {
    grid-column: auto;
  }

  .work-grid {
    grid-template-columns: minmax(220px, 0.72fr) minmax(340px, 1.35fr) minmax(280px, 0.95fr);
    overflow: hidden;
  }

  .history-panel,
  .docs-panel {
    max-height: none;
  }

  .editor-panel {
    padding: 0.75rem;
  }

  .selected-row {
    grid-template-columns: 1.75rem minmax(160px, 1.15fr) minmax(105px, 0.45fr) minmax(130px, 0.6fr) minmax(120px, 0.45fr) auto;
  }
}

@media (max-width: 760px) {
  .step-top-strip,
  .step-footer,
  .step-head,
  .line-section-head,
  .proof-head {
    align-items: stretch;
    flex-direction: column;
  }

  .top-actions,
  .footer-actions,
  .done-actions {
    justify-content: stretch;
  }

  .top-actions :deep(.p-button),
  .footer-actions :deep(.p-button),
  .done-actions :deep(.p-button) {
    flex: 1 1 0;
    min-width: 0;
  }

  .stepper,
  .doc-field-grid,
  .review-grid,
  .selected-panel,
  .selected-row,
  .customer-picker,
  .docs-filter,
  .customer-dialog-search,
  .customer-dialog-list {
    grid-template-columns: 1fr;
  }

  .customer-picker-clearable {
    grid-template-columns: minmax(0, 1fr) auto auto;
  }

  .stepper-item {
    min-height: 3.4rem;
  }

  .summary-step {
    justify-content: flex-start;
  }

  .top-strip,
  .doc-fields,
  .selected-row,
  .date-row,
  .docs-filter,
  .customer-search {
    grid-template-columns: 1fr;
  }

  .selected-customer {
    align-items: flex-start;
    flex-direction: column;
  }
}

.billing-step-page .docs-filter {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.55rem;
  padding: 0;
  border: 0;
}

.billing-step-page .selected-row {
  display: grid;
  grid-template-columns: 2rem minmax(180px, 1.25fr) minmax(110px, 0.45fr) minmax(150px, 0.65fr) minmax(150px, 0.45fr) auto;
  align-items: center;
  gap: 0.55rem;
  padding: 0.55rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
}

.billing-step-page .customer-dialog-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  max-height: min(58vh, 520px);
  overflow: auto;
}

.billing-step-page .dialog-state {
  min-height: 8rem;
  display: grid;
  place-items: center;
  color: var(--p-text-color-secondary);
}

@media (max-width: 760px) {
  .billing-step-page .docs-filter,
  .billing-step-page .selected-row,
  .billing-step-page .customer-dialog-list {
    grid-template-columns: 1fr;
  }
}
</style>
