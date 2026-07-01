<script setup>
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import Button from "primevue/button";
import Checkbox from "primevue/checkbox";
import Dialog from "primevue/dialog";
import InputNumber from "primevue/inputnumber";
import InputText from "primevue/inputtext";
import Message from "primevue/message";
import ProgressSpinner from "primevue/progressspinner";
import Select from "primevue/select";
import { useToast } from "primevue/usetoast";
import { deleteDocImage, getDocImageUrl, getDocImagesList, saveDocImage } from "@/services/docImageService";
import { getPassBookList, getCreditTypeList } from "@/services/sellService";
import { createTigerVoucher, getTigerConfig } from "@/services/tigerService";
import {
  getNextOtherExpenseDocNo,
  getNextOtherExpenseWhtDocNo,
  getOtherExpenseDocFormats,
  getOtherExpensePrintForms,
  getOtherExpenseWhtDocFormats,
  getOtherExpensePrintUrl,
  saveOtherExpense,
  searchExpenseList,
  searchOtherExpenseSuppliers,
} from "@/services/otherExpenseService";
import { useAuthStore } from "@/stores/auth";
import { usePosStore } from "@/stores/pos";
import { formatCurrency, todayISO } from "@/utils/formatters";
import { PERMISSIONS } from "@/utils/permissions";

const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();
const posStore = usePosStore();

const docFormats = ref([]);
const selectedDocFormatCode = ref("");
const nextDoc = ref(null);
const docDate = ref(todayISO());
const docTime = ref(currentTime());
const taxDocNo = ref("");
const selectedWhtDocFormatCode = ref("");
const whtTaxDocNo = ref("");
const taxDocDate = ref(todayISO());
const inquiryType = ref(1);
const vatType = ref(2);
const vatRate = ref(7);
const branchCode = ref("");
const remark = ref("");

const supplierSearch = ref("");
const suppliers = ref([]);
const supplierLoading = ref(false);
const selectedSupplier = ref(null);
const selectedWhtSupplier = ref(null);
const whtSupplierTouched = ref(false);
const supplierDialogVisible = ref(false);
const supplierDialogTarget = ref("document");

let localRowId = 0;

const expenseOptions = ref([]);
const expenseSearch = ref("");
const detailRows = ref([newDetailRow()]);
const DENOMS = [20, 50, 100, 500, 1000];

const cashAmount = ref(null);
const transferRows = ref([]);
const cardRows = ref([]);
const chequeRows = ref([]);
const tigerRows = ref([]);
const tigerDraftAmount = ref(null);
const whtRows = ref([]);
const activePaymentType = ref("cash");
const transferDraft = ref(null);
const cardDraft = ref(null);
const chequeDraft = ref(null);
const whtDraft = ref(null);
const passBooks = ref([]);
const creditTypes = ref([]);
const whtDocFormats = ref([]);
const tigerEnabled = ref(false);
const tigerStatus = ref("idle");
const tigerError = ref("");
const tigerLoginDialogVisible = ref(false);
const tigerLoginForm = ref(newTigerLoginForm());
const saving = ref(false);
const savedDocNo = ref("");
const docImages = ref([]);
const imageUploading = ref(false);
const imageError = ref("");
const printDialogVisible = ref(false);
const printLoading = ref(false);
const printError = ref("");
const printForms = ref([]);
const selectedPrintForms = ref([]);
const paymentTopRef = ref(null);

let searchTimer = null;

const vatTypeOptions = [
  { label: "ภาษีแยกนอก", value: 0 },
  { label: "ภาษีรวมใน", value: 1 },
  { label: "ภาษีอัตราศูนย์", value: 2 },
  { label: "ไม่กระทบภาษี", value: 3 },
];

const inquiryTypeOptions = [
  { label: "ค่าใช้จ่ายเงินเชื่อ", value: 0 },
  { label: "ค่าใช้จ่ายเงินสด", value: 1 },
  { label: "ค่าใช้จ่ายเงินสด (สินค้าบริการ)", value: 2 },
  { label: "ค่าใช้จ่ายเงินเชื่อ (สินค้าบริการ)", value: 3 },
];

const allSteps = [
  { key: "document", label: "ข้อมูลเอกสาร", icon: "pi pi-file" },
  { key: "detail", label: "รายละเอียด", icon: "pi pi-list" },
  { key: "payment", label: "จ่ายเงิน", icon: "pi pi-wallet" },
  { key: "summary", label: "สรุป", icon: "pi pi-check-circle" },
];
const currentStep = ref("document");
const isCashExpense = computed(() => [1, 2].includes(Number(inquiryType.value)));
const steps = computed(() => allSteps.filter((step) => isCashExpense.value || step.key !== "payment"));
const currentStepIndex = computed(() => Math.max(0, steps.value.findIndex((step) => step.key === currentStep.value)));
const currentStepMeta = computed(() => steps.value[currentStepIndex.value] || steps.value[0]);
const isFirstStep = computed(() => currentStepIndex.value === 0);
const isLastStep = computed(() => currentStepIndex.value === steps.value.length - 1);

const canCreate = computed(() => authStore.hasPermission(PERMISSIONS.cashOtherExpenseCreate));
const canViewHistory = computed(() => authStore.hasPermission(PERMISSIONS.cashOtherExpenseView));
const docFormatOptions = computed(() => docFormats.value.map((row) => ({ ...row, label: `${row.code || ""} - ${row.name_1 || ""}`.trim() })));
const whtDocFormatOptions = computed(() => whtDocFormats.value.map((row) => ({ ...row, label: `${row.code || ""} - ${row.name_1 || ""}`.trim() })));
const passBookOptions = computed(() => passBooks.value.map((row) => ({ ...row, label: `${row.code || ""} ${row.bank_name || row.bank_code || ""}${row.book_name ? ` - ${row.book_name}` : ""}`.trim() })));
const creditTypeOptions = computed(() => creditTypes.value.map((row) => ({ ...row, label: `${row.code || ""} ${row.name_1 || ""}`.trim() })));
const expenseSelectOptions = computed(() => expenseOptions.value.map((row) => ({ ...row, label: `${row.code || ""} ${row.name_1 || ""}`.trim() })));
const selectedCardType = computed(() => findCreditType(cardDraft.value?.credit_card_type));
const draftCardChargeRate = computed(() => creditChargeRate(selectedCardType.value));
const draftCardCharge = computed(() => rnd(toMoney(cardDraft.value?.amount) * draftCardChargeRate.value / 100));
const validDetailRows = computed(() => detailRows.value.filter((row) => row.expense_code && toMoney(row.amount) > 0));
const detailTotal = computed(() => rnd(validDetailRows.value.reduce((sum, row) => sum + toMoney(row.amount), 0)));
const vatTotals = computed(() => calcVatTotals(detailTotal.value, vatType.value, vatRate.value));
const transferTotal = computed(() => rnd(transferRows.value.reduce((sum, row) => sum + toMoney(row.amount), 0)));
const cardChargeTotal = computed(() => rnd(cardRows.value.reduce((sum, row) => sum + toMoney(row.charge), 0)));
const cardTotal = computed(() => rnd(cardRows.value.reduce((sum, row) => sum + toMoney(row.amount) + toMoney(row.charge), 0)));
const chequeTotal = computed(() => rnd(chequeRows.value.reduce((sum, row) => sum + toMoney(row.amount), 0)));
const tigerTotal = computed(() => rnd(tigerRows.value.reduce((sum, row) => sum + toMoney(row.amount), 0)));
const totalDue = computed(() => rnd(vatTotals.value.total_amount + cardChargeTotal.value));
const whtBaseTotal = computed(() => rnd(whtRows.value.reduce((sum, row) => sum + toMoney(row.amount), 0)));
const whtTaxTotal = computed(() => rnd(whtRows.value.reduce((sum, row) => sum + calcWhtTax(row), 0)));
const netPayable = computed(() => Math.max(0, rnd(totalDue.value - whtTaxTotal.value)));
const paidTotal = computed(() => rnd(toMoney(cashAmount.value) + transferTotal.value + cardTotal.value + chequeTotal.value + tigerTotal.value));
const remainingAmount = computed(() => Math.max(0, rnd(netPayable.value - paidTotal.value)));
const overpaidAmount = computed(() => Math.max(0, rnd(paidTotal.value - netPayable.value)));
const tigerPayAmount = computed(() => rnd(toMoney(tigerDraftAmount.value)));
const tigerAmountTooHigh = computed(() => tigerPayAmount.value > remainingAmount.value + 0.01);
const showSupplierResults = computed(() => !selectedSupplier.value && supplierSearch.value.trim().length >= 2);
const supplierDialogTitle = computed(() => (supplierDialogTarget.value === "wht" ? "ค้นหาเจ้าหนี้หัก ณ ที่จ่าย" : "ค้นหาเจ้าหนี้"));
const paymentTypeTabs = computed(() => {
  const tabs = [
    { key: "cash", label: "เงินสด", icon: "pi pi-money-bill" },
    { key: "transfer", label: "เงินโอน", icon: "pi pi-send" },
    { key: "card", label: "บัตร", icon: "pi pi-credit-card" },
    { key: "cheque", label: "เช็ค", icon: "pi pi-wallet" },
    { key: "wht", label: "หัก ณ ที่จ่าย", icon: "pi pi-percentage" },
  ];
  if (tigerEnabled.value) tabs.push({ key: "tiger", label: "Tiger", icon: "pi pi-ticket" });
  return tabs;
});
const paymentEntries = computed(() => {
  const rows = [];
  if (toMoney(cashAmount.value) > 0) rows.push({ id: "cash", type: "cash", label: "เงินสด", amount: toMoney(cashAmount.value), sub: "" });
  transferRows.value.forEach((row) => rows.push({ id: row.id, type: "transfer", label: passBookLabel(row.pass_book_code), amount: toMoney(row.amount), sub: "เงินโอน" }));
  cardRows.value.forEach((row) => rows.push({
    id: row.id,
    type: "card",
    label: creditTypeLabel(row.credit_card_type),
    amount: rnd(toMoney(row.amount) + toMoney(row.charge)),
    sub: `ยอดบัตร ${formatCurrency(row.amount)} / ค่าธรรมเนียม ${formatCurrency(row.charge)}`,
  }));
  chequeRows.value.forEach((row) => rows.push({ id: row.id, type: "cheque", label: row.trans_number || "เช็ค", amount: toMoney(row.amount), sub: row.chq_due_date || "" }));
  tigerRows.value.forEach((row) => rows.push({
    id: row.id,
    type: "tiger",
    label: "Tiger Voucher",
    amount: toMoney(row.amount),
    sub: row.voucher_num ? `Voucher ${row.voucher_num}` : "",
  }));
  whtRows.value.forEach((row) => rows.push({
    id: row.id,
    type: "wht",
    label: "หัก ณ ที่จ่าย",
    amount: calcWhtTax(row),
    sub: `${row.income_type || "ภาษีหัก"} ${formatCurrency(row.amount)} x ${toMoney(row.tax_rate)}%`,
  }));
  return rows;
});

const validationErrors = computed(() => {
  const errors = [];
  if (!selectedSupplier.value?.code) errors.push("เลือกเจ้าหนี้ก่อนบันทึก");
  if (!selectedDocFormatCode.value) errors.push("ไม่พบรูปแบบเอกสาร EPO");
  if (!validDetailRows.value.length) errors.push("ระบุรายการค่าใช้จ่ายอย่างน้อย 1 รายการ");
  if (isCashExpense.value) {
    if (whtTaxTotal.value > totalDue.value) errors.push("ยอดหัก ณ ที่จ่ายมากกว่ายอดสุทธิ");
    if (whtRows.value.length && !selectedWhtDocFormatCode.value) errors.push("เลือกรูปแบบเลขที่หัก ณ ที่จ่าย");
    if (whtRows.value.length && !selectedWhtSupplier.value?.code) errors.push("เลือกเจ้าหนี้หัก ณ ที่จ่าย");
    for (const [index, row] of whtRows.value.entries()) {
      if (toMoney(row.amount) > 0 && !String(row.income_type || "").trim()) errors.push(`แถวหัก ณ ที่จ่าย ${index + 1}: ระบุประเภทเงินได้`);
      if (toMoney(row.amount) > 0 && toMoney(row.tax_rate) <= 0) errors.push(`แถวหัก ณ ที่จ่าย ${index + 1}: ระบุอัตราภาษี`);
    }
    if (remainingAmount.value > 0.01) errors.push("ยอดจ่ายยังน้อยกว่ายอดสุทธิ");
    if (overpaidAmount.value > 0.01) errors.push("ยอดจ่ายมากกว่ายอดสุทธิ");
    for (const [index, row] of transferRows.value.entries()) {
      if (toMoney(row.amount) > 0 && !row.pass_book_code) errors.push(`แถวโอน ${index + 1}: เลือกสมุดบัญชี`);
      if (toMoney(row.amount) > 0 && !row.transfer_date) errors.push(`แถวโอน ${index + 1}: เลือกวันที่โอน`);
    }
    for (const [index, row] of cardRows.value.entries()) {
      if (toMoney(row.amount) > 0 && !row.credit_card_type) errors.push(`แถวบัตร ${index + 1}: เลือกประเภทบัตร`);
    }
    for (const [index, row] of chequeRows.value.entries()) {
      if (toMoney(row.amount) > 0 && !String(row.trans_number || "").trim()) errors.push(`แถวเช็ค ${index + 1}: ระบุเลขที่เช็ค`);
    }
  }
  return errors;
});
const stepIssues = computed(() => ({
  document: [
    ...(!selectedSupplier.value?.code ? ["เลือกเจ้าหนี้ก่อน"] : []),
    ...(!selectedDocFormatCode.value ? ["เลือกรูปแบบเอกสารก่อน"] : []),
    ...(!docDate.value ? ["เลือกวันที่เอกสารก่อน"] : []),
  ],
  detail: validDetailRows.value.length ? [] : ["ระบุรายการค่าใช้จ่ายอย่างน้อย 1 รายการ"],
  payment: isCashExpense.value ? validationErrors.value.filter((text) => text.includes("ยอดจ่าย") || text.includes("ยอดหัก") || text.includes("แถว") || text.includes("เจ้าหนี้หัก")) : [],
  summary: savedDocNo.value ? [] : ["บันทึกเอกสารก่อนเข้าสู่หน้าสรุป"],
}));
const currentStepIssues = computed(() => stepIssues.value[currentStep.value] || []);
const canGoNext = computed(() => !currentStepIssues.value.length && !isLastStep.value && currentStep.value !== "payment" && !(currentStep.value === "detail" && !isCashExpense.value));
const canSave = computed(() => canCreate.value && !validationErrors.value.length && !saving.value);

watch(selectedDocFormatCode, () => loadNextDoc());
watch(selectedSupplier, (value) => {
  if (!whtSupplierTouched.value) selectedWhtSupplier.value = value;
});
watch(docDate, () => {
  taxDocDate.value = docDate.value;
  if (whtDraft.value) whtDraft.value.due_date = docDate.value;
  loadNextDoc();
  loadNextWhtDocNo();
});
watch(selectedWhtDocFormatCode, () => loadNextWhtDocNo());
watch(inquiryType, () => {
  if (!isCashExpense.value && currentStep.value === "payment") currentStep.value = "detail";
});
watch(activePaymentType, (type) => {
  if (type === "tiger" && tigerPayAmount.value <= 0 && remainingAmount.value > 0) {
    tigerDraftAmount.value = remainingAmount.value;
  }
});
watch(vatType, (value) => {
  if ([2, 3].includes(Number(value))) {
    vatRate.value = 0;
  } else if (toMoney(vatRate.value) <= 0) {
    vatRate.value = 7;
  }
});

onMounted(async () => {
  try {
    await Promise.all([loadDocFormats(), loadPaymentMasters(), loadExpenseOptions()]);
  } catch (ex) {
    notify("error", "โหลดข้อมูลเริ่มต้นไม่สำเร็จ", ex.message);
  }
});

function currentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function currentUserCode() {
  return authStore.employee?.user_code || "";
}

function makeRowId() {
  localRowId += 1;
  return `expense-row-${Date.now()}-${localRowId}`;
}

function newDetailRow() {
  return { id: makeRowId(), expense_code: "", expense_name: "", amount: null, branch_code: "", remark: "" };
}

function newTransferRow() {
  return { id: makeRowId(), pass_book_code: "", transfer_date: docDate.value || todayISO(), amount: null };
}

function newCardRow() {
  return { id: makeRowId(), credit_card_type: "", card_number: "", no_approved: "", amount: null, charge: 0 };
}

function newChequeRow() {
  return { id: makeRowId(), bank_code: "", bank_branch: "", trans_number: "", chq_due_date: docDate.value, amount: null };
}

function newWhtRow({ useBaseAmount = true } = {}) {
  const baseAmount = vatTotals.value.total_before_vat || detailTotal.value;
  return { id: makeRowId(), income_type: "หัก 3 %", amount: useBaseAmount && baseAmount > 0 ? baseAmount : null, tax_rate: 3, tax_value: 0, due_date: docDate.value };
}

transferDraft.value = newTransferRow();
cardDraft.value = newCardRow();
chequeDraft.value = newChequeRow();
whtDraft.value = newWhtRow();

function paymentEntryIcon(type) {
  if (type === "cash") return "pi pi-money-bill";
  if (type === "transfer") return "pi pi-send";
  if (type === "card") return "pi pi-credit-card";
  if (type === "cheque") return "pi pi-wallet";
  if (type === "tiger") return "pi pi-ticket";
  if (type === "wht") return "pi pi-percentage";
  return "pi pi-receipt";
}

function passBookLabel(code) {
  const book = passBooks.value.find((row) => row.code === code);
  if (!book) return code || "เงินโอน";
  return `${book.book_name || book.code || ""}${book.bank_name || book.bank_code ? ` (${book.bank_name || book.bank_code})` : ""}`.trim();
}

function creditTypeLabel(code) {
  const card = findCreditType(code);
  return card?.name_1 || code || "บัตร";
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

function toMoney(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function rnd(value) {
  return Math.round(toMoney(value) * 100) / 100;
}

function calcVatTotals(baseAmount, type, rateValue) {
  const amount = rnd(baseAmount);
  const rate = rnd(rateValue);
  if (!rate || [2, 3].includes(Number(type))) return { total_value: amount, total_before_vat: amount, total_vat_value: 0, total_amount: amount };
  if (Number(type) === 0) {
    const vat = rnd(amount * rate / 100);
    return { total_value: amount, total_before_vat: amount, total_vat_value: vat, total_amount: rnd(amount + vat) };
  }
  const vat = rnd(amount * rate / (100 + rate));
  const beforeVat = rnd(amount - vat);
  return { total_value: beforeVat, total_before_vat: beforeVat, total_vat_value: vat, total_amount: amount };
}

function calcWhtTax(row) {
  const explicit = toMoney(row?.tax_value);
  if (explicit > 0) return rnd(explicit);
  return rnd(toMoney(row?.amount) * toMoney(row?.tax_rate) / 100);
}

function notify(severity, summary, detail) {
  toast.add({ severity, summary, detail, life: 4200 });
}

async function loadDocFormats() {
  docFormats.value = await getOtherExpenseDocFormats({ user_code: currentUserCode() });
  selectedDocFormatCode.value = docFormats.value[0]?.code || "";
  await loadNextDoc();
}

async function loadNextDoc() {
  if (!selectedDocFormatCode.value || !docDate.value) return;
  try {
    nextDoc.value = await getNextOtherExpenseDocNo({
      doc_format_code: selectedDocFormatCode.value,
      doc_date: docDate.value,
      user_code: currentUserCode(),
    });
  } catch {
    nextDoc.value = null;
  }
}

async function loadNextWhtDocNo() {
  if (!selectedWhtDocFormatCode.value) {
    whtTaxDocNo.value = "";
    return;
  }
  try {
    const result = await getNextOtherExpenseWhtDocNo({
      doc_format_code: selectedWhtDocFormatCode.value,
      doc_date: whtDraft.value?.due_date || docDate.value,
      user_code: currentUserCode(),
    });
    whtTaxDocNo.value = result?.tax_doc_no || "";
  } catch {
    whtTaxDocNo.value = "";
  }
}

async function loadPaymentMasters() {
  const [books, cards, tigerConfig, whtFormats] = await Promise.all([
    getPassBookList(),
    getCreditTypeList(),
    getTigerConfig().catch(() => ({ enabled: false, voucher_enabled: false })),
    getOtherExpenseWhtDocFormats({ user_code: currentUserCode() }).catch(() => []),
  ]);
  passBooks.value = books;
  creditTypes.value = cards;
  whtDocFormats.value = whtFormats;
  selectedWhtDocFormatCode.value = whtFormats[0]?.code || "";
  await loadNextWhtDocNo();
  tigerEnabled.value = !!tigerConfig?.voucher_enabled;
  if (!tigerEnabled.value && activePaymentType.value === "tiger") activePaymentType.value = "cash";
}

async function loadExpenseOptions(search = "") {
  expenseOptions.value = await searchExpenseList({ search, user_code: currentUserCode() });
}

function onExpenseSearchInput(event) {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadExpenseOptions(event.target.value), 250);
}

async function searchSuppliers() {
  const text = supplierSearch.value.trim();
  if (text.length < 2) {
    suppliers.value = [];
    return;
  }
  supplierLoading.value = true;
  try {
    suppliers.value = await searchOtherExpenseSuppliers({ search: text, user_code: currentUserCode() });
  } finally {
    supplierLoading.value = false;
  }
}

function openSupplierDialog(target = "document") {
  supplierDialogTarget.value = target;
  supplierDialogVisible.value = true;
  supplierSearch.value = "";
  suppliers.value = [];
}

function selectSupplier(row) {
  if (supplierDialogTarget.value === "wht") {
    selectedWhtSupplier.value = row;
    whtSupplierTouched.value = true;
  } else {
    selectedSupplier.value = row;
    if (!whtSupplierTouched.value) selectedWhtSupplier.value = row;
  }
  supplierSearch.value = "";
  suppliers.value = [];
  supplierDialogVisible.value = false;
}

function clearSupplier() {
  selectedSupplier.value = null;
  if (!whtSupplierTouched.value) selectedWhtSupplier.value = null;
  supplierSearch.value = "";
  suppliers.value = [];
}

function resetWhtSupplierToHeader() {
  selectedWhtSupplier.value = selectedSupplier.value;
  whtSupplierTouched.value = false;
}

function onExpenseSelect(row) {
  const found = expenseOptions.value.find((item) => item.code === row.expense_code);
  row.expense_name = found?.name_1 || row.expense_name || "";
}

function addDetailRow() {
  detailRows.value.push(newDetailRow());
}

function removeRow(list, index) {
  list.splice(index, 1);
}

function goToStep(stepKey) {
  const targetIndex = steps.value.findIndex((step) => step.key === stepKey);
  if (targetIndex < 0) return;
  if (targetIndex <= currentStepIndex.value) {
    currentStep.value = stepKey;
    return;
  }
  for (let i = 0; i < targetIndex; i += 1) {
    const issues = stepIssues.value[steps.value[i].key] || [];
    if (issues.length) {
      currentStep.value = steps.value[i].key;
      return;
    }
  }
  if (stepKey === "summary" && !savedDocNo.value) return;
  currentStep.value = stepKey;
}

function goNext() {
  if (canGoNext.value) currentStep.value = steps.value[currentStepIndex.value + 1].key;
}

function goBack() {
  if (!isFirstStep.value) currentStep.value = steps.value[currentStepIndex.value - 1].key;
}

function fillRemainingToCash() {
  cashAmount.value = rnd(toMoney(cashAmount.value) + remainingAmount.value);
}

function addDenom(value) {
  cashAmount.value = rnd(toMoney(cashAmount.value) + value);
}

function addTransferRow() {
  const row = transferDraft.value;
  if (!row?.pass_book_code || !row?.transfer_date || toMoney(row.amount) <= 0) return;
  transferRows.value.push({ ...row, id: makeRowId(), amount: toMoney(row.amount) });
  transferDraft.value = newTransferRow();
}

function addCardRow() {
  const row = cardDraft.value;
  if (!row?.credit_card_type || toMoney(row.amount) <= 0) return;
  cardRows.value.push({
    ...row,
    id: makeRowId(),
    amount: toMoney(row.amount),
    charge: draftCardCharge.value,
  });
  cardDraft.value = newCardRow();
}

function addChequeRow() {
  const row = chequeDraft.value;
  if (!String(row?.trans_number || "").trim() || toMoney(row.amount) <= 0) return;
  chequeRows.value.push({ ...row, id: makeRowId(), amount: toMoney(row.amount) });
  chequeDraft.value = newChequeRow();
}

function newTigerLoginForm() {
  return { username: "", password: "", mobile: "" };
}

function clearTigerLoginForm() {
  tigerLoginForm.value = newTigerLoginForm();
}

function openTigerVoucherLoginDialog() {
  if (tigerPayAmount.value <= 0 || tigerStatus.value === "requesting") return;
  tigerError.value = "";
  clearTigerLoginForm();
  tigerLoginDialogVisible.value = true;
}

function closeTigerVoucherLoginDialog() {
  if (tigerStatus.value === "requesting") return;
  tigerLoginDialogVisible.value = false;
  clearTigerLoginForm();
}

function fillTigerRemaining() {
  tigerDraftAmount.value = remainingAmount.value;
}

function appendTigerVoucherToRemark(voucherNum, amount) {
  const number = String(voucherNum || "").trim();
  if (!number) return;
  const voucherAmount = toMoney(amount);
  const amountText = voucherAmount > 0 ? ` มูลค่า ${formatCurrency(voucherAmount)}` : "";
  const line = `Tiger Voucher: ${number}${amountText}`;
  const current = String(remark.value || "").trim();
  if (current.includes(number)) return;
  remark.value = current ? `${current} | ${line}` : line;
}

async function createTigerVoucherPayment() {
  const amount = tigerPayAmount.value;
  if (amount <= 0 || tigerStatus.value === "requesting") return;
  if (amount > remainingAmount.value + 0.01) {
    tigerError.value = "ยอด Tiger มากกว่ายอดคงเหลือ";
    return;
  }
  const auth = {
    username: String(tigerLoginForm.value.username || "").trim(),
    password: String(tigerLoginForm.value.password || ""),
    mobile: String(tigerLoginForm.value.mobile || "").trim(),
  };
  if (!auth.username || !auth.password) {
    tigerError.value = "กรุณากรอก username และ password ของ Tiger";
    return;
  }
  tigerStatus.value = "requesting";
  tigerError.value = "";
  try {
    const refNum = nextDoc.value?.doc_no || `EPO-${Date.now()}`;
    const voucher = await createTigerVoucher({
      auth,
      voucher: {
        amount,
        number_of_voucher: 1,
        ref_num: refNum,
        category: "other-expense",
        note: selectedSupplier.value ? `${selectedSupplier.value.code} ${selectedSupplier.value.name_1 || ""}`.trim() : "other-expense",
        authen_required: 1,
        approve_required: 0,
      },
    });
    const nextTigerAmount = Math.max(0, rnd(remainingAmount.value - amount));
    appendTigerVoucherToRemark(voucher.voucher_num, amount);
    tigerRows.value.push({
      id: makeRowId(),
      amount,
      voucher_num: voucher.voucher_num,
      voucher_code: voucher.voucher_code,
      ref_num: refNum,
    });
    tigerDraftAmount.value = nextTigerAmount || null;
    tigerStatus.value = "idle";
    tigerLoginDialogVisible.value = false;
    clearTigerLoginForm();
    notify("success", "สร้าง Tiger Voucher แล้ว", voucher.voucher_num);
  } catch (ex) {
    tigerStatus.value = "failed";
    tigerError.value = ex.message || "สร้าง Tiger voucher ไม่สำเร็จ";
    tigerLoginForm.value.password = "";
  }
}

async function scrollPaymentTop() {
  await nextTick();
  const target = paymentTopRef.value;
  if (target?.scrollIntoView) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

async function addWhtRow() {
  const row = whtDraft.value;
  if (!String(row?.income_type || "").trim() || toMoney(row.amount) <= 0 || toMoney(row.tax_rate) <= 0) return;
  whtRows.value.push({ ...row, id: makeRowId(), amount: toMoney(row.amount), tax_rate: toMoney(row.tax_rate), tax_value: calcWhtTax(row) });
  whtDraft.value = newWhtRow({ useBaseAmount: false });
  await loadNextWhtDocNo();
  await scrollPaymentTop();
}

function removePaymentEntry(entry) {
  if (entry.type === "cash") {
    cashAmount.value = null;
    return;
  }
  if (entry.type === "transfer") transferRows.value = transferRows.value.filter((row) => row.id !== entry.id);
  if (entry.type === "card") cardRows.value = cardRows.value.filter((row) => row.id !== entry.id);
  if (entry.type === "cheque") chequeRows.value = chequeRows.value.filter((row) => row.id !== entry.id);
  if (entry.type === "tiger") {
    tigerRows.value = tigerRows.value.filter((row) => row.id !== entry.id);
    tigerStatus.value = "idle";
    tigerError.value = "";
  }
  if (entry.type === "wht") whtRows.value = whtRows.value.filter((row) => row.id !== entry.id);
}

function goToHistoryOrHome() {
  router.push(canViewHistory.value ? "/cash/other-expense/history" : "/dashboard");
}

async function openPrintDialog() {
  if (!savedDocNo.value || printLoading.value) return;
  printDialogVisible.value = true;
  printLoading.value = true;
  printError.value = "";
  printForms.value = [];
  selectedPrintForms.value = [];
  try {
    const result = await getOtherExpensePrintForms(savedDocNo.value, currentUserCode());
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
  const url = getOtherExpensePrintUrl(savedDocNo.value, selectedPrintForms.value, currentUserCode());
  window.open(url, "_blank", "noopener");
  printDialogVisible.value = false;
}

async function resetForm(keepDocNo = false) {
  selectedDocFormatCode.value = docFormats.value[0]?.code || "";
  docDate.value = todayISO();
  docTime.value = currentTime();
  taxDocNo.value = "";
  selectedWhtDocFormatCode.value = whtDocFormats.value[0]?.code || "";
  whtTaxDocNo.value = "";
  taxDocDate.value = docDate.value;
  inquiryType.value = 1;
  vatType.value = 2;
  vatRate.value = 7;
  branchCode.value = "";
  remark.value = "";
  supplierSearch.value = "";
  suppliers.value = [];
  selectedSupplier.value = null;
  selectedWhtSupplier.value = null;
  whtSupplierTouched.value = false;
  detailRows.value = [newDetailRow()];
  cashAmount.value = null;
  transferRows.value = [];
  cardRows.value = [];
  chequeRows.value = [];
  tigerRows.value = [];
  tigerDraftAmount.value = null;
  whtRows.value = [];
  transferDraft.value = newTransferRow();
  cardDraft.value = newCardRow();
  chequeDraft.value = newChequeRow();
  whtDraft.value = newWhtRow();
  tigerStatus.value = "idle";
  tigerError.value = "";
  activePaymentType.value = "cash";
  if (!keepDocNo) savedDocNo.value = "";
  docImages.value = [];
  imageError.value = "";
  printDialogVisible.value = false;
  printForms.value = [];
  selectedPrintForms.value = [];
  printError.value = "";
  currentStep.value = "document";
  await loadNextDoc();
  await loadNextWhtDocNo();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function loadDocImages(docNo = savedDocNo.value) {
  if (!docNo) {
    docImages.value = [];
    return;
  }
  docImages.value = await getDocImagesList(docNo);
}

async function onDocImageSelected(event) {
  const docNo = savedDocNo.value;
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

async function removeDocImage(guidCode) {
  if (!guidCode) return;
  imageError.value = "";
  try {
    const result = await deleteDocImage(guidCode);
    if (result?.success === false) throw new Error(result.msg || "ลบรูปไม่สำเร็จ");
    await loadDocImages();
  } catch (ex) {
    imageError.value = ex.message || "ลบรูปไม่สำเร็จ";
  }
}

async function saveDocument() {
  if (!canSave.value) return;
  saving.value = true;
  try {
    const payload = {
      doc_date: docDate.value,
      doc_time: docTime.value,
      doc_format_code: selectedDocFormatCode.value,
      cust_code: selectedSupplier.value.code,
      branch_code: branchCode.value,
      tax_doc_no: taxDocNo.value,
      tax_doc_date: taxDocDate.value,
      wht_doc_format_code: selectedWhtDocFormatCode.value,
      wht_tax_doc_no: whtTaxDocNo.value,
      wht_supplier_code: selectedWhtSupplier.value?.code || selectedSupplier.value.code,
      inquiry_type: inquiryType.value,
      vat_type: vatType.value,
      vat_rate: vatRate.value,
      remark: remark.value,
      creator_code: currentUserCode(),
      emp_code: currentUserCode(),
      pos_id: posStore.posId || "",
      details: validDetailRows.value.map((row) => ({
        expense_code: row.expense_code,
        expense_name: row.expense_name,
        amount: toMoney(row.amount),
        branch_code: row.branch_code,
        remark: row.remark,
      })),
      payments: isCashExpense.value
        ? {
            cash_amount: toMoney(cashAmount.value),
            tiger_amount: tigerTotal.value,
            tiger: tigerRows.value.map((row) => ({
              amount: toMoney(row.amount),
              voucher_num: row.voucher_num,
              voucher_code: row.voucher_code,
              ref_num: row.ref_num,
            })),
            transfer: transferRows.value,
            card: cardRows.value,
            cheque: chequeRows.value,
          }
        : {
            cash_amount: 0,
            tiger_amount: 0,
            tiger: [],
            transfer: [],
            card: [],
            cheque: [],
          },
      wht_list: whtRows.value
        .filter((row) => toMoney(row.amount) > 0 && toMoney(row.tax_rate) > 0)
        .map((row) => ({
          income_type: row.income_type,
          amount: toMoney(row.amount),
          tax_rate: toMoney(row.tax_rate),
          tax_value: calcWhtTax(row),
          due_date: row.due_date || docDate.value,
        })),
    };
    const result = await saveOtherExpense(payload);
    if (result?.success === false) throw new Error(result.message || result.msg || "บันทึกไม่สำเร็จ");
    savedDocNo.value = result.doc_no || "";
    if (result.wht_tax_doc_no) whtTaxDocNo.value = result.wht_tax_doc_no;
    if (!savedDocNo.value) throw new Error("บันทึกแล้วแต่ไม่พบเลขที่เอกสาร");
    notify("success", "บันทึกค่าใช้จ่ายอื่นๆ สำเร็จ", savedDocNo.value);
    await loadDocImages(savedDocNo.value);
    currentStep.value = "summary";
  } catch (ex) {
    notify("error", "บันทึกไม่สำเร็จ", ex.message);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="expense-page">
    <section class="step-top-strip">
      <div class="step-title">
        <h1>ค่าใช้จ่ายอื่นๆ</h1>
        <span>เลขที่ถัดไป {{ nextDoc?.doc_no || "-" }}</span>
      </div>
      <div class="step-actions">
        <Button v-if="canViewHistory" icon="pi pi-history" label="ประวัติ" class="action-btn action-history" @click="router.push('/cash/other-expense/history')" />
        <Button icon="pi pi-plus" label="เอกสารใหม่" class="action-btn action-new" @click="resetForm(false)" />
      </div>
    </section>

    <nav class="stepper" aria-label="ขั้นตอนค่าใช้จ่ายอื่นๆ">
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

    <section class="work-panel">
      <div class="panel-title">
        <i :class="currentStepMeta.icon" />
        <strong>{{ currentStepMeta.label }}</strong>
      </div>

      <template v-if="currentStep === 'document'">
        <label class="field-label supplier-field">
          เจ้าหนี้
          <div class="supplier-picker">
            <InputText :model-value="selectedSupplier ? `${selectedSupplier.code} - ${selectedSupplier.name_1 || ''}` : ''" readonly placeholder="เลือกเจ้าหนี้" />
            <Button icon="pi pi-search" label="ค้นหา" class="action-btn action-search" @click="openSupplierDialog" />
            <Button v-if="selectedSupplier" icon="pi pi-times" text rounded severity="danger" aria-label="ล้างเจ้าหนี้" @click="clearSupplier" />
          </div>
        </label>
        <div v-if="selectedSupplier" class="selected-card">
          <span>เจ้าหนี้ที่เลือก</span>
          <strong>{{ selectedSupplier.code }} - {{ selectedSupplier.name_1 }}</strong>
          <small>{{ selectedSupplier.address || "-" }}</small>
        </div>

        <div class="form-grid">
          <label><span>รูปแบบเอกสาร</span><Select v-model="selectedDocFormatCode" :options="docFormatOptions" option-label="label" option-value="code" /></label>
          <label><span>เลขที่เอกสาร</span><InputText :model-value="nextDoc?.doc_no || '-'" readonly /></label>
          <label><span>วันที่</span><InputText v-model="docDate" type="date" /></label>
          <label><span>เวลา</span><InputText v-model="docTime" type="time" /></label>
          <label class="form-grid-wide"><span>ประเภทรายการ</span><Select v-model="inquiryType" :options="inquiryTypeOptions" option-label="label" option-value="value" /></label>
          <label><span>เลขใบกำกับ</span><InputText v-model="taxDocNo" placeholder="ว่างไว้จะใช้เลขเอกสาร" /></label>
          <label><span>วันที่ใบกำกับ</span><InputText v-model="taxDocDate" type="date" /></label>
          <label><span>ประเภท VAT</span><Select v-model="vatType" :options="vatTypeOptions" option-label="label" option-value="value" /></label>
          <label><span>อัตรา VAT</span><InputNumber v-model="vatRate" :min="0" :max-fraction-digits="2" suffix=" %" :disabled="[2, 3].includes(Number(vatType))" /></label>
        </div>

        <Message v-if="currentStepIssues.length" severity="warn" :closable="false">
          <div v-for="error in currentStepIssues" :key="error">{{ error }}</div>
        </Message>
      </template>

      <template v-else-if="currentStep === 'detail'">
        <div class="detail-toolbar">
          <Button icon="pi pi-plus" label="เพิ่มรายการ" @click="addDetailRow" />
        </div>
        <div class="detail-list">
          <div v-for="(row, index) in detailRows" :key="row.id" class="detail-row">
            <Select v-model="row.expense_code" :options="expenseSelectOptions" option-label="label" option-value="code" placeholder="เลือกค่าใช้จ่าย" filter @change="onExpenseSelect(row)" />
            <InputNumber v-model="row.amount" :min="0" :min-fraction-digits="2" :max-fraction-digits="2" placeholder="ยอด" />
            <InputText v-model="row.remark" placeholder="หมายเหตุ" />
            <Button icon="pi pi-trash" severity="danger" text rounded :disabled="detailRows.length === 1" @click="removeRow(detailRows, index)" />
          </div>
        </div>
        <InputText v-model="remark" placeholder="หมายเหตุท้ายเอกสาร" />
        <Message v-if="currentStepIssues.length" severity="warn" :closable="false">
          <div v-for="error in currentStepIssues" :key="error">{{ error }}</div>
        </Message>
      </template>

      <template v-else-if="currentStep === 'payment'">
        <div ref="paymentTopRef" class="step-head payment-head">
          <div>
            <span class="step-kicker">{{ currentStepMeta.label }}</span>
            <h2>จ่ายเงิน</h2>
          </div>
          <Button icon="pi pi-check" label="เงินสดพอดี" class="action-btn action-exact" :disabled="remainingAmount <= 0" @click="fillRemainingToCash" />
        </div>

        <div class="payment-meter">
          <div><span>ยอดเอกสาร</span><strong>{{ formatCurrency(totalDue) }}</strong></div>
          <div><span>หัก ณ ที่จ่าย</span><strong>{{ formatCurrency(whtTaxTotal) }}</strong></div>
          <div><span>ต้องจ่ายจริง</span><strong>{{ formatCurrency(netPayable) }}</strong></div>
          <div><span>จ่ายแล้ว</span><strong>{{ formatCurrency(paidTotal) }}</strong></div>
          <div><span>{{ overpaidAmount > 0 ? "ส่วนเกิน" : "คงเหลือ" }}</span><strong :class="overpaidAmount > 0 ? 'success-text' : 'danger-text'">{{ formatCurrency(overpaidAmount > 0 ? overpaidAmount : remainingAmount) }}</strong></div>
          <div><span>ค่าธรรมเนียมบัตร</span><strong>{{ formatCurrency(cardChargeTotal) }}</strong></div>
        </div>

        <div class="payment-workspace">
          <section class="payment-entry-list">
            <div v-if="!paymentEntries.length" class="entries-empty">ยังไม่มีรายการจ่ายเงิน</div>
            <div v-else class="entries-list">
              <div v-for="entry in paymentEntries" :key="`${entry.type}-${entry.id}`" class="entry-row">
                <span class="entry-icon"><i :class="paymentEntryIcon(entry.type)" /></span>
                <div class="entry-info">
                  <strong>{{ entry.label }}</strong>
                  <small v-if="entry.sub">{{ entry.sub }}</small>
                </div>
                <span class="entry-amount" :class="{ deduction: entry.type === 'wht' }">{{ entry.type === 'wht' ? '-' : '' }}{{ formatCurrency(entry.amount) }}</span>
                <Button icon="pi pi-times" text rounded severity="danger" aria-label="ลบรายการจ่ายเงิน" @click="removePaymentEntry(entry)" />
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
                <button type="button" class="denom-btn exact" :disabled="remainingAmount <= 0" @click="fillRemainingToCash">พอดี</button>
              </div>
              <label class="field-label">
                จำนวนเงิน
                <InputNumber v-model="cashAmount" mode="currency" currency="THB" locale="th-TH" :min="0" />
              </label>
            </div>

            <div v-else-if="activePaymentType === 'transfer'" class="type-form">
              <label class="field-label">
                สมุดบัญชี
                <Select v-model="transferDraft.pass_book_code" :options="passBookOptions" option-label="label" option-value="code" placeholder="สมุดบัญชี" filter />
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
                <Select v-model="cardDraft.credit_card_type" :options="creditTypeOptions" option-label="label" option-value="code" placeholder="ประเภทบัตร" filter>
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

            <div v-else-if="activePaymentType === 'cheque'" class="type-form">
              <label class="field-label">
                เลขที่เช็ค
                <InputText v-model="chequeDraft.trans_number" placeholder="เลขที่เช็ค" />
              </label>
              <label class="field-label">
                วันที่เช็ค
                <InputText v-model="chequeDraft.chq_due_date" type="date" />
              </label>
              <label class="field-label">
                จำนวนเงิน
                <InputNumber v-model="chequeDraft.amount" mode="currency" currency="THB" locale="th-TH" :min="0" />
              </label>
              <Button icon="pi pi-plus" label="เพิ่มรายการ" class="action-btn action-add" :disabled="!chequeDraft.trans_number || toMoney(chequeDraft.amount) <= 0" @click="addChequeRow" />
            </div>

            <div v-else-if="activePaymentType === 'tiger'" class="type-form">
              <div class="tiger-panel">
                <div v-if="tigerStatus === 'idle'" class="tiger-idle">
                  <label class="tiger-amount-input">
                    <span class="tiger-amount-label">ยอดสร้าง voucher</span>
                    <InputNumber v-model="tigerDraftAmount" mode="currency" currency="THB" locale="th-TH" :min="0" :max="remainingAmount" />
                  </label>
                  <small v-if="tigerAmountTooHigh" class="tiger-amount-warning">ยอด Tiger มากกว่ายอดคงเหลือ</small>
                  <button type="button" class="tiger-fill-btn" :disabled="remainingAmount <= 0" @click="fillTigerRemaining">ใส่ยอดคงเหลือ {{ formatCurrency(remainingAmount) }}</button>
                  <Button
                    icon="pi pi-ticket"
                    label="สร้าง Tiger Voucher"
                    :disabled="tigerPayAmount <= 0 || tigerAmountTooHigh || tigerStatus === 'requesting'"
                    @click="openTigerVoucherLoginDialog"
                  />
                </div>
                <div v-else-if="tigerStatus === 'requesting'" class="tiger-status">
                  <i class="pi pi-spin pi-spinner tiger-spinner" />
                  <span>กำลังสร้าง voucher ที่ Tiger...</span>
                </div>
                <div v-else-if="tigerStatus === 'success'" class="tiger-status tiger-success">
                  <i class="pi pi-check-circle tiger-check" />
                  <span>สร้าง voucher แล้ว เพิ่มเป็นรายการจ่ายเงินเรียบร้อย</span>
                  <Button label="สร้างเพิ่ม" size="small" severity="secondary" @click="tigerStatus = 'idle'" />
                </div>
                <div v-else class="tiger-status tiger-error">
                  <i class="pi pi-times-circle tiger-err-icon" />
                  <span>{{ tigerError || "สร้าง Tiger voucher ไม่สำเร็จ" }}</span>
                  <Button label="ลองใหม่" size="small" severity="secondary" @click="tigerStatus = 'idle'" />
                </div>
              </div>
            </div>

            <div v-else-if="activePaymentType === 'wht'" class="type-form">
              <label class="field-label supplier-field">
                เจ้าหนี้หัก ณ ที่จ่าย
                <div class="supplier-picker">
                  <InputText :model-value="selectedWhtSupplier ? `${selectedWhtSupplier.code} - ${selectedWhtSupplier.name_1 || ''}` : ''" readonly placeholder="เลือกเจ้าหนี้หัก ณ ที่จ่าย" />
                  <Button icon="pi pi-search" label="ค้นหา" class="action-btn action-search" @click="openSupplierDialog('wht')" />
                  <Button v-if="selectedSupplier && selectedWhtSupplier?.code !== selectedSupplier.code" icon="pi pi-refresh" text rounded severity="secondary" aria-label="ใช้เจ้าหนี้หัวเอกสาร" @click="resetWhtSupplierToHeader" />
                </div>
              </label>
              <label class="field-label">
                รูปแบบเลขที่หนังสือ
                <Select v-model="selectedWhtDocFormatCode" :options="whtDocFormatOptions" option-label="label" option-value="code" placeholder="เลือกรูปแบบ" filter />
              </label>
              <label class="field-label">
                เลขที่หัก ณ ที่จ่าย
                <InputText :model-value="whtTaxDocNo || 'ระบบจะออกเลขตอนบันทึก'" readonly />
              </label>
              <label class="field-label">
                ประเภทเงินได้
                <InputText v-model="whtDraft.income_type" placeholder="เช่น ค่าบริการ" />
              </label>
              <label class="field-label">
                ฐานภาษี
                <InputNumber v-model="whtDraft.amount" mode="currency" currency="THB" locale="th-TH" :min="0" />
              </label>
              <label class="field-label">
                อัตราภาษี %
                <InputNumber v-model="whtDraft.tax_rate" suffix="%" :min="0" :min-fraction-digits="0" :max-fraction-digits="2" />
              </label>
              <label class="field-label">
                วันที่หัก
                <InputText v-model="whtDraft.due_date" type="date" @change="loadNextWhtDocNo" />
              </label>
              <div class="charge-preview">
                <span>ภาษีหัก</span>
                <strong>{{ formatCurrency(calcWhtTax(whtDraft)) }}</strong>
              </div>
              <Button icon="pi pi-plus" label="เพิ่มรายการ" class="action-btn action-add" :disabled="!selectedWhtSupplier?.code || !selectedWhtDocFormatCode || !String(whtDraft?.income_type || '').trim() || toMoney(whtDraft?.amount) <= 0 || toMoney(whtDraft?.tax_rate) <= 0" @click="addWhtRow" />
            </div>

          </section>
        </div>

        <Message v-if="currentStepIssues.length" severity="warn" :closable="false">
          <div v-for="error in currentStepIssues" :key="error">{{ error }}</div>
        </Message>
      </template>

      <template v-else>
        <div class="done-card">
          <i class="pi pi-check-circle done-icon" />
          <div>
            <div class="done-title">บันทึกค่าใช้จ่ายอื่นๆ เรียบร้อย</div>
            <div class="done-docno">{{ savedDocNo || "-" }}</div>
          </div>
        </div>

        <div class="proof-section">
          <div class="proof-head">
            <div>
              <div class="proof-title">หลักฐานการจ่ายเงิน</div>
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
                <img :src="getDocImageUrl(image.guid_code)" alt="หลักฐานการจ่ายเงิน" />
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
          <Button v-if="canViewHistory" icon="pi pi-history" label="ประวัติ" class="action-btn action-history" @click="router.push('/cash/other-expense/history')" />
          <Button icon="pi pi-plus" label="เอกสารใหม่" class="action-btn action-new" @click="resetForm(false)" />
        </div>
      </template>
    </section>

    <footer v-if="currentStep !== 'summary'" class="step-footer">
    <div class="footer-actions">
      <Button icon="pi pi-arrow-left" label="กลับ" severity="secondary" outlined :disabled="isFirstStep || saving" @click="goBack" />
      <Button v-if="currentStep === 'payment' || (currentStep === 'detail' && !isCashExpense)" icon="pi pi-check" label="บันทึกค่าใช้จ่ายอื่นๆ" :loading="saving" :disabled="!canSave" @click="saveDocument" />
      <Button v-else-if="!isLastStep" icon="pi pi-arrow-right" icon-pos="right" label="ถัดไป" :disabled="!canGoNext" @click="goNext" />
    </div>
    </footer>

    <Dialog
      v-model:visible="tigerLoginDialogVisible"
      modal
      header="เข้าสู่ระบบ Tiger Voucher"
      :closable="tigerStatus !== 'requesting'"
      :close-on-escape="tigerStatus !== 'requesting'"
      :draggable="false"
      :style="{ width: 'min(440px, calc(100vw - 2rem))' }"
      @hide="clearTigerLoginForm"
    >
      <form class="tiger-login-dialog" autocomplete="off" @submit.prevent="createTigerVoucherPayment">
        <div class="tiger-login-amount">
          <span>ยอดสร้าง voucher</span>
          <InputNumber v-model="tigerDraftAmount" mode="currency" currency="THB" locale="th-TH" :min="0" :max="remainingAmount" :disabled="tigerStatus === 'requesting'" />
        </div>
        <small v-if="tigerAmountTooHigh" class="tiger-amount-warning">ยอด Tiger มากกว่ายอดคงเหลือ</small>
        <label class="field-label">
          Username
          <InputText
            v-model="tigerLoginForm.username"
            autocomplete="off"
            autofocus
            :disabled="tigerStatus === 'requesting'"
            placeholder="Tiger username"
          />
        </label>
        <label class="field-label">
          Password
          <InputText
            v-model="tigerLoginForm.password"
            type="password"
            autocomplete="new-password"
            :disabled="tigerStatus === 'requesting'"
            placeholder="Tiger password"
          />
        </label>
        <label class="field-label">
          Mobile
          <InputText
            v-model="tigerLoginForm.mobile"
            inputmode="tel"
            autocomplete="off"
            :disabled="tigerStatus === 'requesting'"
            placeholder="เบอร์มือถือ"
          />
        </label>
        <Message v-if="tigerError" severity="error" :closable="false">{{ tigerError }}</Message>
      </form>
      <template #footer>
        <Button label="ยกเลิก" severity="secondary" outlined :disabled="tigerStatus === 'requesting'" @click="closeTigerVoucherLoginDialog" />
        <Button
          icon="pi pi-ticket"
          label="เข้าสู่ระบบและสร้าง Voucher"
          :loading="tigerStatus === 'requesting'"
          :disabled="tigerPayAmount <= 0 || tigerAmountTooHigh || !tigerLoginForm.username || !tigerLoginForm.password"
          @click="createTigerVoucherPayment"
        />
      </template>
    </Dialog>

    <Dialog v-model:visible="supplierDialogVisible" modal :header="supplierDialogTitle" :style="{ width: 'min(760px, calc(100vw - 2rem))' }">
      <div class="supplier-dialog">
        <div class="supplier-dialog-search">
          <InputText v-model="supplierSearch" autofocus placeholder="ค้นหารหัสหรือชื่อเจ้าหนี้" @input="searchSuppliers" @keyup.enter="searchSuppliers" />
          <Button icon="pi pi-search" label="ค้นหา" class="action-btn action-search" :loading="supplierLoading" @click="searchSuppliers" />
        </div>
        <div v-if="supplierLoading" class="state-box">กำลังค้นหา...</div>
        <div v-else-if="supplierSearch.trim().length < 2" class="state-box">พิมพ์อย่างน้อย 2 ตัวอักษร</div>
        <div v-else-if="!suppliers.length" class="state-box">ไม่พบเจ้าหนี้</div>
        <div v-else class="supplier-dialog-list">
          <button v-for="row in suppliers.slice(0, 30)" :key="row.code" type="button" @click="selectSupplier(row)">
            <strong>{{ row.code }}</strong>
            <span>{{ row.name_1 }}</span>
            <small>{{ row.telephone || row.address || "-" }}</small>
          </button>
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
              :input-id="`other-expense-print-form-${form.formcode}`"
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
  </div>
</template>

<style scoped>
.expense-page {
  min-height: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.2rem;
  overflow: hidden;
  background: var(--p-surface-0);
  color: var(--p-text-color);
}

.step-top-strip,
.work-panel,
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

.step-title h1 {
  margin: 0;
  font-size: 1.25rem;
  letter-spacing: 0;
}

.step-title span,
.panel-title,
.done-title,
.proof-title {
  font-weight: 700;
}

.step-title span,
.step-kicker,
.muted-label,
.proof-subtitle {
  color: var(--p-text-color-secondary);
  font-size: 0.84rem;
}

.step-actions,
.footer-actions,
.done-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.6rem;
}

.step-actions :deep(.p-button),
.footer-actions :deep(.p-button),
.done-actions :deep(.p-button) {
  min-width: 7rem;
  white-space: nowrap;
}

.action-btn {
  border: 0;
  font-weight: 900;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
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

.action-print {
  background: #7c3aed;
  color: #fff;
}

.saved-banner {
  flex: 0 0 auto;
}

.page-head p {
  margin: 0.15rem 0 0;
  color: var(--p-text-color-secondary);
  font-size: 0.85rem;
}

.stepper {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.25rem;
  padding: 0.25rem;
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

.step-pill {
  min-height: 3rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  background: var(--p-surface-0);
  color: var(--p-text-color-secondary);
  font: inherit;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
}

.step-pill.active,
.step-pill.done {
  color: var(--p-primary-color);
  background: var(--p-primary-50);
  border-color: var(--p-primary-200);
}

.work-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem;
  border-color: transparent;
  overflow-y: auto;
}

.panel-title,
.block-head,
.search-box,
.cash-line {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.search-box > :first-child,
.cash-line label {
  flex: 1;
}

label {
  display: grid;
  gap: 0.3rem;
}

label span {
  color: var(--p-text-color-secondary);
  font-size: 0.82rem;
  font-weight: 700;
}

.result-list,
.detail-list,
.payment-block {
  display: grid;
  gap: 0.5rem;
}

.result-row,
.selected-card {
  width: 100%;
  display: grid;
  gap: 0.2rem;
  padding: 0.75rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  background: var(--p-surface-50);
  color: var(--p-text-color);
  text-align: left;
  font: inherit;
}

.result-row small,
.selected-card span,
.selected-card small {
  color: var(--p-text-color-secondary);
}

.supplier-field {
  gap: 0.35rem;
}

.supplier-picker,
.supplier-dialog-search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.supplier-picker :deep(.p-inputtext),
.supplier-dialog-search :deep(.p-inputtext) {
  flex: 1;
  min-width: 0;
}

.supplier-dialog {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.supplier-dialog-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.625rem;
  max-height: min(58vh, 520px);
  overflow: auto;
  padding-right: 0.15rem;
}

.supplier-dialog-list button {
  display: grid;
  gap: 0.2rem;
  padding: 0.75rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  background: var(--p-surface-50);
  color: var(--p-text-color);
  text-align: left;
  font: inherit;
  cursor: pointer;
}

.supplier-dialog-list button:active {
  background: var(--p-surface-100);
}

.supplier-dialog-list small {
  color: var(--p-text-color-secondary);
  line-height: 1.35;
}

.block-head > div {
  display: grid;
  gap: 0.15rem;
}

.block-head small {
  color: var(--p-text-color-secondary);
  font-size: 0.8rem;
}

.state-box {
  padding: 1rem;
  text-align: center;
  color: var(--p-text-color-secondary);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.form-grid-wide {
  grid-column: 1 / -1;
}

.detail-toolbar {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.detail-row,
.payment-row,
.wht-row {
  display: grid;
  grid-template-columns: minmax(180px, 1.2fr) minmax(130px, 0.55fr) minmax(160px, 1fr) auto;
  gap: 0.5rem;
  align-items: center;
}

.payment-row {
  grid-template-columns: minmax(180px, 1fr) minmax(130px, 0.5fr) auto;
}

.payment-row.three {
  grid-template-columns: minmax(150px, 1fr) minmax(120px, 0.5fr) minmax(120px, 0.5fr) auto;
}

.wht-row {
  grid-template-columns: minmax(140px, 1fr) minmax(110px, 0.65fr) minmax(90px, 0.45fr) minmax(110px, 0.55fr) minmax(120px, 0.6fr) auto;
}

.payment-summary,
.payment-meter,
.review-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.625rem;
}

.payment-summary div,
.payment-meter div,
.review-grid div {
  display: grid;
  gap: 0.2rem;
  padding: 0.75rem;
  border-radius: 8px;
  background: var(--p-surface-50);
  border: 1px solid var(--p-surface-border);
}

.payment-summary span,
.payment-meter span,
.review-grid span {
  color: var(--p-text-color-secondary);
  font-size: 0.82rem;
}

.step-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.step-head h2 {
  margin: 0.1rem 0 0;
  font-size: 1.35rem;
  letter-spacing: 0;
}

.action-exact {
  background: #f59e0b;
  color: #111827;
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

.entry-amount.deduction {
  color: var(--p-orange-600);
}

.add-payment-panel {
  display: grid;
  gap: 0.55rem;
  padding: 0.55rem;
}

.type-tabs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(6.5rem, 1fr));
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
.tiger-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  text-align: center;
}

.tiger-amount-label {
  color: var(--p-text-color-secondary);
  font-size: 0.85rem;
}

.tiger-amount-value {
  font-size: 1.8rem;
  font-weight: 900;
  color: var(--p-primary-color);
}

.tiger-amount-input {
  width: min(100%, 22rem);
  display: grid;
  gap: 0.4rem;
}

.tiger-amount-input :deep(.p-inputnumber),
.tiger-amount-input :deep(.p-inputtext),
.tiger-login-amount :deep(.p-inputnumber),
.tiger-login-amount :deep(.p-inputtext) {
  width: 100%;
}

.tiger-fill-btn {
  border: 0;
  background: transparent;
  color: var(--p-primary-color);
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.tiger-fill-btn:disabled {
  color: var(--p-text-color-secondary);
  cursor: default;
}

.tiger-amount-warning {
  color: #dc2626;
  font-weight: 800;
}

.tiger-login-dialog {
  display: grid;
  gap: 0.75rem;
}

.tiger-login-amount {
  min-height: 3.25rem;
  border-radius: 8px;
  background: var(--p-surface-100);
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 0.8rem;
}

.tiger-login-amount span {
  color: var(--p-text-color-secondary);
  font-size: 0.85rem;
  font-weight: 700;
}

.tiger-login-amount strong {
  color: var(--p-primary-color);
  font-size: 1.25rem;
  white-space: nowrap;
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

.danger-text {
  color: #dc2626;
}

.success-text {
  color: #16a34a;
}

.footer-actions {
  padding: 0.65rem 0.75rem;
}

.step-footer {
  border-color: transparent;
}

.done-card {
  width: min(620px, 100%);
  margin: 3rem auto 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 1.35rem;
  border-radius: 8px;
  background: #ecfdf5;
  color: #047857;
}

.done-icon {
  font-size: 2.7rem;
}

.done-title {
  color: var(--p-text-color);
}

.done-docno {
  margin-top: 0.2rem;
  font-size: 1.35rem;
  font-weight: 900;
  color: var(--p-primary-color);
}

.proof-section {
  width: min(620px, 100%);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.proof-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.proof-upload-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  border: 1px solid var(--p-primary-color);
  border-radius: 6px;
  padding: 0.55rem 0.85rem;
  color: var(--p-primary-color);
  font-size: 0.9rem;
  font-weight: 800;
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

.proof-error {
  color: #b91c1c;
  font-size: 0.9rem;
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
  width: 100%;
  height: 100%;
  display: block;
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

.done-actions {
  margin-top: 1.25rem;
  justify-content: center;
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

@media (max-width: 1024px) {
  .payment-meter {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .payment-workspace {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 641px) and (max-width: 900px) {
  .expense-page {
    padding: 0.75rem 0.25rem;
  }

  .detail-row {
    grid-template-columns: minmax(0, 1fr) minmax(120px, 0.45fr) auto;
  }

  .detail-row > :nth-child(3) {
    grid-column: 1 / -2;
  }

  .payment-row,
  .payment-row.three {
    grid-template-columns: minmax(0, 1fr) minmax(120px, 0.5fr) auto;
  }

  .wht-row {
    grid-template-columns: minmax(0, 1fr) minmax(120px, 0.6fr) minmax(90px, 0.45fr) auto;
  }

  .wht-row > :nth-child(4),
  .wht-row > :nth-child(5) {
    grid-column: span 2;
  }
}

@media (max-width: 640px) {
  .expense-page {
    padding: 0.75rem 0.25rem;
  }

  .stepper {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .stepper-item {
    min-height: 2.75rem;
    font-size: 0.8rem;
    justify-content: center;
  }

  .stepper-text {
    display: none;
  }

  .form-grid,
  .payment-summary,
  .payment-meter,
  .review-grid,
  .detail-toolbar {
    grid-template-columns: 1fr;
  }

  .supplier-picker,
  .supplier-dialog-search {
    align-items: stretch;
  }

  .supplier-dialog-list {
    grid-template-columns: 1fr;
  }

  .detail-row,
  .payment-row,
  .payment-row.three,
  .wht-row {
    grid-template-columns: 1fr;
  }

  .step-head {
    align-items: stretch;
    flex-direction: column;
  }

  .type-tabs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .denom-row {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .footer-actions {
    grid-template-columns: 1fr;
  }
}
</style>
