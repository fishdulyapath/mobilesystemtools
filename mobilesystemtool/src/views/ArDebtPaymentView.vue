<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
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
import {
  getArDebtPaymentAdvanceBalance,
  getArDebtPaymentBillingDetail,
  getArDebtPaymentDetail,
  getArDebtPaymentDocFormats,
  getArDebtPaymentExpenseList,
  getArDebtPaymentIncomeList,
  getArDebtPaymentList,
  getArDebtPaymentOpenBillings,
  getArDebtPaymentPrintForms,
  getArDebtPaymentPrintUrl,
  getArDebtPaymentSalesUsers,
  getNextArDebtPaymentDocNo,
  saveArDebtPayment,
} from "@/services/arDebtPaymentService";
import { deleteDocImage, getDocImageUrl, getDocImagesList, saveDocImage } from "@/services/docImageService";
import { createTigerOrder, inquireTigerOrder, cancelTigerOrder, getTigerConfig, TIGER_MOCK } from "@/services/tigerService";
import { useAuthStore } from "@/stores/auth";
import { usePosStore } from "@/stores/pos";
import { calcAfterDiscount } from "@/utils/discount";
import { formatCurrency, formatDate, todayISO } from "@/utils/formatters";
import { generateUUID } from "@/utils/uuid";
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
let localRowId = 0;

const salesUserSearch = ref("");
const salesUsers = ref([]);
const salesUserLoading = ref(false);
const selectedSalesUser = ref(null);
const salesUserDialogVisible = ref(false);
let salesUserTimer = null;

const billingSearch = ref("");
const openBillings = ref([]);
const openBillingsLoading = ref(false);
const billingDialogVisible = ref(false);
const selectedBillings = ref([]);
const debtSourceMode = ref("billing_note");
const detailRows = ref([]);

const cashAmount = ref(null);
const pettyCashAmount = ref(0);
const billDiscountWord = ref("");
const paymentRoundAmount = ref(0);
const transferRows = ref([]);
const cardRows = ref([]);
const transferDraft = ref(newTransferRow());
const cardDraft = ref(newCardRow());
const chequeRows = ref([]);
const couponRows = ref([]);
const depositRows = ref([]);
const incomeRows = ref([]);
const expenseRows = ref([]);
const vatSaleRows = ref([]);
const passBooks = ref([]);
const creditTypes = ref([]);
const advanceBalances = ref([]);
const advanceLoading = ref(false);
const selectedAdvanceBalance = ref(null);
const advancePaymentAmount = ref(null);
const incomeList = ref([]);
const expenseList = ref([]);
const activePaymentType = ref("cash");
const tigerEnabled = ref(false);
const tigerStatus = ref("idle");
const tigerId = ref("");
const tigerError = ref("");
const tigerDialogVisible = ref(false);
const tigerPollInterval = ref(null);
const tigerCancel = ref(false);
const tigerRef1 = ref("");
const tigerRef2 = ref("");
const tigerAmount = ref(0);

const saving = ref(false);
const savedDocNo = ref("");
const savedDetail = ref(null);
const detailDialogVisible = ref(false);
const detailLoading = ref(false);
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
const docFormatOptions = computed(() =>
  docFormats.value.map((row) => ({ ...row, label: `${row.code || ""} - ${row.name_1 || ""}`.trim() })),
);
const passBookOptions = computed(() =>
  passBooks.value.map((row) => ({
    ...row,
    label: `${row.code || ""} ${row.bank_name || row.bank_code || ""}${row.book_name ? ` - ${row.book_name}` : ""}`.trim(),
  })),
);
const creditTypeOptions = computed(() =>
  creditTypes.value.map((row) => ({ ...row, label: `${row.code || ""} ${row.name_1 || ""}`.trim() })),
);
const advanceOptions = computed(() =>
  advanceBalances.value.map((row) => ({
    ...row,
    label: `${row.doc_no || ""} - ${formatCurrency(row.balance_amount || 0)}`,
  })),
);
const incomeOptions = computed(() =>
  incomeList.value.map((row) => ({ ...row, label: `${row.code || ""} ${row.name_1 || ""}`.trim() })),
);
const expenseOptions = computed(() =>
  expenseList.value.map((row) => ({ ...row, label: `${row.code || ""} ${row.name_1 || ""}`.trim() })),
);
const isDirectDebtMode = computed(() => debtSourceMode.value === "direct_debt");
const debtSourceLabel = computed(() => (isDirectDebtMode.value ? "เอกสารหนี้" : "ใบวางบิล"));
const debtSourcePluralLabel = computed(() => (isDirectDebtMode.value ? "เอกสารหนี้คงเหลือ" : "ใบวางบิลค้างชำระ"));
const availableBillings = computed(() =>
  openBillings.value.filter((row) => {
    if (row?.source_mode === "direct_debt" || isDirectDebtMode.value) return !isDetailSelected(row);
    return !selectedBillings.value.some((selected) => debtSourceKey(selected) === debtSourceKey(row));
  }),
);
const selectedTotal = computed(() => rnd(detailRows.value.reduce((sum, row) => sum + toMoney(row.sum_pay_money), 0)));
const salesUserDisplay = computed(() => {
  if (selectedSalesUser.value?.code) {
    return `${selectedSalesUser.value.code} - ${salesUserName(selectedSalesUser.value)}`.trim();
  }
  return saleCode.value || "";
});
const transferTotal = computed(() => rnd(transferRows.value.reduce((sum, row) => sum + toMoney(row.amount), 0)));
const cardChargeTotal = computed(() => rnd(cardRows.value.reduce((sum, row) => sum + toMoney(row.charge), 0)));
const cardTotal = computed(() => rnd(cardRows.value.reduce((sum, row) => sum + toMoney(row.amount) + toMoney(row.charge), 0)));
const chequeTotal = computed(() => rnd(chequeRows.value.reduce((sum, row) => sum + toMoney(row.amount), 0)));
const couponTotal = computed(() => rnd(couponRows.value.reduce((sum, row) => sum + toMoney(row.amount), 0)));
const depositTotal = computed(() => rnd(depositRows.value.reduce((sum, row) => sum + toMoney(row.amount), 0)));
const incomeTotal = computed(() => rnd(incomeRows.value.reduce((sum, row) => sum + toMoney(row.amount), 0)));
const expenseTotal = computed(() => rnd(expenseRows.value.reduce((sum, row) => sum + toMoney(row.amount), 0)));
const vatSaleTotal = computed(() => rnd(vatSaleRows.value.reduce((sum, row) => sum + toMoney(row.amount), 0)));
const billDiscountAmount = computed(() => {
  const base = Math.max(0, selectedTotal.value);
  if (!base || !billDiscountWord.value.trim()) return 0;
  const afterDiscount = calcAfterDiscount(billDiscountWord.value, base, 2);
  return Math.min(base, Math.max(0, rnd(base - afterDiscount)));
});
const totalAfterDiscount = computed(() => Math.max(0, rnd(selectedTotal.value - billDiscountAmount.value)));
const totalDue = computed(() => rnd(totalAfterDiscount.value + cardChargeTotal.value));
const paidTotal = computed(() =>
  rnd(
    toMoney(cashAmount.value)
      + toMoney(tigerAmount.value)
      + transferTotal.value
      + cardTotal.value
      + depositTotal.value,
  ),
);
const paymentDiff = computed(() => rnd(paidTotal.value - totalDue.value));
const remainingAmount = computed(() => Math.max(0, rnd(totalDue.value - paidTotal.value)));
const overpaidAmount = computed(() => Math.max(0, paymentDiff.value));
const advanceBalanceMap = computed(() => new Map(advanceBalances.value.map((row) => [row.doc_no, toMoney(row.balance_amount)])));
function usedAdvanceBalance(row) {
  const docNo = row?.doc_no || row?.trans_number || "";
  if (!docNo) return 0;
  return rnd(depositRows.value
    .filter((payment) => payment.trans_number === docNo)
    .reduce((sum, payment) => sum + toMoney(payment.amount), 0));
}
function advanceBalanceAvailable(row) {
  return Math.max(0, rnd(toMoney(row?.balance_amount) - usedAdvanceBalance(row)));
}
const availableAdvanceBalances = computed(() => advanceBalances.value.filter((row) => advanceBalanceAvailable(row) > 0));
const selectedAdvanceBalanceAvailable = computed(() => advanceBalanceAvailable(selectedAdvanceBalance.value));
const validationErrors = computed(() => {
  const errors = [];
  if (!selectedDocFormatCode.value || !nextDoc.value?.doc_no) errors.push("ไม่พบรูปแบบเลขเอกสาร EE");
  if (!selectedCustomer.value?.code) errors.push("เลือกลูกหนี้ก่อนบันทึก");
  if (!detailRows.value.length) errors.push("เลือกเอกสารหนี้อย่างน้อย 1 รายการ");
  detailRows.value.forEach((row, index) => {
    if (!isNonZeroAmount(row.sum_pay_money)) errors.push(`แถว ${index + 1}: ระบุยอดรับชำระ`);
    if (amountExceedsBalance(row.sum_pay_money, row.balance_ref)) errors.push(`แถว ${index + 1}: รับชำระเกินยอดคงเหลือ`);
  });
  if (remainingAmount.value > 0.01) errors.push("ยอดรับชำระยังน้อยกว่ายอดเอกสาร");
  if (overpaidAmount.value > 0.01) errors.push("ยอดรับชำระมากกว่ายอดสุทธิ");
  transferRows.value.forEach((row, index) => {
    if (toMoney(row.amount) > 0 && !row.pass_book_code) errors.push(`แถวโอน ${index + 1}: เลือกสมุดบัญชี`);
    if (toMoney(row.amount) > 0 && !row.transfer_date) errors.push(`แถวโอน ${index + 1}: เลือกวันที่โอน`);
  });
  cardRows.value.forEach((row, index) => {
    if (toMoney(row.amount) > 0 && !row.credit_card_type) errors.push(`แถวบัตร ${index + 1}: เลือกประเภทบัตร`);
  });
  depositRows.value.forEach((row, index) => {
    if (toMoney(row.amount) <= 0) return;
    if (!row.trans_number) errors.push(`รับเงินล่วงหน้าแถว ${index + 1}: เลือกเอกสาร`);
    const balance = advanceBalanceMap.value.get(row.trans_number);
    if (balance === undefined) errors.push(`รับเงินล่วงหน้าแถว ${index + 1}: ไม่พบเอกสาร ${row.trans_number}`);
    else if (usedAdvanceBalance({ doc_no: row.trans_number }) > balance + 0.01) errors.push(`รับเงินล่วงหน้าแถว ${index + 1}: ใช้เกินยอดคงเหลือ`);
  });
  return errors;
});
const paymentValidationErrors = computed(() => {
  const errors = [];
  if (remainingAmount.value > 0.01) errors.push("ยอดรับชำระยังน้อยกว่ายอดเอกสาร");
  if (overpaidAmount.value > 0.01) errors.push("ยอดรับชำระมากกว่ายอดสุทธิ");
  transferRows.value.forEach((row, index) => {
    if (toMoney(row.amount) > 0 && !row.pass_book_code) errors.push(`แถวโอน ${index + 1}: เลือกสมุดบัญชี`);
    if (toMoney(row.amount) > 0 && !row.transfer_date) errors.push(`แถวโอน ${index + 1}: เลือกวันที่โอน`);
  });
  cardRows.value.forEach((row, index) => {
    if (toMoney(row.amount) > 0 && !row.credit_card_type) errors.push(`แถวบัตร ${index + 1}: เลือกประเภทบัตร`);
  });
  depositRows.value.forEach((row, index) => {
    if (toMoney(row.amount) <= 0) return;
    if (!row.trans_number) errors.push(`รับเงินล่วงหน้าแถว ${index + 1}: เลือกเอกสาร`);
    const balance = advanceBalanceMap.value.get(row.trans_number);
    if (balance === undefined) errors.push(`รับเงินล่วงหน้าแถว ${index + 1}: ไม่พบเอกสาร ${row.trans_number}`);
    else if (usedAdvanceBalance({ doc_no: row.trans_number }) > balance + 0.01) errors.push(`รับเงินล่วงหน้าแถว ${index + 1}: ใช้เกินยอดคงเหลือ`);
  });
  return errors;
});
const canSave = computed(() => canCreate.value && validationErrors.value.length === 0 && !saving.value);

const paymentEntries = computed(() => {
  const rows = [];
  if (toMoney(cashAmount.value) > 0) rows.push({ id: "cash", type: "cash", label: "เงินสด", amount: toMoney(cashAmount.value) });
  if (toMoney(tigerAmount.value) > 0) rows.push({ id: "tiger", type: "tiger", label: "Tiger", amount: toMoney(tigerAmount.value), sub: tigerId.value ? `Transaction ${tigerId.value}` : "" });
  transferRows.value.forEach((row) => rows.push({ id: row.id, type: "transfer", label: passBookLabel(row.pass_book_code), amount: toMoney(row.amount), sub: "เงินโอน" }));
  cardRows.value.forEach((row) => rows.push({ id: row.id, type: "card", label: creditTypeLabel(row.credit_card_type), amount: toMoney(row.amount), sub: `ค่าธรรมเนียม ${formatCurrency(row.charge)} / รวม ${formatCurrency(toMoney(row.amount) + toMoney(row.charge))}` }));
  if (billDiscountAmount.value > 0) rows.push({ id: "discount", type: "discount", label: "ส่วนลดท้ายบิล", amount: billDiscountAmount.value, sub: billDiscountWord.value });
  depositRows.value.forEach((row) => rows.push({ id: row.id, type: "deposit", label: row.trans_number || "รับเงินล่วงหน้า", amount: toMoney(row.amount), sub: row.remark || "รับเงินล่วงหน้า" }));
  return rows.filter((row) => row.amount > 0);
});
const paymentTypeTabs = computed(() => [
  { key: "cash", label: "เงินสด", icon: "pi pi-money-bill" },
  { key: "transfer", label: "เงินโอน", icon: "pi pi-send" },
  { key: "card", label: "บัตรเครดิต", icon: "pi pi-credit-card" },
  { key: "deposit", label: "รับเงินล่วงหน้า", icon: "pi pi-wallet" },
  { key: "tiger", label: "Tiger", icon: "pi pi-desktop" },
]);
const DENOMS = [20, 50, 100, 500, 1000];
const selectedCardType = computed(() => findCreditType(cardDraft.value.credit_card_type));
const draftCardChargeRate = computed(() => creditChargeRate(selectedCardType.value));
const draftCardCharge = computed(() => rnd(toMoney(cardDraft.value.amount) * draftCardChargeRate.value / 100));

const steps = [
  { key: "document", label: "ข้อมูลเอกสาร", icon: "pi pi-file" },
  { key: "billing", label: "เลือกเอกสาร", icon: "pi pi-list" },
  { key: "payment", label: "รับชำระ", icon: "pi pi-wallet" },
  { key: "summary", label: "สรุป", icon: "pi pi-check-circle" },
];
const currentStep = ref("document");
const currentStepIndex = computed(() => Math.max(0, steps.findIndex((step) => step.key === currentStep.value)));
const currentStepMeta = computed(() => steps[currentStepIndex.value] || steps[0]);
const isFirstStep = computed(() => currentStepIndex.value === 0);
const stepIssues = computed(() => ({
  document: [
    ...(!docDate.value ? ["เลือกวันที่เอกสารก่อน"] : []),
    ...(!selectedDocFormatCode.value || !nextDoc.value?.doc_no ? ["เลือกรูปแบบเลขเอกสารก่อน"] : []),
    ...(!selectedCustomer.value?.code ? ["เลือกลูกหนี้ก่อน"] : []),
  ],
  billing: [
    ...(!detailRows.value.length ? ["เลือกเอกสารหนี้อย่างน้อย 1 รายการ"] : []),
    ...detailRows.value.flatMap((row, index) => {
      const errors = [];
      if (!isNonZeroAmount(row.sum_pay_money)) errors.push(`แถว ${index + 1}: ระบุยอดรับชำระ`);
      if (amountExceedsBalance(row.sum_pay_money, row.balance_ref)) errors.push(`แถว ${index + 1}: รับชำระเกินยอดคงเหลือ`);
      return errors;
    }),
  ],
  payment: paymentValidationErrors.value,
  summary: savedDocNo.value ? [] : ["บันทึกเอกสารก่อนเข้าสู่หน้าสรุป"],
}));
const currentStepIssues = computed(() => stepIssues.value[currentStep.value] || []);
const canGoNext = computed(() => currentStep.value !== "summary" && !currentStepIssues.value.length && currentStep.value !== "payment");
const savedPaymentSummaryRows = computed(() => paymentSummaryRows(savedDetail.value?.payment));
const savedPaymentDetailRows = computed(() => paymentDetailRows(savedDetail.value?.payment_detail));

watch(selectedDocFormatCode, () => loadNextDoc());
watch(docDate, () => {
  loadNextDoc();
  if (selectedCustomer.value?.code) {
    selectedBillings.value = [];
    detailRows.value = [];
    loadOpenBillings();
  }
});
watch(activePaymentType, (type) => {
  if (type === "deposit") loadAdvanceBalances();
});

onMounted(async () => {
  saleCode.value = currentUserCode();
  await Promise.all([loadDocFormats(), loadHistory(), loadPaymentMasters(), loadDefaultSalesUser()]);
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

function detailRowKey(row) {
  return `${row?.billing_no || row?.doc_no || ""}|${Number(row?.bill_type || 0)}`;
}

function selectedDetailKeys() {
  return detailRows.value
    .map(detailRowKey)
    .filter((key) => !key.endsWith("|0") && key !== "|0");
}

function isDetailSelected(row) {
  const key = detailRowKey(row);
  return detailRows.value.some((detail) => detailRowKey(detail) === key);
}

function debtSourceKey(row) {
  if (row?.source_mode === "direct_debt" || isDirectDebtMode.value) return `${row?.doc_no || row?.billing_no}|${row?.bill_type || ""}`;
  return row?.doc_no || row?.source_billing_no || "";
}

function makeRowId() {
  localRowId += 1;
  return `ar-pay-${Date.now()}-${localRowId}`;
}

function notify(severity, summary, detail) {
  toast.add({ severity, summary, detail, life: 4200 });
}

function openCustomerDialog() {
  customerDialogVisible.value = true;
  if (customerSearch.value.trim().length >= 2) searchCustomers();
}

function goToStep(stepKey) {
  if (stepKey === "summary" && !savedDocNo.value) return;
  const targetIndex = steps.findIndex((step) => step.key === stepKey);
  if (targetIndex < 0) return;
  if (targetIndex > currentStepIndex.value) {
    for (let i = 0; i < targetIndex; i++) {
      if ((stepIssues.value[steps[i].key] || []).length) return;
    }
  }
  currentStep.value = stepKey;
}

function nextStep() {
  if (!canGoNext.value) {
    const firstIssue = currentStepIssues.value[0];
    if (firstIssue) notify("warn", "ยังไปขั้นถัดไปไม่ได้", firstIssue);
    return;
  }
  const next = steps[currentStepIndex.value + 1];
  if (next) currentStep.value = next.key;
}

function prevStep() {
  const prev = steps[currentStepIndex.value - 1];
  if (prev) currentStep.value = prev.key;
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
    { label: "ส่วนลดท้ายบิล", amount: toMoney(payment?.discount_amount) },
    { label: "รับเงินล่วงหน้า", amount: toMoney(payment?.deposit_amount) },
  ].filter((row) => row.amount > 0);
}

function paymentDetailRows(rows = []) {
  return (Array.isArray(rows) ? rows : []).filter((row) => [1, 3, 5].includes(Number(row.doc_type)) && toMoney(row.amount) > 0);
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

function newTransferRow() {
  return { id: makeRowId(), pass_book_code: "", transfer_date: docDate.value || todayISO(), amount: null };
}

function newCardRow() {
  return { id: makeRowId(), credit_card_type: "", card_number: "", no_approved: "", amount: null, charge: 0 };
}

function newChequeRow() {
  return { id: makeRowId(), bank_code: "", bank_branch: "", trans_number: "", chq_due_date: docDate.value, amount: 0 };
}

function newCouponRow() {
  return { id: makeRowId(), trans_number: "", amount: 0, remark: "" };
}

function newDepositRow() {
  return { id: makeRowId(), trans_number: "", amount: 0, remark: "" };
}

function newIncomeRow() {
  return { id: makeRowId(), trans_number: "", amount: 0, remark: "" };
}

function newExpenseRow() {
  return { id: makeRowId(), trans_number: "", amount: 0, remark: "" };
}

function newVatSaleRow() {
  return {
    id: makeRowId(),
    vat_date: docDate.value,
    vat_number: nextDoc.value?.doc_no || "",
    tax_group: "",
    description: "",
    base_caltax_amount: selectedTotal.value,
    tax_rate: 7,
    amount: rnd((selectedTotal.value * 7) / 100),
    except_tax_amount: 0,
    vat_type: 0,
    is_add: 0,
  };
}

async function loadDocFormats() {
  docFormats.value = await getArDebtPaymentDocFormats({ user_code: currentUserCode() });
  selectedDocFormatCode.value = docFormats.value[0]?.code || "";
  await loadNextDoc();
}

async function loadNextDoc() {
  if (!selectedDocFormatCode.value || !docDate.value) return;
  try {
    nextDoc.value = await getNextArDebtPaymentDocNo({
      doc_format_code: selectedDocFormatCode.value,
      doc_date: docDate.value,
      user_code: currentUserCode(),
    });
  } catch {
    nextDoc.value = null;
  }
}

async function loadPaymentMasters() {
  const [books, cards, tigerConfig] = await Promise.all([
    getPassBookList(),
    getCreditTypeList(),
    getTigerConfig().catch(() => ({ enabled: false })),
  ]);
  passBooks.value = books;
  creditTypes.value = cards;
  tigerEnabled.value = !!tigerConfig?.enabled;
}

async function loadHistory() {
  historyLoading.value = true;
  try {
    historyRows.value = await getArDebtPaymentList({
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
    notify("error", "ค้นหาลูกหนี้ไม่สำเร็จ", ex.message);
  } finally {
    customerLoading.value = false;
  }
}

async function selectCustomer(row) {
  selectedCustomer.value = row;
  customerSearch.value = `${row.code || ""} ${customerName(row)}`.trim();
  customerDialogVisible.value = false;
  selectedBillings.value = [];
  detailRows.value = [];
  depositRows.value = [];
  selectedAdvanceBalance.value = null;
  advancePaymentAmount.value = null;
  await Promise.all([loadOpenBillings(), loadAdvanceBalances()]);
}

function customerName(row) {
  return row?.name_1 || row?.name || "";
}

function clearCustomer(clearText = true) {
  selectedCustomer.value = null;
  selectedBillings.value = [];
  detailRows.value = [];
  openBillings.value = [];
  advanceBalances.value = [];
  depositRows.value = [];
  selectedAdvanceBalance.value = null;
  advancePaymentAmount.value = null;
  vatSaleRows.value = [];
  if (clearText) customerSearch.value = "";
}

function clearCustomerSearch() {
  clearTimeout(customerTimer);
  customerSearch.value = "";
  customers.value = [];
  customerLoading.value = false;
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
    salesUsers.value = await getArDebtPaymentSalesUsers({
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
    const rows = await getArDebtPaymentSalesUsers({ search: code, user_code: code });
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

async function loadOpenBillings() {
  if (!selectedCustomer.value?.code) return;
  openBillingsLoading.value = true;
  try {
    openBillings.value = await getArDebtPaymentOpenBillings({
      cust_code: selectedCustomer.value.code,
      doc_date: docDate.value,
      due_date: docDate.value,
      branch_code: posStore.selectedPos?.branch_code || "",
      search: billingSearch.value,
      source_mode: debtSourceMode.value,
      exclude_keys: selectedDetailKeys(),
      user_code: currentUserCode(),
    });
    debtSourceMode.value = openBillings.value.source_mode || openBillings.value[0]?.source_mode || debtSourceMode.value;
  } catch (ex) {
    notify("error", `โหลด${debtSourcePluralLabel.value}ไม่สำเร็จ`, ex.message);
  } finally {
    openBillingsLoading.value = false;
  }
}

async function openDebtDocumentDialog() {
  if (!selectedCustomer.value?.code) {
    notify("warn", "เลือกลูกหนี้ก่อน", "ต้องเลือกลูกหนี้ก่อนค้นหาเอกสารหนี้");
    return;
  }
  debtSourceMode.value = "direct_debt";
  billingDialogVisible.value = true;
  await loadOpenBillings();
}

async function openBillingDialog() {
  if (!selectedCustomer.value?.code) {
    notify("warn", "เลือกลูกหนี้ก่อน", "ต้องเลือกลูกหนี้ก่อนค้นหาใบวางบิล");
    return;
  }
  debtSourceMode.value = "billing_note";
  billingDialogVisible.value = true;
  await loadOpenBillings();
}

async function loadAdvanceBalances() {
  if (!selectedCustomer.value?.code) {
    advanceBalances.value = [];
    selectedAdvanceBalance.value = null;
    advancePaymentAmount.value = null;
    return;
  }
  advanceLoading.value = true;
  try {
    advanceBalances.value = await getArDebtPaymentAdvanceBalance({
      cust_code: selectedCustomer.value.code,
      user_code: currentUserCode(),
    });
    if (selectedAdvanceBalance.value) {
      selectedAdvanceBalance.value = advanceBalances.value.find((row) => row.doc_no === selectedAdvanceBalance.value.doc_no) || null;
    }
  } catch (ex) {
    advanceBalances.value = [];
    notify("error", "โหลดเงินล่วงหน้า/มัดจำไม่สำเร็จ", ex.message);
  } finally {
    advanceLoading.value = false;
  }
}

async function addBilling(row) {
  if (!row?.doc_no) return;
  if (row.source_mode === "direct_debt" || isDirectDebtMode.value) {
    appendDetailRows([mapDirectDebtRow(row)], "เอกสารนี้ถูกลงรายการแล้ว");
  } else {
    await addBillingNote(row);
  }
}

function removeDetailRow(row) {
  const key = detailRowKey(row);
  detailRows.value = detailRows.value.filter((detail) => detailRowKey(detail) !== key);
  if (row?.source_billing_no) {
    const stillHasSource = detailRows.value.some((detail) => detail.source_billing_no === row.source_billing_no);
    if (!stillHasSource) selectedBillings.value = selectedBillings.value.filter((billing) => billing.doc_no !== row.source_billing_no);
  }
}

function removeBillingSource(docNo) {
  selectedBillings.value = selectedBillings.value.filter((row) => row.doc_no !== docNo);
  detailRows.value = detailRows.value.filter((row) => row.source_billing_no !== docNo);
}

function mapDirectDebtRow(row) {
  return {
    id: makeRowId(),
    source_billing_no: "",
    billing_no: row.billing_no || row.doc_no,
    billing_date: row.billing_date || row.doc_date,
    bill_type: Number(row.bill_type),
    bill_type_name: row.bill_type_name,
    ref_doc_no: row.ref_doc_no || "",
    ref_doc_date: row.ref_doc_date || "",
    due_date: row.due_date,
    sum_debt_amount: toMoney(row.sum_debt_amount),
    balance_ref: toMoney(row.balance_ref),
    sum_pay_money: toMoney(row.balance_ref),
    remark: row.remark || "",
  };
}

function reloadDirectDebtDetails() {
  detailRows.value = selectedBillings.value.map(mapDirectDebtRow);
}

function mapBillingDetailRow(row) {
  return {
    id: makeRowId(),
    source_billing_no: row.source_billing_no,
    source_billing_date: row.source_billing_date,
    billing_no: row.billing_no,
    billing_date: row.billing_date,
    bill_type: Number(row.bill_type),
    bill_type_name: row.bill_type_name,
    ref_doc_no: row.ref_doc_no || "",
    ref_doc_date: row.ref_doc_date || "",
    due_date: row.due_date,
    sum_debt_amount: toMoney(row.sum_debt_amount),
    balance_ref: toMoney(row.balance_ref),
    sum_pay_money: toMoney(row.balance_ref),
    remark: row.remark || "",
  };
}

function appendDetailRows(rows, duplicateMessage = "เอกสารนี้ถูกลงรายการแล้ว") {
  const incoming = rows.filter((row) => row?.billing_no && row?.bill_type);
  const existing = new Set(detailRows.value.map(detailRowKey));
  const uniqueRows = incoming.filter((row) => !existing.has(detailRowKey(row)));
  if (!uniqueRows.length) {
    notify("info", duplicateMessage, "ไม่มีรายการใหม่ให้เพิ่ม");
    return 0;
  }
  detailRows.value = [...detailRows.value, ...uniqueRows];
  return uniqueRows.length;
}

async function addBillingNote(row) {
  if (!row?.doc_no) return;
  const alreadySelected = selectedBillings.value.some((selected) => selected.doc_no === row.doc_no);
  try {
    const rows = await getArDebtPaymentBillingDetail({
      cust_code: selectedCustomer.value.code,
      doc_nos: [row.doc_no],
      doc_date: docDate.value,
      due_date: docDate.value,
      branch_code: posStore.selectedPos?.branch_code || "",
      exclude_keys: selectedDetailKeys(),
      user_code: currentUserCode(),
    });
    const added = appendDetailRows(rows.map(mapBillingDetailRow), "เอกสารในใบวางบิลนี้ถูกลงรายการครบแล้ว");
    if (added > 0 && !alreadySelected) selectedBillings.value.push(row);
    if (added > 0) notify("success", "เพิ่มรายการจากใบวางบิลแล้ว", `${row.doc_no} เพิ่ม ${added} รายการ`);
  } catch (ex) {
    notify("error", "โหลดรายละเอียดใบวางบิลไม่สำเร็จ", ex.message);
  }
}

async function reloadBillingDetails() {
  if (!selectedCustomer.value?.code || !selectedBillings.value.length) {
    detailRows.value = [];
    return;
  }
  if (isDirectDebtMode.value) {
    reloadDirectDebtDetails();
    return;
  }
  try {
    const rows = await getArDebtPaymentBillingDetail({
      cust_code: selectedCustomer.value.code,
      doc_nos: selectedBillings.value.map((row) => row.doc_no),
      user_code: currentUserCode(),
    });
    detailRows.value = rows.map((row) => ({
      id: makeRowId(),
      source_billing_no: row.source_billing_no,
      billing_no: row.billing_no,
      billing_date: row.billing_date,
      bill_type: Number(row.bill_type),
      bill_type_name: row.bill_type_name,
      ref_doc_no: row.ref_doc_no || "",
      ref_doc_date: row.ref_doc_date || "",
      due_date: row.due_date,
      sum_debt_amount: toMoney(row.sum_debt_amount),
      balance_ref: toMoney(row.balance_ref),
      sum_pay_money: toMoney(row.balance_ref),
      remark: row.remark || "",
    }));
  } catch (ex) {
    notify("error", "โหลดรายละเอียดใบวางบิลไม่สำเร็จ", ex.message);
  }
}

function fillAllBalances() {
  detailRows.value = detailRows.value.map((row) => ({ ...row, sum_pay_money: toMoney(row.balance_ref) }));
}

function fillCashExact() {
  cashAmount.value = Math.max(
    0,
    rnd(
      totalDue.value
        - toMoney(tigerAmount.value)
        - transferTotal.value
        - cardTotal.value
        - depositTotal.value,
    ),
  );
}

function addDenom(value) {
  cashAmount.value = rnd(toMoney(cashAmount.value) + value);
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

function addChequeRow() {
  chequeRows.value.push(newChequeRow());
}

function addCouponRow() {
  couponRows.value.push(newCouponRow());
}

function addDepositRow() {
  depositRows.value.push(newDepositRow());
}

function addIncomeRow() {
  incomeRows.value.push(newIncomeRow());
}

function addExpenseRow() {
  expenseRows.value.push(newExpenseRow());
}

function addVatSaleRow() {
  vatSaleRows.value.push(newVatSaleRow());
}

function recalcVatSaleRow(row) {
  row.amount = rnd((toMoney(row.base_caltax_amount) * toMoney(row.tax_rate)) / 100);
}

function fillDepositBalance(row) {
  const balance = advanceBalanceMap.value.get(row.trans_number);
  if (balance !== undefined && toMoney(row.amount) <= 0) row.amount = balance;
}

function advanceBalanceLabel(row) {
  if (!row) return "";
  return `${row.doc_no || ""} ${row.doc_date ? `(${formatDate(row.doc_date)})` : ""}`.trim();
}

function chooseAdvanceBalance(row) {
  if (!row) return;
  selectedAdvanceBalance.value = row;
  const usable = advanceBalanceAvailable(row);
  advancePaymentAmount.value = rnd(Math.min(usable, remainingAmount.value > 0 ? remainingAmount.value : usable));
}

function addAdvancePayment(row = selectedAdvanceBalance.value) {
  if (!row?.doc_no) return;
  const usable = advanceBalanceAvailable(row);
  const draftAmount = row.pay_amount !== undefined ? row.pay_amount : advancePaymentAmount.value;
  const amount = rnd(Math.min(toMoney(draftAmount), usable));
  if (amount <= 0) return;
  depositRows.value.push({
    id: makeRowId(),
    trans_number: row.doc_no,
    amount,
    remark: advanceBalanceLabel(row),
  });
  advancePaymentAmount.value = null;
  row.pay_amount = null;
  if (advanceBalanceAvailable(row) <= 0) selectedAdvanceBalance.value = null;
}

function removeRow(rows, index) {
  rows.splice(index, 1);
}

function removePaymentEntry(entry) {
  if (!entry) return;
  if (entry.type === "cash") cashAmount.value = null;
  else if (entry.type === "tiger") {
    tigerAmount.value = 0;
    tigerId.value = "";
    tigerStatus.value = "idle";
  }
  else if (entry.type === "petty") pettyCashAmount.value = 0;
  else if (entry.type === "discount") billDiscountWord.value = "";
  else if (entry.type === "round") paymentRoundAmount.value = 0;
  else if (entry.type === "transfer") transferRows.value = transferRows.value.filter((row) => row.id !== entry.id);
  else if (entry.type === "card") cardRows.value = cardRows.value.filter((row) => row.id !== entry.id);
  else if (entry.type === "cheque") chequeRows.value = chequeRows.value.filter((row) => row.id !== entry.id);
  else if (entry.type === "coupon") couponRows.value = couponRows.value.filter((row) => row.id !== entry.id);
  else if (entry.type === "deposit") depositRows.value = depositRows.value.filter((row) => row.id !== entry.id);
  else if (entry.type === "income") incomeRows.value = incomeRows.value.filter((row) => row.id !== entry.id);
  else if (entry.type === "expense") expenseRows.value = expenseRows.value.filter((row) => row.id !== entry.id);
}

function paymentEntryIcon(type) {
  const map = {
    cash: "pi pi-money-bill",
    tiger: "pi pi-desktop",
    petty: "pi pi-money-bill",
    discount: "pi pi-percentage",
    round: "pi pi-sliders-h",
    transfer: "pi pi-send",
    card: "pi pi-credit-card",
    cheque: "pi pi-file-edit",
    coupon: "pi pi-ticket",
    deposit: "pi pi-wallet",
    income: "pi pi-plus-circle",
    expense: "pi pi-minus-circle",
  };
  return map[type] || "pi pi-wallet";
}

function genTigerRef() {
  return `${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
}

const tigerPayAmount = computed(() => rnd(remainingAmount.value > 0 ? remainingAmount.value : totalDue.value));
const tigerReady = computed(() => tigerEnabled.value || TIGER_MOCK);

async function startTigerPayment() {
  const amount = tigerPayAmount.value;
  if (amount <= 0 || tigerStatus.value === "requesting" || tigerStatus.value === "waiting" || tigerStatus.value === "processing") return;
  if (!tigerReady.value) {
    tigerStatus.value = "failed";
    tigerError.value = "ยังไม่ได้เปิดใช้งาน Tiger สำหรับเครื่องนี้";
    return;
  }
  tigerStatus.value = "requesting";
  tigerDialogVisible.value = true;
  tigerError.value = "";
  tigerCancel.value = false;
  tigerRef1.value = genTigerRef();
  tigerRef2.value = genTigerRef();
  try {
    const res = await createTigerOrder({
      orderId: generateUUID(),
      custName: selectedCustomer.value ? customerName(selectedCustomer.value) : "",
      posId: posStore.posId,
      amount,
      ref1: tigerRef1.value,
      ref2: tigerRef2.value,
    });
    if (res.status !== "new") throw new Error("ไม่สามารถสร้างรายการชำระเงิน Tiger ได้");
    tigerId.value = String(res.id);
    tigerStatus.value = "waiting";
    tigerCancel.value = true;
    clearInterval(tigerPollInterval.value);
    tigerPollInterval.value = setInterval(pollTiger, 3000);
  } catch (ex) {
    tigerStatus.value = "failed";
    tigerError.value = ex.message || "สร้างรายการ Tiger ไม่สำเร็จ";
  }
}

async function pollTiger() {
  if (!tigerId.value) return;
  try {
    const res = await inquireTigerOrder(tigerId.value);
    if (res.status === "success") {
      clearInterval(tigerPollInterval.value);
      tigerStatus.value = "success";
      tigerAmount.value = tigerPayAmount.value;
      await saveDoc();
      tigerDialogVisible.value = false;
    } else if (res.status === "cancel") {
      clearInterval(tigerPollInterval.value);
      tigerStatus.value = "cancel";
      tigerDialogVisible.value = false;
    } else if (res.status === "failed") {
      clearInterval(tigerPollInterval.value);
      tigerStatus.value = "failed";
      tigerError.value = "Tiger: การชำระเงินล้มเหลว";
    } else if (res.status === "new") {
      tigerCancel.value = true;
    } else if (res.status === "processing") {
      tigerStatus.value = "processing";
      tigerCancel.value = false;
    }
  } catch {
    // Keep polling when the network blips.
  }
}

async function cancelTigerPayment() {
  clearInterval(tigerPollInterval.value);
  try {
    if (tigerId.value) await cancelTigerOrder(tigerId.value);
  } catch {
    // Ignore cancellation sync errors; the UI can safely return to idle.
  }
  tigerStatus.value = "idle";
  tigerId.value = "";
  tigerCancel.value = false;
  tigerDialogVisible.value = false;
}

onUnmounted(() => clearInterval(tigerPollInterval.value));

function resetForm(keepCustomer = false, keepSavedDoc = false) {
  if (!keepSavedDoc) savedDocNo.value = "";
  if (!keepSavedDoc) savedDetail.value = null;
  if (!keepSavedDoc) {
    docImages.value = [];
    imageError.value = "";
    printForms.value = [];
    selectedPrintForms.value = [];
    printError.value = "";
    billingDialogVisible.value = false;
    currentStep.value = "document";
  }
  docDate.value = todayISO();
  docTime.value = currentTime();
  saleCode.value = currentUserCode();
  selectedSalesUser.value = null;
  remark.value = "";
  billDiscountWord.value = "";
  billingSearch.value = "";
  selectedBillings.value = [];
  detailRows.value = [];
  activePaymentType.value = "cash";
  cashAmount.value = null;
  clearInterval(tigerPollInterval.value);
  tigerAmount.value = 0;
  tigerId.value = "";
  tigerError.value = "";
  tigerStatus.value = "idle";
  tigerDialogVisible.value = false;
  tigerCancel.value = false;
  pettyCashAmount.value = 0;
  paymentRoundAmount.value = 0;
  transferRows.value = [];
  cardRows.value = [];
  transferDraft.value = newTransferRow();
  cardDraft.value = newCardRow();
  chequeRows.value = [];
  couponRows.value = [];
  depositRows.value = [];
  selectedAdvanceBalance.value = null;
  advancePaymentAmount.value = null;
  incomeRows.value = [];
  expenseRows.value = [];
  vatSaleRows.value = [];
  if (!keepCustomer) clearCustomer();
  loadNextDoc();
  loadDefaultSalesUser();
  if (keepCustomer && selectedCustomer.value?.code) Promise.all([loadOpenBillings(), loadAdvanceBalances()]);
}

function buildPayload() {
  const userCode = currentUserCode();
  return {
    doc_date: docDate.value,
    doc_time: docTime.value,
    doc_format_code: selectedDocFormatCode.value || "",
    cust_code: selectedCustomer.value?.code || "",
    sale_code: saleCode.value,
    branch_code: posStore.selectedPos?.branch_code || "",
    emp_code: userCode,
    creator_code: userCode,
    remark: remark.value,
    discount_word: billDiscountWord.value.trim(),
    details: detailRows.value.map((row) => ({
      source_billing_no: row.source_billing_no,
      billing_no: row.billing_no,
      billing_date: row.billing_date,
      due_date: row.due_date,
      bill_type: row.bill_type,
      bill_type_name: row.bill_type_name,
      ref_doc_no: row.ref_doc_no,
      ref_doc_date: row.ref_doc_date,
      sum_debt_amount: toMoney(row.sum_debt_amount),
      balance_ref: toMoney(row.balance_ref),
      sum_pay_money: toMoney(row.sum_pay_money),
      remark: row.remark || "",
    })),
    vat_sale: [],
    payments: {
      cash_amount: rnd(toMoney(cashAmount.value) + toMoney(tigerAmount.value)),
      tiger_amount: toMoney(tigerAmount.value),
      tiger_order_id: tigerId.value || "",
      tiger_ref1: tigerRef1.value || "",
      tiger_ref2: tigerRef2.value || "",
      petty_cash_amount: 0,
      discount_amount: billDiscountAmount.value,
      total_income_amount: 0,
      transfer: transferRows.value.map((row) => ({ pass_book_code: row.pass_book_code, transfer_date: row.transfer_date, amount: toMoney(row.amount) })),
      card: cardRows.value.map((row) => ({
        credit_card_type: row.credit_card_type,
        trans_number: row.card_number || row.trans_number,
        card_number: row.card_number || row.trans_number,
        no_approved: row.no_approved,
        amount: toMoney(row.amount),
        charge: toMoney(row.charge),
      })),
      cheque: [],
      coupon: [],
      deposit: depositRows.value.map((row) => ({
        trans_number: row.trans_number,
        amount: toMoney(row.amount),
        remark: row.remark || "",
      })),
      income: [],
      expense: [],
    },
  };
}

async function saveDoc() {
  if (!canSave.value) return;
  saving.value = true;
  try {
    const result = await saveArDebtPayment(buildPayload());
    savedDocNo.value = result.doc_no || "";
    notify("success", "บันทึกรับชำระหนี้แล้ว", savedDocNo.value);
    resetForm(true, true);
    currentStep.value = "summary";
    if (savedDocNo.value) {
      try {
        savedDetail.value = await getArDebtPaymentDetail(savedDocNo.value, currentUserCode());
      } catch {
        savedDetail.value = null;
      }
      try {
        await loadDocImages(savedDocNo.value);
      } catch {
        docImages.value = [];
      }
    }
  } catch (ex) {
    notify("error", "บันทึกไม่สำเร็จ", ex.message);
  } finally {
    saving.value = false;
  }
  Promise.allSettled([loadHistory(), loadNextDoc(), loadOpenBillings(), loadAdvanceBalances()]);
}

function currentSavedDocNo() {
  return savedDocNo.value || savedDetail.value?.header?.doc_no || "";
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
  const docNo = currentSavedDocNo();
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
    const result = await deleteDocImage(guidCode);
    if (!result.success) throw new Error(result.msg || "ลบรูปไม่สำเร็จ");
    await loadDocImages();
    confirmDeleteVisible.value = false;
    pendingDeleteImage.value = null;
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
    savedDetail.value = await getArDebtPaymentDetail(row.doc_no, currentUserCode());
  } catch (ex) {
    notify("error", "เปิดเอกสารไม่สำเร็จ", ex.message);
  } finally {
    detailLoading.value = false;
  }
}
</script>

<template>
  <div class="payment-page debt-step-page">
    <section class="top-strip">
      <div class="title-block">
        <h1>รับชำระหนี้/ออกใบเสร็จรับเงิน</h1>
        <span>เลขที่ถัดไป {{ nextDoc?.doc_no || "-" }}</span>
      </div>
      <div class="top-actions">
        <Button icon="pi pi-history" label="ประวัติ" class="action-btn action-history" @click="router.push('/sales/ar-debt-payment/history')" />
        <Button icon="pi pi-plus" label="เอกสารใหม่" class="action-btn action-new" @click="resetForm(false)" />
      </div>
    </section>

    <nav class="stepper" aria-label="ขั้นตอนรับชำระหนี้">
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

    <Message v-if="savedDocNo && currentStep !== 'summary'" severity="success" :closable="false">บันทึกล่าสุด: {{ savedDocNo }}</Message>

    <section
      v-if="currentStep !== 'summary'"
      class="work-grid step-work-grid"
      :class="{ 'document-only': currentStep === 'document', 'billing-only': currentStep === 'billing', 'payment-only': currentStep === 'payment' }"
    >
      <aside v-if="false" class="history-panel">
        <div class="panel-head">
          <div>
            <h2>ประวัติ</h2>
            <span>{{ historyRows.length }} รายการ</span>
          </div>
          <Button icon="pi pi-search" text rounded aria-label="ค้นหา" @click="loadHistory" />
        </div>
        <div class="history-filter">
          <InputText v-model="historySearch" placeholder="เลขที่ / ลูกหนี้" @keyup.enter="loadHistory" />
          <div class="date-row">
            <input v-model="historyFromDate" class="date-input" type="date" />
            <input v-model="historyToDate" class="date-input" type="date" />
          </div>
        </div>
        <DataTable
          :value="historyRows"
          :loading="historyLoading"
          size="small"
          scrollable
          scroll-height="flex"
          class="compact-table history-table"
          @row-click="openDetail($event.data)"
        >
          <Column field="doc_no" header="เลขที่" />
          <Column field="cust_name" header="ลูกหนี้" />
          <Column field="total_net_value" header="ยอด">
            <template #body="{ data }">{{ formatCurrency(data.total_net_value) }}</template>
          </Column>
        </DataTable>
      </aside>

      <main v-if="currentStep === 'document' || currentStep === 'billing'" class="editor-panel">
        <div v-if="currentStep === 'document'" class="doc-fields">
          <label>
            รูปแบบเลข
            <Select v-model="selectedDocFormatCode" :options="docFormatOptions" option-label="label" option-value="code" />
          </label>
          <label>
            วันที่
            <InputText v-model="docDate" class="date-input" type="date" />
          </label>
          <label>
            เวลา
            <InputText v-model="docTime" class="date-input" type="time" />
          </label>
          <label>
            พนักงานขาย
            <div class="customer-picker">
              <InputText :model-value="salesUserDisplay" placeholder="เลือกพนักงานขาย" readonly />
              <Button icon="pi pi-search" label="ค้นหา" class="action-btn action-search" @click="openSalesUserDialog" />
            </div>
          </label>
        </div>

        <div v-if="currentStep === 'document'" class="customer-zone">
          <div class="customer-search">
            <label>
              ลูกหนี้
              <div class="customer-picker customer-picker-clearable">
                <InputText :model-value="selectedCustomer ? `${selectedCustomer.code} - ${customerName(selectedCustomer)}` : ''" readonly placeholder="เลือกลูกหนี้" />
                <Button icon="pi pi-search" label="ค้นหา" class="action-btn action-search" @click="openCustomerDialog" />
                <Button v-if="selectedCustomer" icon="pi pi-times" text rounded severity="danger" aria-label="ล้างลูกหนี้" @click="clearCustomer" />
              </div>
            </label>
          </div>
          <div v-if="selectedCustomer" class="selected-customer">
            <strong>{{ selectedCustomer.code }}</strong>
            <span>{{ customerName(selectedCustomer) }}</span>
          </div>
        </div>

        <Message v-if="currentStep === 'document' && currentStepIssues.length" severity="warn" :closable="false">
          <div v-for="error in currentStepIssues" :key="error">{{ error }}</div>
        </Message>

        <div v-if="currentStep === 'billing'" class="billing-summary-head">
          <div>
            <span>รายการที่รับชำระ</span>
            <h2>เอกสารหนี้ที่นำมาชำระ</h2>
          </div>
          <strong>{{ formatCurrency(selectedTotal) }}</strong>
        </div>
        <DataTable v-if="currentStep === 'billing' && selectedBillings.length" :value="selectedBillings" size="small" class="compact-table selected-billing-table">
          <template #empty>ยังไม่ได้เลือกใบวางบิล</template>
          <Column field="doc_no" header="ใบวางบิลอ้างอิง" />
          <Column field="doc_date" header="วันที่">
            <template #body="{ data }">{{ formatDate(data.doc_date) }}</template>
          </Column>
          <Column field="balance_ref" header="คงเหลือ">
            <template #body="{ data }">{{ formatCurrency(data.balance_ref) }}</template>
          </Column>
          <Column header="">
            <template #body="{ data }">
              <Button icon="pi pi-times" text rounded severity="danger" aria-label="ลบใบวางบิล" @click="removeBillingSource(data.doc_no)" />
            </template>
          </Column>
        </DataTable>

        <DataTable v-if="currentStep === 'billing'" :value="detailRows" size="small" class="detail-table" scrollable scroll-height="330px">
          <template #empty>ยังไม่ได้เลือกเอกสารหนี้</template>
          <Column field="billing_no" header="เอกสารต้นทาง" />
          <Column field="bill_type_name" header="ประเภท" />
          <Column field="source_billing_no" header="ใบวางบิล">
            <template #body="{ data }">{{ data.source_billing_no || "-" }}</template>
          </Column>
          <Column field="balance_ref" header="คงเหลือ">
            <template #body="{ data }">{{ formatCurrency(data.balance_ref) }}</template>
          </Column>
          <Column field="sum_pay_money" header="รับชำระ">
            <template #body="{ data }">
              <InputNumber v-model="data.sum_pay_money" mode="currency" currency="THB" locale="th-TH" :min="amountMin(data)" :max="amountMax(data)" input-class="money-input" />
            </template>
          </Column>
          <Column header="">
            <template #body="{ data }">
              <Button icon="pi pi-times" text rounded severity="danger" aria-label="ลบรายการ" @click="removeDetailRow(data)" />
            </template>
          </Column>
        </DataTable>

        <div v-if="currentStep === 'billing'" class="bill-discount-field">
          <label>
            ส่วนลดท้ายบิล
            <InputText v-model.trim="billDiscountWord" placeholder="เช่น 10%, 500, 10%,200" />
          </label>
          <div class="bill-discount-preview">
            <span>มูลค่าส่วนลด</span>
            <strong>-{{ formatCurrency(billDiscountAmount) }}</strong>
            <span>ยอดหลังส่วนลด</span>
            <strong class="net-after-discount">{{ formatCurrency(totalAfterDiscount) }}</strong>
          </div>
        </div>

        <label v-if="currentStep === 'billing'" class="remark-field">
          หมายเหตุ
          <InputText v-model="remark" />
        </label>

        <Message v-if="currentStep === 'billing' && currentStepIssues.length" severity="warn" :closable="false">
          <div v-for="error in currentStepIssues" :key="error">{{ error }}</div>
        </Message>
        <Message v-if="!canCreate" severity="info" :closable="false">ผู้ใช้ปัจจุบันมีสิทธิ์ดูเอกสาร แต่ไม่มีสิทธิ์สร้างรับชำระหนี้</Message>
      </main>

      <aside v-if="currentStep === 'billing' || currentStep === 'payment'" class="payment-panel" :class="{ 'billing-picker-panel': currentStep === 'billing' }">
        <div class="payment-total" :class="{ 'billing-total': currentStep === 'billing' }">
          <span>ยอดรับชำระ</span>
          <strong>{{ formatCurrency(totalAfterDiscount) }}</strong>
          <small v-if="billDiscountAmount > 0">ก่อนลด {{ formatCurrency(selectedTotal) }} / ลด {{ formatCurrency(billDiscountAmount) }}</small>
        </div>

        <section v-if="currentStep === 'billing'" class="billing-dialog-launch">
          <div>
            <span>เอกสารในรายการ</span>
            <strong>{{ detailRows.length }} รายการ</strong>
          </div>
          <div class="billing-launch-actions">
            <Button icon="pi pi-search" label="ดึงเอกสารขาย/หนี้" class="action-btn action-search" :disabled="!selectedCustomer" @click="openDebtDocumentDialog" />
            <Button icon="pi pi-file-import" label="เลือกใบวางบิล" class="action-btn action-add" :disabled="!selectedCustomer" @click="openBillingDialog" />
          </div>
        </section>

        <div v-if="currentStep === 'payment'" class="payment-methods">
          <div class="payment-meter">
            <div><span>ยอดที่ต้องชำระ</span><strong>{{ formatCurrency(totalDue) }}</strong></div>
            <div><span>รับแล้ว</span><strong>{{ formatCurrency(paidTotal) }}</strong></div>
            <div><span>{{ overpaidAmount > 0 ? "ยอดเกิน" : "คงเหลือ" }}</span><strong>{{ formatCurrency(overpaidAmount > 0 ? overpaidAmount : remainingAmount) }}</strong></div>
            <div><span>ค่าธรรมเนียมบัตร</span><strong>{{ formatCurrency(cardChargeTotal) }}</strong></div>
            <div v-if="billDiscountAmount > 0"><span>ส่วนลดท้ายบิล</span><strong>-{{ formatCurrency(billDiscountAmount) }}</strong></div>
          </div>

          <section class="payment-entry-list">
            <div v-if="!paymentEntries.length" class="entries-empty">ยังไม่มีรายการรับชำระ</div>
            <div v-else class="entries-list">
              <div v-for="entry in paymentEntries" :key="`${entry.type}-${entry.id}`" class="entry-row">
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

        <section v-if="activePaymentType === 'cash'" class="pay-section">
          <div class="pay-head">
            <h2>รับชำระ</h2>
            <Button icon="pi pi-check" label="เงินสดพอดี" class="action-btn action-exact" @click="fillCashExact" />
          </div>
          <div class="denom-row">
            <button v-for="value in DENOMS" :key="value" type="button" class="denom-btn" @click="addDenom(value)">
              {{ value >= 1000 ? `${value / 1000}K` : value }}
            </button>
            <button type="button" class="denom-btn exact" :disabled="remainingAmount <= 0" @click="fillCashExact">พอดี</button>
          </div>
          <label>
            จำนวนรับ
            <InputNumber v-model="cashAmount" mode="currency" currency="THB" locale="th-TH" :min="0" />
          </label>
        </section>

        <section v-if="activePaymentType === 'transfer'" class="pay-section">
          <div class="pay-head">
            <h3>โอนเงิน</h3>
          </div>
          <label>
            สมุดบัญชี
            <Select v-model="transferDraft.pass_book_code" :options="passBookOptions" option-label="label" option-value="code" placeholder="สมุดบัญชี" />
          </label>
          <label>
            วันที่โอน
            <InputText v-model="transferDraft.transfer_date" type="date" />
          </label>
          <label>
            จำนวนเงิน
            <InputNumber v-model="transferDraft.amount" mode="currency" currency="THB" locale="th-TH" :min="0" />
          </label>
          <Button icon="pi pi-plus" label="เพิ่มรายการ" class="action-btn action-add" :disabled="!transferDraft.pass_book_code || !transferDraft.transfer_date || toMoney(transferDraft.amount) <= 0" @click="addTransferRow" />
        </section>

        <section v-if="activePaymentType === 'card'" class="pay-section">
          <div class="pay-head">
            <h3>บัตรเครดิต</h3>
          </div>
          <label>
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
          <label>
            เลขที่บัตร
            <InputText v-model="cardDraft.card_number" placeholder="เลขที่บัตรเครดิต" />
          </label>
          <label>
            เลขที่อนุมัติ
            <InputText v-model="cardDraft.no_approved" placeholder="รหัสอนุมัติ" />
          </label>
          <label>
            จำนวนเงิน
            <InputNumber v-model="cardDraft.amount" mode="currency" currency="THB" locale="th-TH" :min="0" />
          </label>
          <div class="charge-preview">
            <span>ค่าธรรมเนียม ({{ draftCardChargeRate }}%)</span>
            <strong>{{ formatCurrency(draftCardCharge) }}</strong>
          </div>
          <Button icon="pi pi-plus" label="เพิ่มรายการ" class="action-btn action-add" :disabled="!cardDraft.credit_card_type || toMoney(cardDraft.amount) <= 0" @click="addCardRow" />
        </section>

        <section v-if="activePaymentType === 'deposit'" class="pay-section deposit-panel">
          <div class="pay-head">
            <div>
              <h3>รับเงินล่วงหน้า</h3>
              <span class="pay-subtitle">เลือกเอกสารล่วงหน้าคงเหลือของลูกหนี้นี้</span>
            </div>
            <Button icon="pi pi-refresh" label="โหลดใหม่" severity="secondary" outlined :loading="advanceLoading" :disabled="!selectedCustomer" @click="loadAdvanceBalances" />
          </div>

          <Message v-if="!selectedCustomer" severity="warn" :closable="false">เลือกลูกหนี้ก่อนใช้รับเงินล่วงหน้า</Message>
          <div v-else-if="advanceLoading" class="deposit-state">
            <ProgressSpinner style="width: 2rem; height: 2rem" stroke-width="4" />
            <span>กำลังโหลดเอกสารล่วงหน้า...</span>
          </div>
          <div v-else-if="!availableAdvanceBalances.length" class="deposit-state">
            <i class="pi pi-info-circle" />
            <span>ไม่มีรับเงินล่วงหน้าคงเหลือ</span>
          </div>
          <DataTable v-else :value="availableAdvanceBalances" size="small" class="advance-payment-table" scrollable scroll-height="340px">
            <Column field="doc_no" header="เลขที่เอกสาร" />
            <Column field="doc_date" header="วันที่">
              <template #body="{ data }">{{ formatDate(data.doc_date) }}</template>
            </Column>
            <Column field="total_amount" header="ยอดเอกสาร">
              <template #body="{ data }">{{ formatCurrency(data.total_amount) }}</template>
            </Column>
            <Column field="used_amount" header="ใช้แล้ว">
              <template #body="{ data }">{{ formatCurrency(data.used_amount) }}</template>
            </Column>
            <Column header="คงเหลือ">
              <template #body="{ data }">
                <strong class="deposit-balance">{{ formatCurrency(advanceBalanceAvailable(data)) }}</strong>
              </template>
            </Column>
            <Column header="ยอดที่ใช้">
              <template #body="{ data }">
                <InputNumber v-model="data.pay_amount" mode="currency" currency="THB" locale="th-TH" :min="0" :max="advanceBalanceAvailable(data)" input-class="money-input" />
              </template>
            </Column>
            <Column header="">
              <template #body="{ data }">
                <Button icon="pi pi-plus" label="เพิ่ม" class="action-btn action-add" size="small" :disabled="toMoney(data.pay_amount) <= 0 || advanceBalanceAvailable(data) <= 0" @click="addAdvancePayment(data)" />
              </template>
            </Column>
          </DataTable>
        </section>

        <section v-if="activePaymentType === 'tiger'" class="pay-section tiger-panel">
          <div v-if="tigerStatus === 'idle' || tigerStatus === 'failed' || tigerStatus === 'cancel'" class="tiger-idle">
            <span class="tiger-amount-label">ยอดชำระ</span>
            <strong class="tiger-amount-value">{{ formatCurrency(tigerPayAmount) }}</strong>
            <Message v-if="!tigerReady" severity="warn" :closable="false">ยังไม่ได้เปิดใช้งาน Tiger สำหรับเครื่องนี้</Message>
            <Message v-if="tigerError" severity="error" :closable="false">{{ tigerError }}</Message>
            <Button icon="pi pi-desktop" label="ส่งคำสั่งชำระที่เครื่อง Tiger" class="action-btn action-new tiger-pay-btn" :disabled="!tigerReady || tigerPayAmount <= 0 || saving" @click="startTigerPayment" />
          </div>
          <div v-else class="tiger-status">
            <i class="pi pi-spin pi-spinner" />
            <span>{{ tigerStatus === "success" ? "ชำระสำเร็จ กำลังบันทึก..." : "กำลังรอการชำระเงินที่เครื่อง Tiger..." }}</span>
            <strong>{{ formatCurrency(tigerPayAmount) }}</strong>
            <Button v-if="tigerCancel" label="ยกเลิก" severity="danger" outlined @click="cancelTigerPayment" />
          </div>
        </section>

        </div>



        <Message v-if="currentStep === 'payment' && currentStepIssues.length" severity="warn" :closable="false">
          <div v-for="error in currentStepIssues" :key="error">{{ error }}</div>
        </Message>
      </aside>
    </section>

    <section v-if="currentStep === 'summary'" class="summary-step">
      <div class="done-card">
        <i class="pi pi-check-circle done-icon" />
        <div>
          <div class="done-title">รับชำระหนี้เรียบร้อย</div>
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
        <Message v-if="imageError" severity="error" :closable="false">{{ imageError }}</Message>
        <div v-if="docImages.length" class="proof-grid">
          <div v-for="image in docImages" :key="image.guid_code" class="proof-item">
            <a :href="getDocImageUrl(image.guid_code)" target="_blank" rel="noopener">
              <img :src="getDocImageUrl(image.guid_code)" alt="หลักฐานการรับชำระ" />
            </a>
            <button type="button" class="proof-remove" aria-label="ลบรูป" @click="askDeleteImage(image)">
              <i class="pi pi-times" />
            </button>
          </div>
        </div>
        <div v-else class="proof-empty">ยังไม่มีรูปหลักฐาน</div>
      </div>

      <div class="done-actions">
        <Button icon="pi pi-print" label="พิมพ์ฟอร์ม" class="action-btn action-print" :disabled="!savedDocNo" @click="openPrintDialog" />
        <Button icon="pi pi-history" label="ประวัติ" class="action-btn action-history" @click="router.push('/sales/ar-debt-payment/history')" />
        <Button icon="pi pi-plus" label="เอกสารใหม่" class="action-btn action-new" @click="resetForm(false)" />
      </div>
    </section>

    <footer v-if="currentStep !== 'summary'" class="step-footer">
      <div class="footer-actions">
        <Button icon="pi pi-chevron-left" label="กลับ" severity="secondary" outlined :disabled="isFirstStep" @click="prevStep" />
        <Button v-if="currentStep === 'payment'" icon="pi pi-save" label="บันทึก" class="action-btn action-new" :loading="saving" :disabled="!canSave" @click="saveDoc" />
        <Button v-else icon="pi pi-chevron-right" icon-pos="right" label="ถัดไป" class="action-btn action-new" :disabled="!canGoNext" @click="nextStep" />
      </div>
    </footer>

    <Dialog v-model:visible="tigerDialogVisible" modal :closable="false" header="TEST MODE - กรุณาชำระที่เครื่องรับเงิน" :style="{ width: 'min(420px, calc(100vw - 2rem))' }">
      <div class="tiger-dialog-body">
        <div v-if="TIGER_MOCK" class="tiger-mock-banner">กำลังจำลองการชำระเงิน จะสำเร็จอัตโนมัติในประมาณ 5 วินาที</div>
        <i v-if="tigerStatus === 'requesting' || tigerStatus === 'waiting' || tigerStatus === 'processing'" class="pi pi-spin pi-spinner tiger-spinner" />
        <i v-else-if="tigerStatus === 'success'" class="pi pi-check-circle tiger-check" />
        <i v-else-if="tigerStatus === 'failed' || tigerStatus === 'cancel'" class="pi pi-times-circle tiger-err-icon" />
        <strong class="tiger-amount-value">{{ formatCurrency(tigerPayAmount) }}</strong>
        <div class="tiger-info-box">
          <div class="tiger-info-row">
            <span class="tiger-info-label">Transaction ID:</span>
            <span class="tiger-info-val">{{ tigerId || "-" }}</span>
          </div>
          <div class="tiger-info-row">
            <span class="tiger-info-label">ลูกค้า:</span>
            <span class="tiger-info-val">{{ selectedCustomer ? customerName(selectedCustomer) : "ลูกค้าทั่วไป" }}</span>
          </div>
        </div>
        <Message v-if="tigerError" severity="error" :closable="false">{{ tigerError }}</Message>
      </div>
      <template #footer>
        <Button v-if="tigerCancel" icon="pi pi-times" label="ยกเลิก" severity="secondary" @click="cancelTigerPayment" />
        <Button v-if="tigerStatus === 'failed' || tigerStatus === 'cancel'" label="ปิด" severity="secondary" @click="tigerDialogVisible = false" />
      </template>
    </Dialog>

    <Dialog v-model:visible="detailDialogVisible" modal header="รายละเอียดรับชำระหนี้" :style="{ width: 'min(920px, calc(100vw - 2rem))' }">
      <div v-if="detailLoading" class="dialog-state">กำลังโหลด...</div>
      <div v-else-if="savedDetail" class="detail-dialog">
        <div class="detail-title">
          <strong>{{ savedDetail.header?.doc_no }}</strong>
          <span>{{ formatDate(savedDetail.header?.doc_date) }}</span>
        </div>
        <div class="detail-meta">
          <span>{{ savedDetail.header?.cust_code }}</span>
          <span>{{ savedDetail.header?.cust_name }}</span>
          <strong>{{ formatCurrency(savedDetail.header?.total_after_discount ?? savedDetail.header?.total_net_value) }}</strong>
        </div>
        <div v-if="savedDetail.header?.discount_word" class="detail-discount-word">
          <span>ส่วนลดท้ายบิล</span>
          <strong>{{ savedDetail.header.discount_word }}</strong>
        </div>
        <DataTable :value="savedDetail.details || []" size="small">
          <Column field="doc_ref" header="ใบวางบิล" />
          <Column field="billing_no" header="เอกสารต้นทาง" />
          <Column field="bill_type_name" header="ประเภท" />
          <Column field="sum_pay_money" header="รับชำระ">
            <template #body="{ data }">{{ formatCurrency(data.sum_pay_money) }}</template>
          </Column>
        </DataTable>
        <div v-if="savedPaymentSummaryRows.length" class="summary-box dialog-summary">
          <div v-for="row in savedPaymentSummaryRows" :key="row.label">
            <span>{{ row.label }}</span>
            <strong>{{ formatCurrency(row.amount) }}</strong>
          </div>
        </div>
        <DataTable v-if="savedPaymentDetailRows.length" :value="savedPaymentDetailRows" size="small">
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
        <DataTable v-if="savedDetail.vat_sale?.length" :value="savedDetail.vat_sale" size="small">
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

    <Dialog v-model:visible="customerDialogVisible" modal header="ค้นหาลูกหนี้" :style="{ width: 'min(760px, calc(100vw - 2rem))' }">
      <div class="customer-dialog">
        <div class="customer-dialog-search">
          <div class="customer-search-input">
            <InputText v-model="customerSearch" class="customer-search-text" autofocus placeholder="ค้นหารหัสหรือชื่อลูกหนี้" @input="handleCustomerInput" @keyup.enter="searchCustomers" />
            <Button v-if="customerSearch || customers.length" icon="pi pi-times" text rounded severity="secondary" class="input-clear-btn" aria-label="ล้างคำค้นหา" @click="clearCustomerSearch" />
          </div>
          <Button icon="pi pi-search" label="ค้นหา" class="action-btn action-search" :loading="customerLoading" @click="searchCustomers" />
        </div>
        <div v-if="customerLoading" class="dialog-state">กำลังค้นหา...</div>
        <div v-else-if="customerSearch.trim().length < 2" class="dialog-state">พิมพ์อย่างน้อย 2 ตัวอักษร</div>
        <div v-else-if="!customers.length" class="dialog-state">ไม่พบลูกหนี้</div>
        <div v-else class="customer-dialog-list">
          <button v-for="row in customers.slice(0, 30)" :key="row.code" type="button" @click="selectCustomer(row)">
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

    <Dialog v-model:visible="billingDialogVisible" modal :header="`เลือก${debtSourceLabel}`" :draggable="false" :style="{ width: 'min(920px, calc(100vw - 2rem))' }">
      <div class="billing-dialog">
        <div class="billing-dialog-summary">
          <div>
            <span>ลูกหนี้</span>
            <strong>{{ selectedCustomer ? `${selectedCustomer.code} - ${customerName(selectedCustomer)}` : "-" }}</strong>
          </div>
          <div>
            <span>ลงรายการแล้ว</span>
            <strong>{{ detailRows.length }} รายการ</strong>
          </div>
        </div>

        <div class="customer-dialog-search">
          <InputText v-model="billingSearch" :placeholder="`ค้นหาเลขที่${debtSourceLabel} / อ้างอิง`" autofocus @keyup.enter="loadOpenBillings" />
          <Button icon="pi pi-search" label="ค้นหา" class="action-btn action-search" :loading="openBillingsLoading" @click="loadOpenBillings" />
        </div>

        <DataTable
          :value="availableBillings"
          :loading="openBillingsLoading"
          size="small"
          scrollable
          scroll-height="420px"
          class="compact-table billing-dialog-table"
        >
          <template #empty>ไม่พบ{{ debtSourcePluralLabel }}</template>
          <Column field="doc_no" :header="debtSourceLabel" />
          <Column field="doc_date" header="วันที่">
            <template #body="{ data }">{{ formatDate(data.doc_date) }}</template>
          </Column>
          <Column v-if="isDirectDebtMode" field="bill_type_name" header="ประเภท" />
          <Column v-if="isDirectDebtMode" field="due_date" header="ครบกำหนด">
            <template #body="{ data }">{{ formatDate(data.due_date) }}</template>
          </Column>
          <Column field="balance_ref" header="คงเหลือ">
            <template #body="{ data }">{{ formatCurrency(data.balance_ref) }}</template>
          </Column>
          <Column header="">
            <template #body="{ data }">
              <Button icon="pi pi-plus" label="เพิ่ม" size="small" class="action-btn action-add" @click="addBilling(data)" />
            </template>
          </Column>
        </DataTable>
      </div>
      <template #footer>
        <Button label="ปิด" severity="secondary" outlined @click="billingDialogVisible = false" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="printDialogVisible"
      modal
      header="เลือกฟอร์มสำหรับพิมพ์"
      :draggable="false"
      :style="{ width: 'min(460px, 95vw)' }"
    >
      <div class="print-dialog-body">
        <div class="print-doc-no">{{ currentSavedDocNo() }}</div>
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
              :input-id="`ar-debt-print-form-${form.formcode}`"
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
.payment-page {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: var(--p-surface-0);
  color: var(--p-text-color);
}

.debt-step-page {
  height: 100%;
  overflow: hidden;
  padding: 0.2rem;
}

.stepper {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.25rem;
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

.step-work-grid {
  grid-template-columns: minmax(0, 1fr) minmax(320px, 420px);
}

.step-work-grid.payment-only {
  grid-template-columns: minmax(0, 1fr);
}

.step-work-grid.document-only {
  grid-template-columns: minmax(0, 1fr);
}

.document-only .editor-panel {
  max-width: 980px;
  width: 100%;
  margin: 0 auto;
}

.payment-only .payment-panel {
  max-width: 980px;
  margin: 0 auto;
  width: 100%;
}

.step-footer {
  display: flex;
  justify-content: flex-end;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  background: var(--p-surface-0);
}

.footer-actions,
.done-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.6rem;
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

.customer-picker {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.5rem;
  align-items: center;
}

.customer-picker-clearable {
  grid-template-columns: minmax(0, 1fr) auto auto;
}

.customer-dialog,
.customer-dialog-search {
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
  max-height: min(56vh, 520px);
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
  text-align: left;
  padding: 0.65rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  cursor: pointer;
}

.summary-step {
  min-height: 0;
  flex: 1;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 1rem;
  padding: 1rem;
}

.done-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border-radius: 8px;
  padding: 1rem 1.25rem;
  background: color-mix(in srgb, var(--p-primary-color) 10%, var(--p-surface-0));
  border: 1px solid var(--p-primary-color);
  min-width: min(480px, 100%);
}

.done-icon {
  font-size: 2rem;
  color: var(--p-primary-color);
}

.done-title {
  font-weight: 900;
  font-size: 1.2rem;
}

.done-docno {
  color: var(--p-text-color-secondary);
  margin-top: 0.1rem;
}

.proof-section {
  width: min(720px, 100%);
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

.proof-subtitle,
.print-form-row small {
  color: var(--p-text-color-secondary);
  font-size: 0.85rem;
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
  text-align: center;
  font-weight: 900;
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

.top-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  background: var(--p-surface-0);
  border-color: transparent;
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
.panel-head span {
  color: var(--p-text-color-secondary);
  font-size: 0.82rem;
}

.payment-total strong {
  color: var(--p-primary-color);
}

.top-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  flex: 0 0 auto;
}

.top-actions :deep(.p-button) {
  min-width: 7.5rem;
  white-space: nowrap;
}

.work-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(250px, 0.72fr) minmax(430px, 1.35fr) minmax(340px, 0.98fr);
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

.editor-panel,
.payment-panel {
  overflow: auto;
  padding: 0.875rem;
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

.history-filter,
.docs-filter {
  display: grid;
  gap: 0.5rem;
  border-top: 1px solid var(--p-surface-border);
  border-bottom: 1px solid var(--p-surface-border);
}

.docs-filter {
  grid-template-columns: minmax(0, 1fr) auto;
  padding-bottom: 0.75rem;
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

.doc-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.625rem;
}

label,
.remark-field {
  min-width: 0;
  display: grid;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: var(--p-text-color-secondary);
}

.bill-discount-field {
  margin-top: 0.875rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 0.75rem;
}

.bill-discount-field :deep(.p-inputtext) {
  width: 100%;
}

.bill-discount-preview {
  min-width: 10rem;
  min-height: 2.75rem;
  display: grid;
  align-content: center;
  gap: 0.15rem;
  padding: 0.45rem 0.75rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 6px;
  background: var(--p-surface-50);
}

.bill-discount-preview span {
  font-size: 0.72rem;
  color: var(--p-text-color-secondary);
}

.bill-discount-preview strong {
  color: #b91c1c;
  font-size: 0.95rem;
}

.bill-discount-preview .net-after-discount {
  color: var(--p-primary-color);
}

.doc-fields :deep(.p-select),
.doc-fields :deep(.p-inputtext),
.customer-picker :deep(.p-inputtext) {
  width: 100%;
  min-width: 0;
}

.customer-zone {
  margin-top: 0.875rem;
  padding-top: 0.875rem;
  border-top: 1px solid var(--p-surface-border);
}

.customer-search {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
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

.billing-summary-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--p-surface-border);
}

.billing-summary-head span {
  color: var(--p-text-color-secondary);
  font-size: 0.78rem;
}

.billing-summary-head h2 {
  margin: 0.1rem 0 0;
  letter-spacing: 0;
}

.billing-summary-head > strong {
  color: var(--p-primary-color);
  font-size: 1.45rem;
  white-space: nowrap;
}

.detail-table {
  margin-top: 0.625rem;
}

.selected-billing-table {
  margin-top: 0.75rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  overflow: hidden;
}

.remark-field {
  margin-top: 0.875rem;
}

.payment-panel {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.payment-total {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 1rem;
  padding-bottom: 0.875rem;
  border-bottom: 1px solid var(--p-surface-border);
}

.payment-total span {
  color: var(--p-text-color-secondary);
}

.payment-total strong {
  font-size: 1.35rem;
}

.payment-total small {
  grid-column: 1 / -1;
  color: var(--p-text-color-secondary);
  text-align: right;
}

.billing-picker-panel {
  gap: 0.65rem;
}

.billing-dialog-launch {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  background: var(--p-surface-50);
}

.billing-dialog-launch div {
  min-width: 0;
  display: grid;
  gap: 0.15rem;
}

.billing-launch-actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.45rem;
  min-width: 11rem;
}

.billing-launch-actions :deep(.p-button) {
  justify-content: center;
  width: 100%;
}

.billing-dialog-launch span,
.billing-dialog-summary span {
  color: var(--p-text-color-secondary);
  font-size: 0.78rem;
}

.billing-dialog-launch strong,
.billing-dialog-summary strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.billing-total {
  padding: 0.65rem 0.75rem;
  border: 1px solid color-mix(in srgb, var(--p-primary-color) 22%, var(--p-surface-border));
  border-radius: 8px;
  background: color-mix(in srgb, var(--p-primary-color) 8%, var(--p-surface-0));
}

.billing-dialog {
  display: grid;
  gap: 0.75rem;
}

.billing-dialog-summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.75rem;
  padding: 0.75rem;
  border: 1px solid color-mix(in srgb, var(--p-primary-color) 20%, var(--p-surface-border));
  border-radius: 8px;
  background: color-mix(in srgb, var(--p-primary-color) 7%, var(--p-surface-0));
}

.billing-dialog-summary > div {
  min-width: 0;
  display: grid;
  gap: 0.15rem;
}

.billing-dialog-table,
.selected-billing-table {
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  overflow: hidden;
}

.billing-dialog-table :deep(.p-datatable-tbody > tr > td),
.billing-dialog-table :deep(.p-datatable-thead > tr > th),
.selected-billing-table :deep(.p-datatable-tbody > tr > td),
.selected-billing-table :deep(.p-datatable-thead > tr > th) {
  white-space: nowrap;
}

.billing-dialog-table :deep(.p-datatable-tbody > tr > td:last-child),
.billing-dialog-table :deep(.p-datatable-thead > tr > th:last-child),
.selected-billing-table :deep(.p-datatable-tbody > tr > td:last-child),
.selected-billing-table :deep(.p-datatable-thead > tr > th:last-child) {
  width: 1%;
  text-align: right;
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

.adjust-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
}

.card-row {
  grid-template-columns: minmax(110px, 0.8fr) minmax(110px, 0.8fr) minmax(120px, 0.8fr) minmax(100px, 0.7fr) auto;
}

.cheque-row {
  grid-template-columns: minmax(120px, 0.9fr) minmax(130px, 0.9fr) minmax(120px, 0.8fr) auto;
}

.vat-row {
  grid-template-columns: minmax(120px, 0.8fr) minmax(130px, 1fr) minmax(120px, 0.9fr) minmax(88px, 0.6fr) minmax(120px, 0.9fr) auto;
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

.empty-state,
.dialog-state {
  min-height: 8rem;
  display: grid;
  place-items: center;
  color: var(--p-text-color-secondary);
}

.empty-state.small {
  min-height: 3rem;
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

.detail-discount-word {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 6px;
  background: var(--p-surface-50);
}

.detail-discount-word span {
  color: var(--p-text-color-secondary);
}

.detail-discount-word strong {
  color: var(--p-text-color);
}

@media (max-width: 1180px) {
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

  .top-actions {
    grid-column: auto;
  }

  .work-grid {
    grid-template-columns: minmax(220px, 0.72fr) minmax(340px, 1.28fr) minmax(280px, 0.95fr);
    overflow: hidden;
  }

  .history-panel {
    max-height: none;
  }

  .editor-panel,
  .payment-panel {
    padding: 0.75rem;
  }

  .adjust-row,
  .pay-row,
  .card-row,
  .cheque-row,
  .coupon-row,
  .deposit-row,
  .other-row,
  .vat-row {
    grid-template-columns: minmax(0, 1fr);
    align-items: stretch;
  }
}

@media (max-width: 760px) {
  .top-strip,
  .bill-discount-field,
  .doc-fields,
  .date-row,
  .docs-filter,
  .billing-dialog-launch,
  .billing-dialog-summary,
  .customer-search,
  .adjust-row,
  .pay-row,
  .card-row,
  .cheque-row,
  .coupon-row,
  .deposit-row,
  .other-row,
  .vat-row {
    grid-template-columns: 1fr;
  }

  .selected-customer {
    align-items: flex-start;
    flex-direction: column;
  }

  .bill-discount-preview {
    min-width: 0;
  }
}

.debt-step-page .step-work-grid {
  grid-template-columns: minmax(0, 1fr) minmax(320px, 420px);
  overflow: hidden;
}

.debt-step-page .step-work-grid.document-only {
  grid-template-columns: minmax(0, 1fr);
  overflow: visible;
}

.debt-step-page .step-work-grid.billing-only {
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  overflow: auto;
}

.debt-step-page .document-only .editor-panel {
  max-width: 980px;
  width: 100%;
  margin: 0 auto;
}

.debt-step-page .billing-only .billing-picker-panel,
.debt-step-page .billing-only .editor-panel {
  max-width: 980px;
  width: 100%;
  margin: 0 auto;
}

.debt-step-page .billing-only .billing-picker-panel {
  order: 1;
}

.debt-step-page .billing-only .editor-panel {
  order: 2;
}

.debt-step-page .step-work-grid.payment-only {
  grid-template-columns: minmax(0, 1fr);
}

.debt-step-page .payment-only .payment-panel {
  max-width: 980px;
  margin: 0 auto;
  width: 100%;
}

.payment-methods {
  display: grid;
  gap: 0.75rem;
}

.payment-meter {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;
}

.payment-meter > div {
  min-height: 4rem;
  display: grid;
  gap: 0.25rem;
  padding: 0.75rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  background: var(--p-surface-0);
}

.payment-meter span,
.pay-subtitle {
  color: var(--p-text-color-secondary);
  font-size: 0.84rem;
}

.payment-meter strong {
  font-size: 1.1rem;
}

.payment-entry-list {
  min-height: 7rem;
  border-radius: 8px;
  background: var(--p-surface-100);
  padding: 0.65rem;
}

.entries-empty {
  min-height: 5.5rem;
  display: grid;
  place-items: center;
  color: var(--p-text-color-secondary);
}

.entries-list {
  display: grid;
  gap: 0.45rem;
}

.entry-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 0.55rem;
  padding: 0.55rem;
  border-radius: 8px;
  background: var(--p-surface-0);
  border: 1px solid var(--p-surface-border);
}

.entry-icon {
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--p-primary-color);
  background: var(--p-primary-50);
}

.entry-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.entry-info small {
  color: var(--p-text-color-secondary);
}

.entry-amount {
  font-weight: 900;
  color: var(--p-primary-color);
  white-space: nowrap;
}

.type-tabs {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.35rem;
  border-radius: 8px;
  background: var(--p-surface-100);
  padding: 0.35rem;
}

.type-tab {
  min-height: 2.5rem;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--p-text-color);
  font: inherit;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
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
  gap: 0.4rem;
}

.denom-btn {
  min-height: 2.35rem;
  border: 0;
  border-radius: 8px;
  background: var(--p-surface-0);
  color: var(--p-text-color);
  font: inherit;
  font-weight: 900;
  cursor: pointer;
}

.denom-btn.exact {
  color: var(--p-primary-color);
}

.denom-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.credit-type-option,
.charge-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.charge-preview {
  min-height: 3rem;
  padding: 0.65rem 0.75rem;
  border-radius: 8px;
  background: var(--p-surface-100);
}

.charge-preview span {
  color: var(--p-text-color-secondary);
}

.charge-preview strong,
.deposit-balance {
  color: var(--p-primary-color);
}

.advance-payment-table {
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  overflow: hidden;
}

.advance-payment-table :deep(.p-datatable-tbody > tr > td),
.advance-payment-table :deep(.p-datatable-thead > tr > th) {
  white-space: nowrap;
}

.advance-payment-table :deep(.p-inputnumber),
.advance-payment-table :deep(.p-inputtext) {
  width: 100%;
}

.tiger-dialog-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.9rem;
}

.tiger-panel {
  min-height: 11rem;
  display: grid;
  place-items: center;
  padding: 1.25rem;
  border-radius: 8px;
  background: var(--p-surface-100);
}

.tiger-idle,
.tiger-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  text-align: center;
}

.tiger-pay-btn {
  min-width: 14rem;
  justify-content: center;
}

.tiger-amount-label {
  color: var(--p-text-color-secondary);
  font-size: 0.9rem;
}

.tiger-spinner,
.tiger-check,
.tiger-err-icon {
  font-size: 2rem;
}

.tiger-spinner,
.tiger-amount-value {
  color: var(--p-primary-color);
}

.tiger-check {
  color: #16a34a;
}

.tiger-err-icon {
  color: #dc2626;
}

.tiger-amount-value {
  font-size: 1.75rem;
}

.tiger-info-box {
  width: 100%;
  display: grid;
  gap: 0.45rem;
  padding: 0.75rem;
  border-radius: 8px;
  background: var(--p-surface-100);
}

.tiger-info-row {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
}

.tiger-info-label {
  color: var(--p-text-color-secondary);
}

.tiger-info-val {
  min-width: 0;
  font-weight: 900;
  text-align: right;
  word-break: break-word;
}

.tiger-mock-banner {
  width: 100%;
  padding: 0.55rem 0.75rem;
  border: 1px dashed #f59e0b;
  border-radius: 8px;
  background: #fffbeb;
  color: #b45309;
  text-align: center;
}

.deposit-state {
  min-height: 6rem;
  display: grid;
  place-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 1px dashed var(--p-surface-border);
  border-radius: 8px;
  color: var(--p-text-color-secondary);
  background: var(--p-surface-50);
}

.deposit-doc-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

.deposit-doc-card {
  min-height: 5rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  background: var(--p-surface-0);
  color: var(--p-text-color);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.15rem 0.75rem;
  padding: 0.65rem;
  text-align: left;
  cursor: pointer;
}

.deposit-doc-card:hover,
.deposit-doc-card.selected {
  border-color: var(--p-primary-color);
  background: var(--p-primary-50);
}

.deposit-doc-card small {
  color: var(--p-text-color-secondary);
}

.deposit-doc-card em {
  grid-column: 2;
  grid-row: 1 / span 2;
  font-style: normal;
  font-weight: 900;
  color: var(--p-primary-color);
  white-space: nowrap;
}

.deposit-doc-no {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 900;
  white-space: nowrap;
}

.deposit-add-box {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(120px, auto);
  gap: 0.55rem;
  padding: 0.75rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  background: var(--p-surface-50);
}

.deposit-add-box > div,
.deposit-add-box label {
  min-width: 0;
  display: grid;
  gap: 0.2rem;
}

.deposit-add-box span {
  color: var(--p-text-color-secondary);
  font-size: 0.84rem;
}

.deposit-add-box :deep(.p-inputnumber),
.deposit-add-box :deep(.p-inputtext) {
  width: 100%;
}

.deposit-add-box .action-btn {
  align-self: end;
}

@media (min-width: 960px) and (max-width: 1180px) {
  .debt-step-page .step-work-grid {
    grid-template-columns: minmax(0, 1fr) minmax(300px, 380px);
    overflow: hidden;
  }

  .debt-step-page .step-work-grid.document-only {
    grid-template-columns: minmax(0, 1fr);
    overflow: visible;
  }

  .debt-step-page .step-work-grid.billing-only {
    grid-template-columns: minmax(0, 1fr);
    overflow: auto;
  }

  .type-tabs {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .debt-step-page .step-work-grid {
    grid-template-columns: minmax(0, 1fr);
    overflow: visible;
  }

  .stepper {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .type-tabs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .payment-meter,
  .deposit-doc-list,
  .deposit-add-box {
    grid-template-columns: 1fr;
  }

  .entry-row {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .entry-row :deep(.p-button) {
    grid-column: 3;
  }

  .customer-dialog-search,
  .customer-dialog-list,
  .customer-picker {
    grid-template-columns: minmax(0, 1fr);
  }

  .customer-picker-clearable {
    grid-template-columns: minmax(0, 1fr) auto auto;
  }
}
</style>
