<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
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
import { getCustomerList, getPassBookList, getCreditTypeList } from "@/services/sellService";
import { createTigerOrder, inquireTigerOrder, cancelTigerOrder, getTigerConfig, TIGER_MOCK } from "@/services/tigerService";
import {
  getAdvancePaymentCustomerBalance,
  getAdvancePaymentDetail,
  getAdvancePaymentDocFormats,
  getAdvancePaymentList,
  getNextAdvancePaymentDocNo,
  getAdvancePaymentPrintForms,
  getAdvancePaymentPrintUrl,
  saveAdvancePayment,
} from "@/services/advancePaymentService";
import { deleteDocImage, getDocImageUrl, getDocImagesList, saveDocImage } from "@/services/docImageService";
import { useAuthStore } from "@/stores/auth";
import { usePosStore } from "@/stores/pos";
import { formatCurrency, formatDate, todayISO } from "@/utils/formatters";
import { PERMISSIONS } from "@/utils/permissions";
import { generateUUID } from "@/utils/uuid";

const authStore = useAuthStore();
const posStore = usePosStore();
const toast = useToast();
const router = useRouter();

const docFormats = ref([]);
const selectedDocFormatCode = ref("");
const nextDoc = ref(null);
const docDate = ref(todayISO());
const docTime = ref(currentTime());
const depositDay = ref(null);
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
const customerBalance = ref(null);
const customerDialogVisible = ref(false);

let customerTimer = null;
let customerSearchSeq = 0;
let localRowId = 0;

const detailRows = ref([newDetailRow()]);
const cashAmount = ref(null);
const transferRows = ref([]);
const cardRows = ref([]);
const tigerRows = ref([]);
const passBooks = ref([]);
const creditTypes = ref([]);
const tigerEnabled = ref(false);
const activePaymentType = ref("cash");
const transferDraft = ref(newTransferRow());
const cardDraft = ref(newCardRow());
const tigerStatus = ref("idle");
const tigerId = ref(null);
const tigerError = ref("");
const tigerPollInterval = ref(null);
const tigerCancel = ref(false);
const tigerRef1 = ref("");
const tigerRef2 = ref("");

const saving = ref(false);
const savedDocNo = ref("");
const savedDetail = ref(null);
const detailDialogVisible = ref(false);
const detailLoading = ref(false);
const docImages = ref([]);
const imageUploading = ref(false);
const imageError = ref("");
const printDialogVisible = ref(false);
const printLoading = ref(false);
const printError = ref("");
const printForms = ref([]);
const selectedPrintForms = ref([]);

const canCreate = computed(() => authStore.hasPermission(PERMISSIONS.salesAdvancePaymentCreate));
const docFormatOptions = computed(() =>
  docFormats.value.map((row) => ({
    ...row,
    label: `${row.code || ""} - ${row.name_1 || ""}`.trim(),
  })),
);
const selectedDocFormat = computed(() => docFormats.value.find((row) => row.code === selectedDocFormatCode.value) || null);
const passBookOptions = computed(() =>
  passBooks.value.map((row) => ({
    ...row,
    label: `${row.code || ""} ${row.bank_name || row.bank_code || ""}${row.book_name ? ` - ${row.book_name}` : ""}`.trim(),
  })),
);
const creditTypeOptions = computed(() =>
  creditTypes.value.map((row) => ({
    ...row,
    label: `${row.code || ""} ${row.name_1 || ""}`.trim(),
  })),
);
const validDetailRows = computed(() => detailRows.value.filter((row) => toMoney(row.amount) > 0));
const totalAmount = computed(() => rnd(validDetailRows.value.reduce((sum, row) => sum + toMoney(row.amount), 0)));
const transferTotal = computed(() => rnd(transferRows.value.reduce((sum, row) => sum + toMoney(row.amount), 0)));
const cardChargeTotal = computed(() => rnd(cardRows.value.reduce((sum, row) => sum + toMoney(row.charge), 0)));
const cardTotal = computed(() => rnd(cardRows.value.reduce((sum, row) => sum + toMoney(row.amount) + toMoney(row.charge), 0)));
const tigerTotal = computed(() => rnd(tigerRows.value.reduce((sum, row) => sum + toMoney(row.amount), 0)));
const totalDue = computed(() => rnd(totalAmount.value + cardChargeTotal.value));
const paidTotal = computed(() => rnd(toMoney(cashAmount.value) + transferTotal.value + cardTotal.value + tigerTotal.value));
const paymentDiff = computed(() => rnd(paidTotal.value - totalDue.value));
const overpaidAmount = computed(() => Math.max(0, paymentDiff.value));
const remainingAmount = computed(() => Math.max(0, rnd(totalDue.value - paidTotal.value)));
const tigerPayAmount = computed(() => Math.max(0, rnd(totalDue.value - toMoney(cashAmount.value) - transferTotal.value - cardTotal.value - tigerTotal.value)));
const depositDayNumber = computed(() => {
  const value = Number(depositDay.value);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
});
const depositDate = computed(() => (depositDayNumber.value ? addDaysISO(docDate.value, depositDayNumber.value) : ""));
const balanceRows = computed(() => customerBalance.value?.rows || []);
const balanceTotal = computed(() => toMoney(customerBalance.value?.balance_amount));
const paymentTypeTabs = computed(() => {
  const tabs = [
    { key: "cash", label: "เงินสด", icon: "pi pi-money-bill" },
    { key: "transfer", label: "เงินโอน", icon: "pi pi-send" },
    { key: "card", label: "บัตรเครดิต", icon: "pi pi-credit-card" },
  ];
  if (tigerEnabled.value) tabs.push({ key: "tiger", label: "Tiger", icon: "pi pi-desktop" });
  return tabs;
});
const DENOMS = [20, 50, 100, 500, 1000];
const selectedCardType = computed(() => findCreditType(cardDraft.value.credit_card_type));
const draftCardChargeRate = computed(() => creditChargeRate(selectedCardType.value));
const draftCardCharge = computed(() => rnd(toMoney(cardDraft.value.amount) * draftCardChargeRate.value / 100));
const paymentEntries = computed(() => {
  const rows = [];
  if (toMoney(cashAmount.value) > 0) rows.push({ id: "cash", type: "cash", label: "เงินสด", amount: toMoney(cashAmount.value), sub: "" });
  transferRows.value.forEach((row) => rows.push({ id: row.id, type: "transfer", label: passBookLabel(row.pass_book_code), amount: toMoney(row.amount), sub: "เงินโอน" }));
  cardRows.value.forEach((row) => rows.push({ id: row.id, type: "card", label: creditTypeLabel(row.credit_card_type), amount: toMoney(row.amount), sub: `ค่าธรรมเนียม ${formatCurrency(row.charge)} / รวม ${formatCurrency(toMoney(row.amount) + toMoney(row.charge))}` }));
  tigerRows.value.forEach((row) => rows.push({ id: row.id, type: "tiger", label: "เครื่องชำระเงิน Tiger", amount: toMoney(row.amount), sub: row.tiger_order_id ? `Transaction ID ${row.tiger_order_id}` : "" }));
  return rows;
});
const validationErrors = computed(() => {
  const errors = [];
  if (!selectedCustomer.value?.code) errors.push("เลือกลูกหนี้ก่อนบันทึก");
  if (!selectedDocFormatCode.value) errors.push("เลือกรหัสเอกสารก่อนบันทึก");
  if (!docDate.value) errors.push("เลือกวันที่เอกสารก่อนบันทึก");
  if (!validDetailRows.value.length) errors.push("ระบุรายการรับเงินล่วงหน้าอย่างน้อย 1 รายการ");
  if (remainingAmount.value > 0.01) errors.push("ยอดรับชำระยังน้อยกว่ายอดเอกสาร");
  if (overpaidAmount.value > 0.01) errors.push("ยอดรับชำระมากกว่ายอดสุทธิ");
  for (const [index, row] of transferRows.value.entries()) {
    if (toMoney(row.amount) > 0 && !row.pass_book_code) errors.push(`แถวโอน ${index + 1}: เลือกสมุดบัญชี`);
    if (toMoney(row.amount) > 0 && !row.transfer_date) errors.push(`แถวโอน ${index + 1}: เลือกวันที่โอน`);
  }
  for (const [index, row] of cardRows.value.entries()) {
    if (toMoney(row.amount) > 0 && !row.credit_card_type) errors.push(`แถวบัตร ${index + 1}: เลือกประเภทบัตร`);
  }
  return errors;
});
const paymentValidationErrors = computed(() => {
  const errors = [];
  if (remainingAmount.value > 0.01) errors.push("ยอดรับชำระยังน้อยกว่ายอดเอกสาร");
  if (overpaidAmount.value > 0.01) errors.push("ยอดรับชำระมากกว่ายอดสุทธิ");
  for (const [index, row] of transferRows.value.entries()) {
    if (toMoney(row.amount) > 0 && !row.pass_book_code) errors.push(`แถวโอน ${index + 1}: เลือกสมุดบัญชี`);
    if (toMoney(row.amount) > 0 && !row.transfer_date) errors.push(`แถวโอน ${index + 1}: เลือกวันที่โอน`);
  }
  for (const [index, row] of cardRows.value.entries()) {
    if (toMoney(row.amount) > 0 && !row.credit_card_type) errors.push(`แถวบัตร ${index + 1}: เลือกประเภทบัตร`);
  }
  return errors;
});
const canSave = computed(() => canCreate.value && validationErrors.value.length === 0 && !saving.value);

const steps = [
  { key: "document", label: "ข้อมูลเอกสาร", icon: "pi pi-file" },
  { key: "detail", label: "รายละเอียด", icon: "pi pi-list" },
  { key: "payment", label: "รับชำระ", icon: "pi pi-wallet" },
  { key: "summary", label: "สรุป", icon: "pi pi-check-circle" },
];
const currentStep = ref("document");
const currentStepIndex = computed(() => Math.max(0, steps.findIndex((step) => step.key === currentStep.value)));
const currentStepMeta = computed(() => steps[currentStepIndex.value] || steps[0]);
const isFirstStep = computed(() => currentStepIndex.value === 0);
const isLastStep = computed(() => currentStepIndex.value === steps.length - 1);
const stepIssues = computed(() => ({
  document: [
    ...(!docDate.value ? ["เลือกวันที่เอกสารก่อน"] : []),
    ...(!selectedDocFormatCode.value ? ["เลือกรหัสเอกสารก่อน"] : []),
    ...(!selectedCustomer.value?.code ? ["เลือกลูกหนี้ก่อน"] : []),
  ],
  detail: validDetailRows.value.length ? [] : ["ระบุยอดรับล่วงหน้าอย่างน้อย 1 รายการ"],
  payment: paymentValidationErrors.value,
  summary: savedDocNo.value ? [] : ["บันทึกเอกสารก่อนเข้าสู่หน้าสรุป"],
}));
const currentStepIssues = computed(() => stepIssues.value[currentStep.value] || []);
const canGoNext = computed(() => !currentStepIssues.value.length && !isLastStep.value && currentStep.value !== "payment");

watch(selectedDocFormatCode, () => loadNextDoc());
watch(docDate, () => loadNextDoc());
watch(depositDay, () => {
  if (depositDay.value !== null && depositDay.value < 0) depositDay.value = null;
});

onMounted(async () => {
  await Promise.all([loadDocFormats(), loadPaymentMasters()]);
});

onUnmounted(() => clearInterval(tigerPollInterval.value));

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

function makeRowId() {
  localRowId += 1;
  return `advance-row-${Date.now()}-${localRowId}`;
}

function addDaysISO(dateText, days) {
  const date = new Date(`${dateText || todayISO()}T00:00:00`);
  date.setDate(date.getDate() + Number(days || 0));
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatGregorianDate(value) {
  if (!value) return "-";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  if (!year || !month || !day) return "-";
  return `${month}/${day}/${year}`;
}

function newDetailRow() {
  return { id: makeRowId(), remark: "รับเงินล่วงหน้า", amount: null };
}

function newTransferRow() {
  return { id: makeRowId(), pass_book_code: "", transfer_date: docDate.value || todayISO(), amount: null };
}

function newCardRow() {
  return { id: makeRowId(), credit_card_type: "", card_number: "", no_approved: "", amount: null, charge: 0 };
}

function paymentEntryIcon(type) {
  if (type === "cash") return "pi pi-money-bill";
  if (type === "transfer") return "pi pi-send";
  if (type === "card") return "pi pi-credit-card";
  if (type === "tiger") return "pi pi-desktop";
  return "pi pi-receipt";
}

function passBookLabel(code) {
  const book = passBooks.value.find((row) => row.code === code);
  if (!book) return code || "เงินโอน";
  return `${book.book_name || book.code || ""}${book.bank_name || book.bank_code ? ` (${book.bank_name || book.bank_code})` : ""}`.trim();
}

function creditTypeLabel(code) {
  const card = findCreditType(code);
  return card?.name_1 || code || "บัตรเครดิต";
}

function normalizeCode(value) {
  return String(value ?? "").trim().toLowerCase();
}

function parseRate(value) {
  const normalized = String(value ?? "").replace("%", "").replace(",", ".").trim();
  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
}

function creditChargeRate(row) {
  return parseRate(row?.charge_rate ?? row?.credit_charge_rate ?? row?.fee_rate ?? row?.charge);
}

function findCreditType(code) {
  const target = normalizeCode(code);
  if (!target) return null;
  return creditTypes.value.find((row) => normalizeCode(row.code) === target) || null;
}

function notify(severity, summary, detail) {
  toast.add({ severity, summary, detail, life: 4200 });
}

async function loadDocFormats() {
  docFormats.value = await getAdvancePaymentDocFormats({ user_code: currentUserCode() });
  selectedDocFormatCode.value = docFormats.value[0]?.code || "";
  await loadNextDoc();
}

async function loadNextDoc() {
  if (!selectedDocFormatCode.value || !docDate.value) return;
  try {
    nextDoc.value = await getNextAdvancePaymentDocNo({
      doc_format_code: selectedDocFormatCode.value,
      doc_date: docDate.value,
      user_code: currentUserCode(),
    });
  } catch (ex) {
    nextDoc.value = null;
  }
}

async function loadPaymentMasters() {
  const [books, cards, tigerConfig] = await Promise.all([getPassBookList(), getCreditTypeList(), getTigerConfig()]);
  passBooks.value = books;
  creditTypes.value = cards;
  tigerEnabled.value = !!tigerConfig?.enabled;
  if (!tigerEnabled.value && activePaymentType.value === "tiger") activePaymentType.value = "cash";
}

async function loadHistory() {
  historyLoading.value = true;
  try {
    historyRows.value = await getAdvancePaymentList({
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
  scheduleCustomerSearch();
}

async function searchCustomers() {
  const query = customerSearch.value.trim();
  const requestId = (customerSearchSeq += 1);
  if (query.length < 2) {
    customers.value = [];
    customerLoading.value = false;
    return;
  }
  customerLoading.value = true;
  try {
    const result = await getCustomerList(query);
    if (requestId === customerSearchSeq && !selectedCustomer.value && customerSearch.value.trim() === query) {
      customers.value = result;
    }
  } catch (ex) {
    notify("error", "ค้นหาลูกค้าไม่สำเร็จ", ex.message);
  } finally {
    if (requestId === customerSearchSeq) customerLoading.value = false;
  }
}

async function selectCustomer(row) {
  customerSearchSeq += 1;
  selectedCustomer.value = row;
  customerSearch.value = `${row.code || ""} ${customerName(row)}`.trim();
  customerDialogVisible.value = false;
  try {
    customerBalance.value = await getAdvancePaymentCustomerBalance(row.code, currentUserCode());
  } catch {
    customerBalance.value = null;
  }
}

function customerName(row) {
  return row?.name_1 || row?.name || "";
}

function clearCustomer() {
  customerSearchSeq += 1;
  selectedCustomer.value = null;
  customerBalance.value = null;
  customerSearch.value = "";
  customers.value = [];
}

function openCustomerDialog() {
  customerDialogVisible.value = true;
  if (!selectedCustomer.value) {
    customers.value = [];
  }
}

function addDetailRow() {
  detailRows.value.push(newDetailRow());
}

function removeDetailRow(index) {
  detailRows.value.splice(index, 1);
  if (!detailRows.value.length) detailRows.value.push(newDetailRow());
}

function addTransferRow() {
  const row = transferDraft.value;
  if (!row.pass_book_code || !row.transfer_date || toMoney(row.amount) <= 0) return;
  transferRows.value.push({ ...row, id: makeRowId(), amount: toMoney(row.amount) });
  transferDraft.value = newTransferRow();
}

function addCardRow() {
  const row = cardDraft.value;
  if (!row.credit_card_type || toMoney(row.amount) <= 0) return;
  cardRows.value.push({
    ...row,
    id: makeRowId(),
    amount: toMoney(row.amount),
    charge: draftCardCharge.value,
  });
  cardDraft.value = newCardRow();
}

function removeRow(rows, index) {
  rows.splice(index, 1);
}

function removePaymentEntry(entry) {
  if (entry.type === "cash") {
    cashAmount.value = null;
    return;
  }
  if (entry.type === "transfer") transferRows.value = transferRows.value.filter((row) => row.id !== entry.id);
  if (entry.type === "card") cardRows.value = cardRows.value.filter((row) => row.id !== entry.id);
  if (entry.type === "tiger") tigerRows.value = tigerRows.value.filter((row) => row.id !== entry.id);
}

function addDenom(value) {
  cashAmount.value = rnd(toMoney(cashAmount.value) + value);
}

function fillCashExact() {
  cashAmount.value = Math.max(0, rnd(totalDue.value - transferTotal.value - cardTotal.value - tigerTotal.value));
}

function genTigerRef() {
  return `${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
}

function resetTigerState() {
  clearInterval(tigerPollInterval.value);
  tigerPollInterval.value = null;
  tigerStatus.value = "idle";
  tigerId.value = null;
  tigerError.value = "";
  tigerCancel.value = false;
}

async function startTigerPayment() {
  const amount = tigerPayAmount.value;
  if (amount <= 0) {
    notify("warn", "ไม่มียอดคงเหลือ", "ยอดรับชำระครบแล้ว");
    return;
  }
  tigerStatus.value = "requesting";
  tigerError.value = "";
  tigerCancel.value = false;
  tigerRef1.value = genTigerRef();
  tigerRef2.value = genTigerRef();
  try {
    const res = await createTigerOrder({
      orderId: generateUUID(),
      custName: selectedCustomer.value ? customerName(selectedCustomer.value) : "ลูกค้าทั่วไป",
      posId: posStore.posId,
      amount,
      ref1: tigerRef1.value,
      ref2: tigerRef2.value,
    });
    if (res.status !== "new") throw new Error("ไม่สามารถสร้างรายการชำระเงิน Tiger ได้");
    tigerId.value = String(res.id);
    tigerStatus.value = "waiting";
    tigerCancel.value = true;
    tigerPollInterval.value = setInterval(pollTiger, 3000);
  } catch (ex) {
    tigerStatus.value = "failed";
    tigerError.value = ex.message || "การชำระเงิน Tiger ล้มเหลว";
  }
}

async function pollTiger() {
  if (!tigerId.value) return;
  try {
    const res = await inquireTigerOrder(tigerId.value);
    if (res.status === "success") {
      const paidAmount = tigerPayAmount.value;
      clearInterval(tigerPollInterval.value);
      tigerPollInterval.value = null;
      tigerRows.value.push({
        id: makeRowId(),
        tiger_order_id: tigerId.value,
        amount: paidAmount,
        ref1: tigerRef1.value,
        ref2: tigerRef2.value,
      });
      tigerStatus.value = "success";
      tigerId.value = null;
      tigerCancel.value = false;
      await nextTick();
      await saveDoc({ auto: true });
    } else if (res.status === "cancel") {
      clearInterval(tigerPollInterval.value);
      tigerPollInterval.value = null;
      tigerStatus.value = "cancel";
    } else if (res.status === "failed") {
      clearInterval(tigerPollInterval.value);
      tigerPollInterval.value = null;
      tigerStatus.value = "failed";
      tigerError.value = "Tiger: การชำระเงินล้มเหลว";
    } else if (res.status === "new") {
      tigerCancel.value = true;
    } else if (res.status === "processing") {
      tigerStatus.value = "processing";
      tigerCancel.value = false;
    }
  } catch {
    // keep polling when the network has a transient issue
  }
}

async function cancelTiger() {
  clearInterval(tigerPollInterval.value);
  tigerPollInterval.value = null;
  try {
    if (tigerId.value) await cancelTigerOrder(tigerId.value);
  } catch {
    // ignore cancel API errors; the UI should return to idle
  }
  resetTigerState();
}

function resetForm(keepCustomer = false, keepSavedDoc = false) {
  if (!keepSavedDoc) savedDocNo.value = "";
  currentStep.value = "document";
  docDate.value = todayISO();
  docTime.value = currentTime();
  depositDay.value = null;
  remark.value = "";
  detailRows.value = [newDetailRow()];
  cashAmount.value = null;
  transferRows.value = [];
  cardRows.value = [];
  tigerRows.value = [];
  transferDraft.value = newTransferRow();
  cardDraft.value = newCardRow();
  resetTigerState();
  activePaymentType.value = "cash";
  savedDetail.value = null;
  docImages.value = [];
  imageError.value = "";
  printDialogVisible.value = false;
  printForms.value = [];
  selectedPrintForms.value = [];
  if (!keepCustomer) clearCustomer();
  loadNextDoc();
}

function goToStep(stepKey) {
  const targetIndex = steps.findIndex((step) => step.key === stepKey);
  if (targetIndex < 0) return;
  if (stepKey === "summary" && !savedDocNo.value) {
    currentStep.value = "payment";
    notify("warn", "ยังไม่ได้บันทึก", "บันทึกรับชำระก่อนเข้าสู่หน้าสรุป");
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

function nextStep() {
  if (currentStepIssues.value.length) {
    notify("warn", "ข้อมูลยังไม่ครบ", currentStepIssues.value[0]);
    return;
  }
  const next = steps[currentStepIndex.value + 1];
  if (next) currentStep.value = next.key;
}

function prevStep() {
  const prev = steps[currentStepIndex.value - 1];
  if (prev) currentStep.value = prev.key;
}

function buildPayload() {
  const userCode = currentUserCode();
  return {
    doc_date: docDate.value,
    doc_time: docTime.value,
    doc_format_code: selectedDocFormatCode.value || "",
    cust_code: selectedCustomer.value?.code || "",
    deposit_day: depositDayNumber.value,
    deposit_date: depositDate.value,
    vat_type: 0,
    vat_rate: 0,
    branch_code: posStore.selectedPos?.branch_code || "",
    emp_code: userCode,
    creator_code: userCode,
    remark: remark.value,
    details: validDetailRows.value.map((row) => ({
      remark: row.remark || "รับเงินล่วงหน้า",
      amount: toMoney(row.amount),
    })),
    payments: {
      cash_amount: toMoney(cashAmount.value),
      transfer: transferRows.value.map((row) => ({
        pass_book_code: row.pass_book_code,
        transfer_date: row.transfer_date,
        amount: toMoney(row.amount),
      })),
      card: cardRows.value.map((row) => ({
        credit_card_type: row.credit_card_type,
        trans_number: row.card_number || row.trans_number,
        card_number: row.card_number || row.trans_number,
        no_approved: row.no_approved,
        amount: toMoney(row.amount),
        charge: toMoney(row.charge),
      })),
      tiger_amount: tigerTotal.value,
      tiger: tigerRows.value.map((row) => ({
        tiger_order_id: row.tiger_order_id,
        amount: toMoney(row.amount),
        ref1: row.ref1,
        ref2: row.ref2,
      })),
    },
  };
}

async function saveDoc(options = {}) {
  const auto = options?.auto === true;
  if (!canSave.value) {
    if (auto) notify("warn", "ยังบันทึกไม่ได้", validationErrors.value[0] || "ตรวจสอบข้อมูลรับชำระ");
    return false;
  }
  saving.value = true;
  try {
    const result = await saveAdvancePayment(buildPayload());
    savedDocNo.value = result.doc_no || "";
    notify("success", "บันทึกรับเงินล่วงหน้าแล้ว", savedDocNo.value);
    savedDetail.value = savedDocNo.value ? await getAdvancePaymentDetail(savedDocNo.value, currentUserCode()) : null;
    await loadDocImages();
    await loadNextDoc();
    currentStep.value = "summary";
    return true;
  } catch (ex) {
    notify("error", "บันทึกไม่สำเร็จ", ex.message);
    return false;
  } finally {
    saving.value = false;
  }
}

async function openPrintDialog() {
  if (!savedDocNo.value || printLoading.value) return;
  printDialogVisible.value = true;
  printLoading.value = true;
  printError.value = "";
  printForms.value = [];
  selectedPrintForms.value = [];
  try {
    const result = await getAdvancePaymentPrintForms(savedDocNo.value, currentUserCode());
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
  if (!savedDocNo.value || !selectedPrintForms.value.length) return;
  const url = getAdvancePaymentPrintUrl(savedDocNo.value, selectedPrintForms.value, currentUserCode());
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

async function loadDocImages() {
  if (!savedDocNo.value) {
    docImages.value = [];
    return;
  }
  docImages.value = await getDocImagesList(savedDocNo.value);
}

async function onDocImageSelected(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length || !savedDocNo.value) return;
  imageUploading.value = true;
  imageError.value = "";
  try {
    for (const file of files) {
      if (!file.type.startsWith("image/")) throw new Error("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
      const imageFile = await fileToDataUrl(file);
      const result = await saveDocImage(savedDocNo.value, imageFile);
      if (!result.success) throw new Error(result.msg || "บันทึกรูปไม่สำเร็จ");
    }
    await loadDocImages();
    event.target.value = "";
  } catch (ex) {
    imageError.value = ex.message || "บันทึกรูปไม่สำเร็จ";
  } finally {
    imageUploading.value = false;
  }
}

async function removeDocImage(guidCode) {
  if (!guidCode) return;
  imageError.value = "";
  try {
    await deleteDocImage(guidCode);
    await loadDocImages();
  } catch (ex) {
    imageError.value = ex.message || "ลบรูปไม่สำเร็จ";
  }
}

async function openDetail(row) {
  if (!row?.doc_no) return;
  detailDialogVisible.value = true;
  detailLoading.value = true;
  savedDetail.value = null;
  try {
    savedDetail.value = await getAdvancePaymentDetail(row.doc_no, currentUserCode());
  } catch (ex) {
    notify("error", "เปิดเอกสารไม่สำเร็จ", ex.message);
  } finally {
    detailLoading.value = false;
  }
}
</script>

<template>
  <div class="advance-step-page">
    <section class="step-top-strip">
      <div class="step-title">
        <h1>รับเงินล่วงหน้า</h1>
        <span>เลขที่ถัดไป {{ nextDoc?.doc_no || "-" }}</span>
      </div>
      <div class="step-actions">
        <Button icon="pi pi-history" label="ประวัติ" class="action-btn action-history" @click="router.push('/sales/advance-payment/history')" />
        <Button icon="pi pi-plus" label="เอกสารใหม่" class="action-btn action-new" @click="resetForm(false)" />
      </div>
    </section>

    <nav class="stepper" aria-label="ขั้นตอนรับเงินล่วงหน้า">
      <button
        v-for="(step, index) in steps"
        :key="step.key"
        type="button"
        class="stepper-item"
        :class="{ active: currentStep === step.key, done: index < currentStepIndex }"
        @click="goToStep(step.key)"
      >
        <span class="stepper-icon"><i :class="step.icon" /></span>
        <span class="stepper-text">
          <small>ขั้นที่ {{ index + 1 }}</small>
          <strong>{{ step.label }}</strong>
        </span>
      </button>
    </nav>

    <Message v-if="savedDocNo" severity="success" :closable="false" class="saved-banner">บันทึกล่าสุด: {{ savedDocNo }}</Message>

    <main class="step-shell">
      <section v-if="currentStep === 'document'" class="step-card document-step">
        <div class="step-head">
          <div>
            <span class="step-kicker">{{ currentStepMeta.label }}</span>
            <h2>ข้อมูลเอกสาร</h2>
          </div>
          <Button v-if="selectedCustomer" icon="pi pi-times" label="เปลี่ยนลูกหนี้" severity="secondary" outlined @click="clearCustomer" />
        </div>

        <div class="doc-field-grid doc-intake-grid">
          <label class="field-label">
            วันที่เอกสาร
            <InputText v-model="docDate" class="date-input" type="date" />
          </label>
          <label class="field-label">
            รหัสเอกสาร
            <Select v-model="selectedDocFormatCode" :options="docFormatOptions" option-label="label" option-value="code" />
          </label>
          <label class="field-label">
            เลขที่เอกสาร
            <InputText :model-value="nextDoc?.doc_no || '-'" readonly />
          </label>
          <label class="field-label">
            เวลา
            <InputText v-model="docTime" class="date-input" type="time" />
          </label>
          <label class="field-label customer-field">
            ลูกค้า
            <div class="customer-picker">
              <InputText :model-value="selectedCustomer ? `${selectedCustomer.code} - ${customerName(selectedCustomer)}` : ''" readonly placeholder="เลือกลูกค้า" />
              <Button icon="pi pi-search" label="ค้นหา" class="action-btn action-search" @click="openCustomerDialog" />
              <Button v-if="selectedCustomer" icon="pi pi-times" text rounded severity="danger" aria-label="ล้างลูกค้า" @click="clearCustomer" />
            </div>
          </label>
          <label class="field-label">
            ระยะเวลาภายใน (วัน)
            <InputNumber v-model="depositDay" input-id="deposit-day-step" :min="0" :max="999" placeholder="ไม่ระบุ" />
          </label>
          <label class="field-label">
            ระยะเวลาภายใน (วันที่)
            <InputText :model-value="depositDate ? formatGregorianDate(depositDate) : '-'" readonly />
          </label>
        </div>

        <div v-if="selectedCustomer" class="selected-panel">
          <div>
            <span class="muted-label">ลูกหนี้ที่เลือก</span>
            <strong>{{ selectedCustomer.code }} - {{ customerName(selectedCustomer) }}</strong>
          </div>
          <div class="balance-pill">
            <span>คงเหลือล่วงหน้า</span>
            <strong>{{ formatCurrency(balanceTotal) }}</strong>
          </div>
        </div>

        <Message v-if="currentStepIssues.length" severity="warn" :closable="false">
          <div v-for="error in currentStepIssues" :key="error">{{ error }}</div>
        </Message>
      </section>

      <section v-else-if="currentStep === 'detail'" class="step-card document-step">
        <div class="step-head">
          <div>
            <span class="step-kicker">{{ currentStepMeta.label }}</span>
            <h2>รายละเอียดการรับเงิน</h2>
          </div>
          <div class="doc-chip">
            <span>ยอดรับรวม</span>
            <strong>{{ formatCurrency(totalAmount) }}</strong>
          </div>
        </div>

        <div class="line-section-head">
          <div>
            <span class="muted-label">รายการ</span>
            <strong>{{ formatCurrency(totalAmount) }}</strong>
          </div>
          <Button icon="pi pi-plus" label="เพิ่มรายการ" class="action-btn action-add" @click="addDetailRow" />
        </div>

        <div class="step-line-list">
          <div v-for="(row, index) in detailRows" :key="row.id" class="step-line-row">
            <span class="line-index">{{ index + 1 }}</span>
            <InputText v-model="row.remark" placeholder="หมายเหตุรายการ" />
            <InputNumber v-model="row.amount" mode="currency" currency="THB" locale="th-TH" :min="0" input-class="money-input" />
            <Button icon="pi pi-trash" severity="danger" text rounded aria-label="ลบแถว" @click="removeDetailRow(index)" />
          </div>
        </div>

        <label class="field-label">
          หมายเหตุเอกสาร
          <InputText v-model="remark" placeholder="บันทึกเพิ่มเติม" />
        </label>

        <div v-if="balanceRows.length" class="balance-note">
          <span>เอกสารล่วงหน้าคงเหลือเดิม</span>
          <strong>{{ formatCurrency(balanceTotal) }}</strong>
        </div>

        <Message v-if="currentStepIssues.length" severity="warn" :closable="false">
          <div v-for="error in currentStepIssues" :key="error">{{ error }}</div>
        </Message>
      </section>

      <section v-else-if="currentStep === 'payment'" class="step-card payment-step">
        <div class="step-head">
          <div>
            <span class="step-kicker">{{ currentStepMeta.label }}</span>
            <h2>รับชำระเงิน</h2>
          </div>
          <Button icon="pi pi-check" label="เงินสดพอดี" class="action-btn action-exact" @click="fillCashExact" />
        </div>

        <div class="payment-meter">
          <div><span>ยอดที่ต้องชำระ</span><strong>{{ formatCurrency(totalDue) }}</strong></div>
          <div><span>รับแล้ว</span><strong>{{ formatCurrency(paidTotal) }}</strong></div>
          <div><span>{{ overpaidAmount > 0 ? "ยอดเกิน" : "คงเหลือ" }}</span><strong>{{ formatCurrency(overpaidAmount > 0 ? overpaidAmount : remainingAmount) }}</strong></div>
          <div><span>ค่าธรรมเนียมบัตร</span><strong>{{ formatCurrency(cardChargeTotal) }}</strong></div>
        </div>

        <div class="payment-workspace">
          <section class="payment-entry-list">
            <div v-if="!paymentEntries.length" class="entries-empty">ยังไม่มีรายการรับชำระ</div>
            <div v-else class="entries-list">
              <div v-for="entry in paymentEntries" :key="entry.id" class="entry-row">
                <span class="entry-icon"><i :class="paymentEntryIcon(entry.type)" /></span>
                <div class="entry-info">
                  <strong>{{ entry.label }}</strong>
                  <small v-if="entry.sub">{{ entry.sub }}</small>
                </div>
                <span class="entry-amount">{{ formatCurrency(entry.amount) }}</span>
                <Button icon="pi pi-times" text rounded severity="danger" aria-label="ลบรายการรับชำระ" @click="removePaymentEntry(entry)" />
              </div>
            </div>
          </section>

          <section class="add-payment-panel">
            <div class="type-tabs">
              <button
                v-for="tab in paymentTypeTabs"
                :key="tab.key"
                type="button"
                class="type-tab"
                :class="{ active: activePaymentType === tab.key }"
                @click="activePaymentType = tab.key"
              >
                <i :class="tab.icon" />
                <span>{{ tab.label }}</span>
              </button>
            </div>

            <div v-if="activePaymentType === 'cash'" class="type-form">
              <div class="denom-row">
                <button v-for="value in DENOMS" :key="value" type="button" class="denom-btn" @click="addDenom(value)">
                  {{ value >= 1000 ? `${value / 1000}K` : value }}
                </button>
                <button type="button" class="denom-btn exact" :disabled="remainingAmount <= 0" @click="fillCashExact">พอดี</button>
              </div>
              <label class="field-label">
                จำนวนรับ
                <InputNumber v-model="cashAmount" mode="currency" currency="THB" locale="th-TH" :min="0" />
              </label>
            </div>

            <div v-else-if="activePaymentType === 'transfer'" class="type-form">
              <label class="field-label">
                สมุดบัญชี
                <Select v-model="transferDraft.pass_book_code" :options="passBookOptions" option-label="label" option-value="code" placeholder="สมุดบัญชี" />
              </label>
              <label class="field-label">
                วันที่โอน
                <InputText v-model="transferDraft.transfer_date" type="date" />
              </label>
              <label class="field-label">
                จำนวนเงิน
                <InputNumber v-model="transferDraft.amount" mode="currency" currency="THB" locale="th-TH" :min="0" />
              </label>
              <Button icon="pi pi-plus" label="เพิ่มรายการ" class="action-btn action-add" :disabled="!transferDraft.pass_book_code || !transferDraft.transfer_date || toMoney(transferDraft.amount) <= 0" @click="addTransferRow" />
            </div>

            <div v-else-if="activePaymentType === 'card'" class="type-form">
              <label class="field-label">
                ประเภทบัตร
                <Select v-model="cardDraft.credit_card_type" :options="creditTypeOptions" option-label="label" option-value="code" placeholder="ประเภทบัตร">
                  <template #option="{ option }">
                    <div class="credit-type-option">
                      <span>{{ option.name_1 || option.code }}</span>
                      <strong>{{ creditChargeRate(option) }}%</strong>
                    </div>
                  </template>
                </Select>
              </label>
              <label class="field-label">
                เลขที่บัตร
                <InputText v-model="cardDraft.card_number" placeholder="เลขที่บัตรเครดิต" />
              </label>
              <label class="field-label">
                เลขที่อนุมัติ
                <InputText v-model="cardDraft.no_approved" placeholder="รหัสอนุมัติ" />
              </label>
              <label class="field-label">
                จำนวนเงิน
                <InputNumber v-model="cardDraft.amount" mode="currency" currency="THB" locale="th-TH" :min="0" />
              </label>
              <div class="charge-preview">
                <span>ค่าธรรมเนียม ({{ draftCardChargeRate }}%)</span>
                <strong>{{ formatCurrency(draftCardCharge) }}</strong>
              </div>
              <Button icon="pi pi-plus" label="เพิ่มรายการ" class="action-btn action-add" :disabled="!cardDraft.credit_card_type || toMoney(cardDraft.amount) <= 0" @click="addCardRow" />
            </div>

            <div v-else-if="activePaymentType === 'tiger'" class="type-form">
              <div class="tiger-panel">
                <div v-if="tigerStatus === 'idle'" class="tiger-idle">
                  <span class="tiger-amount-label">ยอดชำระ</span>
                  <strong class="tiger-amount-value">{{ formatCurrency(tigerPayAmount) }}</strong>
                  <Button
                    icon="pi pi-desktop"
                    label="ส่งคำสั่งชำระที่เครื่อง Tiger"
                    :disabled="tigerPayAmount <= 0"
                    @click="startTigerPayment"
                  />
                </div>
                <div v-else-if="tigerStatus === 'requesting'" class="tiger-status">
                  <i class="pi pi-spin pi-spinner tiger-spinner" />
                  <span>กำลังส่งคำสั่งไปเครื่อง Tiger...</span>
                </div>
                <div v-else-if="tigerStatus === 'waiting' || tigerStatus === 'processing'" class="tiger-status">
                  <i class="pi pi-spin pi-spinner tiger-spinner" />
                  <span>กำลังรอการชำระเงินที่เครื่อง Tiger...</span>
                </div>
                <div v-else-if="tigerStatus === 'success'" class="tiger-status tiger-success">
                  <i class="pi pi-check-circle tiger-check" />
                  <span>{{ saving ? "ชำระเงินสำเร็จ กำลังบันทึก..." : "ชำระเงินสำเร็จ เพิ่มรายการ Tiger แล้ว" }}</span>
                  <Button label="รับ Tiger เพิ่ม" size="small" severity="secondary" @click="tigerStatus = 'idle'" />
                </div>
                <div v-else-if="tigerStatus === 'cancel'" class="tiger-status tiger-error">
                  <i class="pi pi-times-circle tiger-err-icon" />
                  <span>การชำระเงินถูกยกเลิกจากเครื่อง Tiger</span>
                  <Button label="ลองใหม่" size="small" severity="secondary" @click="tigerStatus = 'idle'" />
                </div>
                <div v-else class="tiger-status tiger-error">
                  <i class="pi pi-times-circle tiger-err-icon" />
                  <span>{{ tigerError || "การชำระเงินล้มเหลว" }}</span>
                  <Button label="ลองใหม่" size="small" severity="secondary" @click="tigerStatus = 'idle'" />
                </div>
              </div>
            </div>
          </section>
          </div>

        <Message v-if="currentStepIssues.length" severity="warn" :closable="false">
          <div v-for="error in currentStepIssues" :key="error">{{ error }}</div>
        </Message>
      </section>

      <section v-else class="step-card summary-step">
        <div class="done-card">
          <i class="pi pi-check-circle done-icon" />
          <div>
            <div class="done-title">รับเงินล่วงหน้าเรียบร้อย</div>
            <div class="done-docno">{{ savedDocNo || "-" }}</div>
          </div>
        </div>

        <div class="proof-section">
          <div class="proof-head">
            <div>
              <div class="proof-title">หลักฐานการรับชำระ</div>
              <div class="proof-subtitle">เพิ่มได้หลายรูปต่อเอกสาร</div>
            </div>
            <label class="proof-upload-btn" :class="{ disabled: imageUploading || !savedDocNo }">
              <i class="pi pi-upload" />
              <span>{{ imageUploading ? "กำลังบันทึก..." : "เพิ่มรูป" }}</span>
              <input type="file" accept="image/*" multiple :disabled="imageUploading || !savedDocNo" @change="onDocImageSelected" />
            </label>
          </div>
          <div v-if="imageError" class="proof-error">
            <i class="pi pi-exclamation-circle" />
            {{ imageError }}
          </div>
          <div v-if="docImages.length" class="proof-grid">
            <div v-for="image in docImages" :key="image.guid_code" class="proof-item">
              <a :href="getDocImageUrl(image.guid_code)" target="_blank" rel="noopener">
                <img :src="getDocImageUrl(image.guid_code)" alt="หลักฐานการรับชำระ" />
              </a>
              <button type="button" class="proof-remove" aria-label="ลบรูป" @click="removeDocImage(image.guid_code)">
                <i class="pi pi-times" />
              </button>
            </div>
          </div>
          <div v-else class="proof-empty">ยังไม่มีรูปหลักฐาน</div>
        </div>

        <div class="done-actions">
          <Button icon="pi pi-print" label="พิมพ์ฟอร์ม" class="action-btn action-print" :disabled="!savedDocNo" @click="openPrintDialog" />
          <Button icon="pi pi-history" label="ประวัติ" class="action-btn action-history" @click="router.push('/sales/advance-payment/history')" />
          <Button icon="pi pi-plus" label="เอกสารใหม่" class="action-btn action-new" @click="resetForm(false)" />
        </div>
      </section>
    </main>

    <footer v-if="currentStep !== 'summary'" class="step-footer">
      <div class="footer-actions">
        <Button icon="pi pi-chevron-left" label="กลับ" severity="secondary" outlined :disabled="isFirstStep" @click="prevStep" />
        <Button v-if="currentStep === 'payment'" icon="pi pi-save" label="บันทึก" :loading="saving" :disabled="!canSave" @click="saveDoc" />
        <Button v-else-if="!isLastStep" icon="pi pi-chevron-right" icon-pos="right" label="ถัดไป" :disabled="!canGoNext" @click="nextStep" />
      </div>
    </footer>

    <Dialog v-model:visible="detailDialogVisible" modal header="รายละเอียดเอกสาร" :style="{ width: 'min(780px, calc(100vw - 2rem))' }">
      <div v-if="detailLoading" class="dialog-state">กำลังโหลด...</div>
      <div v-else-if="savedDetail" class="detail-dialog">
        <div class="detail-title">
          <strong>{{ savedDetail.header?.doc_no }}</strong>
          <span>{{ formatDate(savedDetail.header?.doc_date) }}</span>
        </div>
        <div class="detail-meta">
          <span>{{ savedDetail.header?.cust_code }}</span>
          <span>{{ savedDetail.header?.cust_name }}</span>
          <strong>{{ formatCurrency(savedDetail.header?.total_amount) }}</strong>
        </div>
        <DataTable :value="savedDetail.details || []" size="small">
          <Column field="remark" header="รายการ" />
          <Column field="amount" header="ยอด">
            <template #body="{ data }">{{ formatCurrency(data.amount) }}</template>
          </Column>
        </DataTable>
        <div class="summary-box dialog-summary">
          <div><span>เงินสด</span><strong>{{ formatCurrency(savedDetail.payment?.cash_amount) }}</strong></div>
          <div><span>โอน</span><strong>{{ formatCurrency(savedDetail.payment?.tranfer_amount) }}</strong></div>
          <div><span>บัตร</span><strong>{{ formatCurrency(savedDetail.payment?.card_amount) }}</strong></div>
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
        <div class="print-doc-no">{{ savedDocNo }}</div>
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
              :input-id="`advance-print-form-${form.formcode}`"
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
        <Button icon="pi pi-print" label="พิมพ์" :disabled="printLoading || !selectedPrintForms.length" @click="confirmPrintForms" />
      </template>
    </Dialog>

    <Dialog
      :visible="tigerStatus === 'waiting' || tigerStatus === 'processing'"
      modal
      :closable="false"
      :close-on-escape="false"
      :draggable="false"
      :header="TIGER_MOCK ? 'TEST MODE - กรุณาชำระที่เครื่องรับเงิน' : 'กรุณาชำระที่เครื่องรับเงิน'"
      :style="{ width: '420px', maxWidth: '95vw' }"
    >
      <div class="tiger-dialog-body">
        <div v-if="TIGER_MOCK" class="tiger-mock-banner">
          กำลังจำลองการชำระเงิน จะสำเร็จอัตโนมัติในประมาณ 5 วินาที
        </div>
        <i class="pi pi-spin pi-spinner tiger-spinner" />
        <div class="tiger-amount-value">{{ formatCurrency(tigerPayAmount) }}</div>
        <div class="tiger-info-box">
          <div class="tiger-info-row">
            <span class="tiger-info-label">Transaction ID:</span>
            <span class="tiger-info-val">{{ tigerId }}</span>
          </div>
          <div class="tiger-info-row">
            <span class="tiger-info-label">ลูกค้า:</span>
            <span class="tiger-info-val">{{ selectedCustomer ? customerName(selectedCustomer) : "ลูกค้าทั่วไป" }}</span>
          </div>
        </div>
      </div>
      <template #footer>
        <Button v-if="tigerCancel" icon="pi pi-times" label="ยกเลิก" severity="secondary" @click="cancelTiger" />
      </template>
    </Dialog>

    <Dialog v-model:visible="customerDialogVisible" modal header="ค้นหาลูกค้า" :style="{ width: 'min(760px, calc(100vw - 2rem))' }">
      <div class="customer-dialog">
        <div class="customer-dialog-search">
          <InputText v-model="customerSearch" autofocus placeholder="ค้นหารหัสหรือชื่อลูกค้า" @input="handleCustomerInput" />
          <Button icon="pi pi-search" label="ค้นหา" class="action-btn action-search" :loading="customerLoading" @click="searchCustomers" />
        </div>
        <div v-if="customerLoading" class="dialog-state">กำลังค้นหา...</div>
        <div v-else-if="customerSearch.trim().length < 2" class="dialog-state">พิมพ์อย่างน้อย 2 ตัวอักษร</div>
        <div v-else-if="!customers.length" class="dialog-state">ไม่พบลูกค้า</div>
        <div v-else class="customer-dialog-list">
          <button v-for="row in customers.slice(0, 30)" :key="row.code" type="button" @click="selectCustomer(row)">
            <strong>{{ row.code }}</strong>
            <span>{{ customerName(row) }}</span>
          </button>
        </div>
      </div>
    </Dialog>
  </div>

</template>

<style scoped>
.advance-step-page {
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

.saved-banner {
  flex: 0 0 auto;
}

.step-title h1,
.step-head h2,
.method-head h3 {
  margin: 0;
  letter-spacing: 0;
}

.step-title h1 {
  font-size: 1.25rem;
}

.step-title span,
.step-kicker,
.muted-label,
.doc-chip span,
.balance-pill span,
.payment-meter span,
.payment-breakdown span,
.review-panel small {
  color: var(--p-text-color-secondary);
  font-size: 0.84rem;
}

.step-actions,
.footer-actions,
.method-head,
.line-section-head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.step-actions {
  justify-content: flex-end;
  flex: 0 0 auto;
}

.step-actions :deep(.p-button) {
  min-width: 7.5rem;
  white-space: nowrap;
}

.footer-actions {
  flex: 0 0 auto;
  justify-content: flex-end;
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

.stepper {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  padding: 0.25rem;
  gap: 0.25rem;
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

.stepper-item.done .stepper-icon {
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
}

.stepper-icon {
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

.stepper-text {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.stepper-text strong {
  font-size: 0.95rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.step-shell {
  min-height: 0;
  flex: 1;
  overflow: auto;
}

.step-card {
  min-height: 100%;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  border-color: transparent;
}

.step-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.step-head h2 {
  font-size: 1.25rem;
}

.field-label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-weight: 700;
  color: var(--p-text-color);
}

.field-label :deep(.p-inputtext),
.field-label :deep(.p-select),
.field-label :deep(.p-inputnumber),
.customer-search-block :deep(.p-inputtext),
.payment-method :deep(.p-inputnumber),
.payment-row :deep(.p-inputtext),
.payment-row :deep(.p-inputnumber),
.payment-row :deep(.p-select) {
  width: 100%;
}

.customer-search-block :deep(.p-inputtext) {
  min-height: 3.25rem;
  font-size: 1.15rem;
}

.customer-picker {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 0.45rem;
}

.customer-picker :deep(.p-inputtext) {
  width: 100%;
}

.selected-panel,
.balance-note {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.7rem 0.75rem;
  border-radius: 8px;
  background: var(--p-surface-100);
}

.selected-panel strong {
  display: block;
  margin-top: 0.15rem;
  font-size: 1.1rem;
}

.balance-pill,
.doc-chip {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.15rem;
}

.balance-pill strong,
.doc-chip strong {
  font-size: 1.2rem;
}

.doc-field-grid {
  display: grid;
  grid-template-columns: minmax(220px, 1.4fr) repeat(3, minmax(130px, 0.7fr));
  gap: 0.55rem;
}

.doc-intake-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: end;
}

.customer-field {
  grid-column: span 2;
}

.line-section-head {
  justify-content: space-between;
  padding-top: 0.25rem;
}

.line-section-head strong {
  display: block;
  margin-top: 0.1rem;
  font-size: 1.35rem;
}

.step-line-list,
.payment-step {
  gap: 0.75rem;
}

.step-line-row {
  display: grid;
  grid-template-columns: 2.25rem minmax(180px, 1fr) minmax(180px, 0.5fr) 2.5rem;
  align-items: center;
  gap: 0.55rem;
  padding: 0.45rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  background: var(--p-surface-0);
}

.line-index {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--p-surface-100);
  color: var(--p-text-color-secondary);
  font-weight: 800;
}

.payment-meter,
.payment-breakdown,
.review-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;
}

.payment-meter div,
.payment-breakdown div,
.review-panel {
  min-height: 3.8rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  padding: 0.6rem 0.65rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.25rem;
  background: var(--p-surface-0);
}

.payment-meter strong,
.payment-breakdown strong,
.review-panel strong {
  font-size: 1.1rem;
}

.payment-method {
  border-top: 1px solid var(--p-surface-border);
  padding-top: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.method-head {
  justify-content: space-between;
}

.payment-row {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(160px, 0.5fr) 2.5rem;
  align-items: center;
  gap: 0.55rem;
}

.payment-row.card-row {
  grid-template-columns: minmax(170px, 0.9fr) minmax(150px, 0.8fr) minmax(145px, 0.55fr) minmax(145px, 0.55fr) 2.5rem;
}

.payment-row.cheque-row {
  grid-template-columns: minmax(180px, 0.8fr) minmax(150px, 0.6fr) minmax(150px, 0.55fr) 2.5rem;
}

.payment-workspace {
  display: grid;
  grid-template-columns: minmax(260px, 0.9fr) minmax(300px, 1.1fr);
  align-items: start;
  gap: 0.6rem;
}

.payment-entry-list,
.add-payment-panel {
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  background: var(--p-surface-0);
}

.payment-entry-list {
  min-height: 11rem;
  padding: 0.5rem;
}

.entries-empty {
  min-height: 9.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--p-text-color-secondary);
  border-radius: 8px;
  background: var(--p-surface-50);
}

.entries-list,
.type-form {
  display: grid;
  gap: 0.6rem;
}

.entry-row {
  display: grid;
  grid-template-columns: 2.5rem minmax(0, 1fr) auto 2.5rem;
  align-items: center;
  gap: 0.65rem;
  min-height: 3.5rem;
  padding: 0.45rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  background: var(--p-surface-0);
}

.entry-icon {
  width: 2.35rem;
  height: 2.35rem;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--p-primary-color) 12%, var(--p-surface-0));
  color: var(--p-primary-color);
}

.entry-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.entry-info strong,
.entry-info small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-info small,
.charge-preview span {
  color: var(--p-text-color-secondary);
}

.entry-amount {
  font-weight: 800;
  color: var(--p-primary-color);
  white-space: nowrap;
}

.add-payment-panel {
  display: grid;
  gap: 0.55rem;
  padding: 0.55rem;
}

.type-tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.45rem;
  padding: 0.35rem;
  border-radius: 8px;
  background: var(--p-surface-100);
}

.type-tab {
  min-height: 2.6rem;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--p-text-color);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.type-tab.active {
  border-color: var(--p-primary-color);
  background: var(--p-surface-0);
  color: var(--p-primary-color);
}

.denom-row {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.45rem;
}

.denom-btn {
  min-height: 2.4rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  background: var(--p-surface-0);
  color: var(--p-text-color);
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.denom-btn.exact {
  border-color: var(--p-primary-color);
  color: var(--p-primary-color);
}

.charge-preview {
  min-height: 3rem;
  border-radius: 8px;
  padding: 0.65rem 0.75rem;
  background: var(--p-surface-100);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.credit-type-option {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.credit-type-option span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.credit-type-option strong {
  color: var(--p-primary-color);
  white-space: nowrap;
}

.tiger-panel {
  display: grid;
  place-items: center;
  gap: 0.75rem;
  min-height: 10rem;
  padding: 0.75rem;
  border-radius: 8px;
  background: var(--p-surface-50);
}

.tiger-idle,
.tiger-status,
.tiger-dialog-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  text-align: center;
}

.tiger-amount-label,
.tiger-info-label {
  color: var(--p-text-color-secondary);
  font-size: 0.85rem;
}

.tiger-amount-value {
  font-size: 1.8rem;
  font-weight: 900;
  color: var(--p-primary-color);
}

.tiger-spinner {
  font-size: 1.75rem;
  color: var(--p-primary-color);
}

.tiger-success,
.tiger-check {
  color: #16a34a;
}

.tiger-error,
.tiger-err-icon {
  color: #dc2626;
}

.tiger-check,
.tiger-err-icon {
  font-size: 2rem;
}

.tiger-info-box {
  width: 100%;
  display: grid;
  gap: 0.45rem;
  padding: 0.75rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  background: var(--p-surface-50);
}

.tiger-info-row {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.9rem;
}

.tiger-info-val {
  min-width: 0;
  font-weight: 800;
  text-align: right;
  word-break: break-word;
}

.tiger-mock-banner {
  width: 100%;
  padding: 0.55rem 0.75rem;
  border: 1px dashed #f59e0b;
  border-radius: 8px;
  background: #fffbeb;
  color: #92400e;
  font-size: 0.85rem;
}

.review-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.review-lines {
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  overflow: hidden;
}

.review-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 0.9rem;
  border-bottom: 1px solid var(--p-surface-border);
}

.review-line:last-child {
  border-bottom: 0;
}

.summary-step {
  min-height: 100%;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 1.25rem;
  text-align: center;
}

.summary-step .done-card,
.summary-step .proof-section,
.summary-step .done-actions {
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
  color: var(--p-text-color);
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
  color: var(--p-text-color);
}

.proof-subtitle {
  margin-top: 0.1rem;
  color: var(--p-text-color-secondary);
  font-size: 0.85rem;
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

.proof-error {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: #dc2626;
  font-weight: 700;
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

.proof-empty {
  min-height: 5rem;
  border-radius: 8px;
  background: var(--p-surface-50);
  color: var(--p-text-color-secondary);
  display: grid;
  place-items: center;
}

.done-actions {
  display: flex;
  justify-content: center;
  gap: 0.55rem;
  flex-wrap: wrap;
}

.done-actions :deep(.p-button) {
  min-width: 9rem;
}

.print-dialog-body {
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

.print-form-list {
  display: grid;
  gap: 0.55rem;
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

.step-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.6rem;
  padding: 0.55rem 0.75rem;
  border-color: transparent;
  flex: 0 0 auto;
  min-width: 0;
}

@media (max-width: 1024px) {
  .step-actions,
  .footer-actions {
    justify-content: flex-end;
  }

  .doc-field-grid,
  .doc-intake-grid,
  .payment-meter,
  .payment-breakdown {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .customer-field {
    grid-column: span 2;
  }

  .payment-workspace {
    grid-template-columns: 1fr;
  }

  .payment-row,
  .payment-row.card-row,
  .payment-row.cheque-row {
    grid-template-columns: 1fr;
    border: 1px solid var(--p-surface-border);
    border-radius: 8px;
    padding: 0.65rem;
  }
}

@media (max-width: 720px) {
  .advance-step-page {
    padding: 0.5rem;
    gap: 0.45rem;
  }

  .step-top-strip,
  .step-footer {
    align-items: stretch;
    flex-direction: column;
  }

  .step-actions,
  .footer-actions {
    justify-content: stretch;
  }

  .step-actions :deep(.p-button),
  .footer-actions :deep(.p-button) {
    flex: 1 1 0;
    min-width: 0;
  }

  .stepper {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stepper-item {
    min-height: 3.4rem;
    padding: 0.45rem;
  }

  .selected-panel,
  .step-head,
  .line-section-head {
    align-items: stretch;
    flex-direction: column;
  }

  .balance-pill,
  .doc-chip {
    align-items: flex-start;
  }

  .doc-field-grid,
  .doc-intake-grid,
  .step-line-row,
  .payment-meter,
  .payment-breakdown,
  .review-grid {
    grid-template-columns: 1fr;
  }

  .customer-field {
    grid-column: auto;
  }

  .type-tabs,
  .denom-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .customer-picker,
  .customer-dialog-search,
  .customer-dialog-list {
    grid-template-columns: 1fr;
  }

  .entry-row {
    grid-template-columns: 2.5rem minmax(0, 1fr) 2.5rem;
  }

  .entry-amount {
    grid-column: 2 / -1;
  }

  .summary-step {
    justify-content: flex-start;
    padding: 0.75rem;
  }

  .done-card,
  .proof-head {
    align-items: center;
    flex-direction: column;
  }

  .done-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .done-actions :deep(.p-button) {
    width: 100%;
  }
}

.advance-page {
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
.detail-head h2,
.pay-head h2,
.pay-head h3 {
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

.doc-preview strong {
  font-size: 1.05rem;
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
  grid-template-columns: minmax(260px, 0.8fr) minmax(420px, 1.5fr) minmax(330px, 0.95fr);
  gap: 0.75rem;
}

.history-panel,
.editor-panel,
.payment-panel {
  min-height: 0;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  background: var(--p-surface-0);
}

.history-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-head,
.detail-head,
.pay-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.panel-head,
.history-filter {
  padding: 0.875rem;
}

.history-filter {
  display: grid;
  gap: 0.5rem;
  border-top: 1px solid var(--p-surface-border);
  border-bottom: 1px solid var(--p-surface-border);
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

.history-table {
  min-height: 0;
}

.editor-panel,
.payment-panel {
  overflow: auto;
  padding: 0.875rem;
}

.doc-fields {
  display: grid;
  grid-template-columns: 1.4fr 1fr 0.8fr 0.8fr;
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
.customer-results button,
.balance-strip {
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

.selected-customer em {
  color: var(--p-primary-color);
  font-style: normal;
  font-weight: 700;
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

.line-list {
  display: grid;
  gap: 0.5rem;
  margin-top: 0.625rem;
}

.line-row {
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr) minmax(150px, 0.45fr) auto;
  align-items: center;
  gap: 0.5rem;
}

.line-index {
  color: var(--p-text-color-secondary);
  text-align: center;
}

.remark-field {
  margin-top: 0.875rem;
}

.balance-strip {
  margin-top: 0.875rem;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  background: var(--p-surface-100);
}

.balance-strip span {
  flex: 1;
}

.payment-panel {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.payment-total {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 0.875rem;
  border-bottom: 1px solid var(--p-surface-border);
}

.payment-total span {
  color: var(--p-text-color-secondary);
}

.payment-total strong {
  color: var(--p-primary-color);
  font-size: 1.35rem;
}

.pay-section {
  display: grid;
  gap: 0.5rem;
}

.pay-row {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(130px, 0.9fr) auto;
  gap: 0.5rem;
  align-items: center;
}

.card-row {
  grid-template-columns: minmax(110px, 0.8fr) minmax(110px, 0.8fr) minmax(120px, 0.8fr) minmax(100px, 0.7fr) auto;
}

.cheque-row {
  grid-template-columns: minmax(120px, 0.9fr) minmax(130px, 0.9fr) minmax(120px, 0.8fr) auto;
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
  justify-content: space-between;
  gap: 1rem;
}

.summary-box span {
  color: var(--p-text-color-secondary);
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

.customer-dialog {
  display: grid;
  gap: 0.75rem;
}

.customer-dialog-search {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.5rem;
}

.customer-dialog-list {
  max-height: min(58vh, 520px);
  overflow: auto;
  display: grid;
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

.customer-dialog-list button:hover {
  border-color: var(--p-primary-color);
  background: color-mix(in srgb, var(--p-primary-color) 7%, var(--p-surface-0));
}

.dialog-state {
  min-height: 8rem;
  display: grid;
  place-items: center;
  color: var(--p-text-color-secondary);
}

@media (max-width: 1180px) {
  .top-strip {
    grid-template-columns: 1fr auto;
  }

  .doc-preview {
    align-items: flex-start;
  }

  .top-actions {
    grid-column: 1 / -1;
  }

  .work-grid {
    grid-template-columns: minmax(0, 1fr);
    overflow: visible;
  }

  .history-panel {
    max-height: 320px;
  }

  .doc-fields {
    grid-template-columns: 1fr 1fr;
  }
}

@media (min-width: 960px) and (max-width: 1180px) {
  .top-strip {
    grid-template-columns: minmax(190px, 1fr) minmax(160px, auto) auto;
  }

  .doc-preview {
    align-items: flex-end;
  }

  .top-actions {
    grid-column: auto;
  }

  .work-grid {
    grid-template-columns: minmax(220px, 0.75fr) minmax(340px, 1.35fr) minmax(280px, 0.95fr);
    overflow: hidden;
  }

  .history-panel {
    max-height: none;
  }

  .editor-panel,
  .payment-panel {
    padding: 0.75rem;
  }

  .line-row {
    grid-template-columns: 1.75rem minmax(0, 1fr) minmax(120px, 0.5fr) auto;
  }

  .pay-row,
  .card-row,
  .cheque-row {
    grid-template-columns: minmax(0, 1fr);
    align-items: stretch;
  }
}

@media (max-width: 760px) {
  .top-strip,
  .doc-fields,
  .line-row,
  .pay-row,
  .card-row,
  .cheque-row,
  .date-row {
    grid-template-columns: 1fr;
  }

  .top-actions,
  .customer-search {
    grid-template-columns: 1fr;
  }

  .selected-customer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
