<script setup>
import { computed, onMounted, ref, watch } from "vue";
import Button from "primevue/button";
import Column from "primevue/column";
import DataTable from "primevue/datatable";
import Dialog from "primevue/dialog";
import InputNumber from "primevue/inputnumber";
import InputText from "primevue/inputtext";
import Message from "primevue/message";
import Select from "primevue/select";
import { useToast } from "primevue/usetoast";
import { getCustomerList, getPassBookList } from "@/services/sellService";
import {
  createSalesReturnDoc,
  getNextSalesReturnDocNo,
  getReturnableSaleItems,
  getSalesReturnDetail,
  getSalesReturnDocFormatList,
  getSalesReturnPrintForms,
  getSalesReturnPrintUrl,
  getSalesReturnReadiness,
} from "@/services/salesReturnService";
import { useAuthStore } from "@/stores/auth";
import { formatCurrency, formatDate, formatNumber, todayISO } from "@/utils/formatters";
import { PERMISSIONS } from "@/utils/permissions";

const authStore = useAuthStore();
const toast = useToast();
const customerSearch = ref("");
const customers = ref([]);
const customerLoading = ref(false);
const selectedCustomer = ref(null);
const productInput = ref("");
const docSearchInput = ref("");
const docSearchDialogVisible = ref(false);
const docSearchLoading = ref(false);
const docSearchError = ref("");
const returnableRows = ref([]);
const returnableLoading = ref(false);
const selectedRows = ref([]);
const errorMsg = ref("");
const readiness = ref(null);
const docFormats = ref([]);
const selectedDocFormat = ref(null);
const nextDoc = ref(null);
const docDate = ref(todayISO());
const saving = ref(false);
const savedDocNo = ref("");
const savedDocDetail = ref(null);
const savedDocLoading = ref(false);
const savedDocDialogVisible = ref(false);
const confirmSaveDialogVisible = ref(false);
const printLoading = ref(false);
const printError = ref("");
const passBooks = ref([]);
const passBooksLoading = ref(false);
const cashReturnAmount = ref(0);
const couponReturnAmount = ref(0);
const transferReturnAmount = ref(0);
const selectedTransferPassBook = ref(null);
const transferDate = ref(todayISO());
const activeRefundTab = ref("cash");
let customerTimer = null;

const docSearchDialogWidth = "min(980px, calc(100vw - 2rem))";
const docSearchDialogHeight = "min(720px, calc(100dvh - 2rem))";
const docSearchDialogStyle = {
  width: docSearchDialogWidth,
  minWidth: docSearchDialogWidth,
  maxWidth: docSearchDialogWidth,
  height: docSearchDialogHeight,
  minHeight: docSearchDialogHeight,
  maxHeight: docSearchDialogHeight,
  display: "flex",
  flexDirection: "column",
};
const docSearchDialogContentStyle = {
  flex: "1 1 auto",
  minHeight: "0",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};
const savedDocDialogWidth = "min(620px, calc(100vw - 2rem))";
const savedDocDialogStyle = {
  width: savedDocDialogWidth,
  minWidth: savedDocDialogWidth,
  maxWidth: savedDocDialogWidth,
};
const confirmSaveDialogStyle = {
  width: savedDocDialogWidth,
  minWidth: savedDocDialogWidth,
  maxWidth: savedDocDialogWidth,
};

function notifyToast(severity, summary, detail, life = 4200) {
  if (!detail) return;
  toast.add({ severity, summary, detail, life });
}

const docFormatOptions = computed(() =>
  docFormats.value.map((row) => ({
    ...row,
    label: `${row.code} - ${row.name_1 || ""}`,
  })),
);

const selectedSaleKind = computed(() => selectedRows.value[0]?.sale_kind || "");
const selectedSaleKindLabel = computed(() => {
  if (selectedSaleKind.value === "credit") return "ลดหนี้ขายเชื่อ";
  if (selectedSaleKind.value === "cash") return "คืนเงินขายสด";
  return "ยังไม่เลือกรายการ";
});

const canSearchItems = computed(() => !!selectedCustomer.value?.code && productInput.value.trim().length > 0 && !returnableLoading.value);
const canSearchDocNo = computed(() => !!selectedCustomer.value?.code && docSearchInput.value.trim().length > 0 && !docSearchLoading.value);
const filteredReturnableRows = computed(() => {
  const text = docSearchInput.value.trim().toLowerCase();
  if (!text) return returnableRows.value;
  return returnableRows.value.filter((row) =>
    String(row.sale_doc_no || "")
      .toLowerCase()
      .includes(text),
  );
});

const canGoNext = computed(() => selectedRows.value.length > 0 && !validationErrors.value.length && !saving.value);
const isCashReturn = computed(() => selectedSaleKind.value === "cash");
const paymentTotal = computed(() => rnd(toNumber(cashReturnAmount.value) + toNumber(couponReturnAmount.value) + toNumber(transferReturnAmount.value)));
const paymentRemaining = computed(() => rnd(totals.value.total_amount - paymentTotal.value));
const passBookOptions = computed(() =>
  passBooks.value.map((row) => ({
    ...row,
    label: `${row.code || ""} ${row.bank_name || row.bank_code || ""}${row.book_name ? ` - ${row.book_name}` : ""}`.trim(),
  })),
);
const canPrintSalesReturn = computed(() => authStore.hasPermission(PERMISSIONS.salesReturnPrint));
const nextButtonLabel = computed(() => {
  if (saving.value) return "กำลังบันทึก";
  if (selectedSaleKind.value) return "ยืนยันบันทึก";
  return "ถัดไป";
});

const validationErrors = computed(() => {
  const errors = [];
  if (!selectedCustomer.value?.code) errors.push("กรุณาเลือกลูกค้า");
  if (!selectedRows.value.length) errors.push("กรุณาเลือกรายการรับคืน");
  const kinds = new Set(selectedRows.value.map((row) => row.sale_kind));
  if (kinds.size > 1) errors.push("ไม่สามารถคืนบิลขายสดและขายเชื่อในเอกสารเดียวกัน");
  if (isCashReturn.value) {
    if (toNumber(cashReturnAmount.value) < 0 || toNumber(couponReturnAmount.value) < 0 || toNumber(transferReturnAmount.value) < 0) {
      errors.push("ยอดคืนเงินต้องไม่ติดลบ");
    }
    if (toNumber(transferReturnAmount.value) > 0 && !selectedTransferPassBook.value?.code) {
      errors.push("กรุณาเลือกบัญชีสำหรับคืนเงินแบบโอน");
    }
    if (Math.abs(paymentTotal.value - totals.value.total_amount) > 0.01) {
      errors.push("ยอดเงินคืนต้องเท่ากับยอดสุทธิ");
    }
  }
  for (const [index, row] of selectedRows.value.entries()) {
    const qty = toNumber(row.return_qty);
    const maxQty = toNumber(row.returnable_qty);
    if (qty <= 0) errors.push(`แถวที่ ${index + 1}: จำนวนคืนต้องมากกว่า 0`);
    if (qty > maxQty) errors.push(`แถวที่ ${index + 1}: จำนวนคืนเกินจำนวนที่คืนได้`);
    if (!row.sale_doc_no || row.sale_line_number == null) errors.push(`แถวที่ ${index + 1}: ขาดเอกสารอ้างอิง`);
  }
  return errors;
});

const totals = computed(() => {
  const result = {
    total_value: 0,
    total_before_vat: 0,
    total_vat_value: 0,
    total_after_vat: 0,
    total_except_vat: 0,
    total_amount: 0,
  };
  for (const row of selectedRows.value) {
    const line = calcReturnLine(row);
    result.total_value += line.sum_amount;
    result.total_before_vat += line.before_vat;
    result.total_vat_value += line.vat_value;
    result.total_after_vat += line.after_vat;
    result.total_except_vat += line.except_vat;
    result.total_amount += line.total_amount;
  }
  for (const key of Object.keys(result)) result[key] = rnd(result[key]);
  return result;
});

const paymentPreview = computed(() => {
  if (selectedSaleKind.value === "credit") return "บันทึกเป็นเอกสารลดหนี้ลูกหนี้";
  if (selectedSaleKind.value === "cash") return "คืนเงินด้วยเงินสด / คูปอง / โอน";
  return "เลือกรายการเพื่อกำหนดรูปแบบการคืน";
});

const refundMethodTabs = computed(() => [
  { key: "cash", label: "เงินสด", icon: "pi pi-money-bill", amount: toNumber(cashReturnAmount.value) },
  // { key: "coupon", label: "คูปอง", icon: "pi pi-ticket", amount: toNumber(couponReturnAmount.value) },
  { key: "transfer", label: "โอน", icon: "pi pi-send", amount: toNumber(transferReturnAmount.value) },
]);

const savedPaymentRows = computed(() => {
  if (!savedDocDetail.value) return [];
  const rows = [];
  if (toNumber(savedDocDetail.value.cash_amount) > 0) {
    rows.push({ label: "เงินสด", amount: toNumber(savedDocDetail.value.cash_amount) });
  }
  if (toNumber(savedDocDetail.value.coupon_amount) > 0) {
    rows.push({ label: "คูปอง", amount: toNumber(savedDocDetail.value.coupon_amount) });
  }
  if (toNumber(savedDocDetail.value.tranfer_amount) > 0) {
    rows.push({ label: "โอน", amount: toNumber(savedDocDetail.value.tranfer_amount) });
  }
  return rows;
});

const confirmPaymentRows = computed(() => {
  if (!isCashReturn.value) return [];
  return refundMethodTabs.value.filter((tab) => tab.amount > 0);
});

const confirmSaleDocNo = computed(() => {
  const docs = [...new Set(selectedRows.value.map((row) => row.sale_doc_no).filter(Boolean))];
  return docs.join(", ") || "-";
});

watch(customerSearch, (value) => {
  clearTimeout(customerTimer);
  const text = value.trim();
  if (!text) {
    customers.value = [];
    return;
  }
  customerTimer = setTimeout(() => searchCustomers(text), 250);
});

watch(errorMsg, (message) => {
  if (!message) return;
  notifyToast("warn", "แจ้งเตือน", message);
  errorMsg.value = "";
});

watch(docSearchError, (message) => {
  if (!message) return;
  notifyToast("warn", "ค้นหาเอกสาร", message);
  docSearchError.value = "";
});

watch(printError, (message) => {
  if (!message) return;
  notifyToast("warn", "พิมพ์เอกสาร", message, 5200);
  printError.value = "";
});

watch(selectedDocFormat, async (value) => {
  await loadNextDoc(value?.code || "");
});

watch(selectedSaleKind, async (value, oldValue) => {
  if (value !== oldValue) resetPaymentInputs();
  if (value === "cash" && !passBooks.value.length) await loadPassBooks();
});

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function rnd(value, point = 2) {
  const factor = 10 ** point;
  return Math.round(toNumber(value) * factor) / factor;
}

function rowKey(row) {
  return `${row.sale_doc_no}::${row.sale_line_number}::${row.item_code}::${row.unit_code}`;
}

function saleKindText(row) {
  if (row.sale_kind === "credit") return "ขายเชื่อ";
  if (row.sale_kind === "cash") return "ขายสด";
  return "-";
}

function calcReturnLine(row) {
  const qty = toNumber(row.return_qty);
  const unitPrice = toNumber(row.return_unit_price, toNumber(row.price));
  const sumAmount = rnd(qty * unitPrice);
  const vatType = Number(row.sale_vat_type ?? 1);
  const vatRate = toNumber(row.vat_rate, 7);
  const taxType = Number(row.tax_type ?? 0);
  if (taxType === 1 || vatType === 2 || vatType === 3) {
    return {
      sum_amount: sumAmount,
      before_vat: sumAmount,
      vat_value: 0,
      after_vat: sumAmount,
      except_vat: sumAmount,
      total_amount: sumAmount,
      price_exclude_vat: unitPrice,
    };
  }
  if (vatType === 1) {
    const beforeVat = rnd((sumAmount * 100) / (100 + vatRate));
    const vatValue = rnd(sumAmount - beforeVat);
    return {
      sum_amount: sumAmount,
      before_vat: beforeVat,
      vat_value: vatValue,
      after_vat: sumAmount,
      except_vat: 0,
      total_amount: sumAmount,
      price_exclude_vat: rnd((unitPrice * 100) / (100 + vatRate)),
    };
  }
  const vatValue = rnd(sumAmount * (vatRate / 100));
  return {
    sum_amount: sumAmount,
    before_vat: sumAmount,
    vat_value: vatValue,
    after_vat: rnd(sumAmount + vatValue),
    except_vat: 0,
    total_amount: rnd(sumAmount + vatValue),
    price_exclude_vat: unitPrice,
  };
}

async function searchCustomers(text) {
  customerLoading.value = true;
  try {
    customers.value = await getCustomerList(text);
  } catch (ex) {
    customers.value = [];
    errorMsg.value = ex.message || "ค้นหาลูกค้าไม่สำเร็จ";
  } finally {
    customerLoading.value = false;
  }
}

function selectCustomer(customer) {
  selectedCustomer.value = {
    code: customer.code,
    name: customer.name || customer.name_1 || customer.code,
  };
  customerSearch.value = "";
  customers.value = [];
  returnableRows.value = [];
  docSearchInput.value = "";
  docSearchError.value = "";
  selectedRows.value = [];
  errorMsg.value = "";
}

function clearSelectedCustomer() {
  selectedCustomer.value = null;
  customerSearch.value = "";
  customers.value = [];
  productInput.value = "";
  returnableRows.value = [];
  selectedRows.value = [];
  docSearchInput.value = "";
  docSearchError.value = "";
  docSearchDialogVisible.value = false;
  errorMsg.value = "";
  confirmSaveDialogVisible.value = false;
  resetPaymentInputs();
}

async function searchReturnableItems() {
  if (!canSearchItems.value) return;
  returnableLoading.value = true;
  errorMsg.value = "";
  try {
    const text = productInput.value.trim();
    let rows = await getReturnableSaleItems({
      cust_code: selectedCustomer.value.code,
      barcode: text,
      limit: 120,
    });
    if (!rows.length) {
      rows = await getReturnableSaleItems({
        cust_code: selectedCustomer.value.code,
        search: text,
        limit: 120,
      });
    }
    returnableRows.value = rows;
    docSearchInput.value = "";
    if (!returnableRows.value.length) {
      errorMsg.value = "ไม่พบรายการขายที่ยังคืนได้สำหรับลูกค้าและสินค้านี้";
    } else {
      docSearchDialogVisible.value = true;
    }
  } catch (ex) {
    errorMsg.value = ex.message || "ค้นหารายการรับคืนไม่สำเร็จ";
    returnableRows.value = [];
  } finally {
    returnableLoading.value = false;
  }
}

function openDocSearchDialog() {
  if (!selectedCustomer.value?.code) {
    errorMsg.value = "กรุณาเลือกลูกค้าก่อนค้นหาเอกสารขาย";
    return;
  }
  docSearchDialogVisible.value = true;
  docSearchError.value = "";
}

async function searchReturnableByDocNo() {
  if (!canSearchDocNo.value) return;
  docSearchLoading.value = true;
  docSearchError.value = "";
  try {
    const rows = await getReturnableSaleItems({
      cust_code: selectedCustomer.value.code,
      search: docSearchInput.value.trim(),
      limit: 120,
    });
    returnableRows.value = rows;
    if (!returnableRows.value.length) {
      docSearchError.value = "ไม่พบเอกสารขายที่ยังคืนได้ตามเลขที่เอกสารนี้";
    }
  } catch (ex) {
    docSearchError.value = ex.message || "ค้นหาเอกสารที่รับคืนได้ไม่สำเร็จ";
    returnableRows.value = [];
  } finally {
    docSearchLoading.value = false;
  }
}

function clearDocSearchSelection() {
  docSearchInput.value = "";
}

function addReturnRow(row) {
  const key = rowKey(row);
  if (selectedRows.value.some((item) => item.key === key)) return;
  if (selectedSaleKind.value && selectedSaleKind.value !== row.sale_kind) {
    errorMsg.value = "ไม่สามารถเลือกขายสดและขายเชื่อปนกันในเอกสารเดียว";
    return;
  }
  if (selectedRows.value.length && selectedRows.value[0]?.sale_doc_no !== row.sale_doc_no) {
    errorMsg.value = "เอกสารรับคืนหนึ่งใบต้องอ้างอิงบิลขายเดียวกัน";
    return;
  }
  selectedRows.value.push({
    ...row,
    key,
    return_qty: Math.min(1, toNumber(row.returnable_qty)),
  });
  docSearchDialogVisible.value = false;
  errorMsg.value = "";
}

function removeReturnRow(key) {
  selectedRows.value = selectedRows.value.filter((row) => row.key !== key);
}

function clampQty(row) {
  const maxQty = toNumber(row.returnable_qty);
  if (toNumber(row.return_qty) > maxQty) row.return_qty = maxQty;
  if (toNumber(row.return_qty) < 0) row.return_qty = 0;
}

async function loadPassBooks() {
  passBooksLoading.value = true;
  try {
    passBooks.value = await getPassBookList();
  } catch {
    passBooks.value = [];
  } finally {
    passBooksLoading.value = false;
  }
}

async function loadSavedReturnDetail(docNo = savedDocNo.value) {
  if (!docNo || savedDocLoading.value) return;
  savedDocLoading.value = true;
  printError.value = "";
  try {
    savedDocDetail.value = await getSalesReturnDetail(docNo);
  } catch (ex) {
    printError.value = ex.message || "โหลดรายละเอียดเอกสารรับคืนไม่สำเร็จ";
  } finally {
    savedDocLoading.value = false;
  }
}

async function openSavedReturnPrint() {
  if (!savedDocNo.value || printLoading.value || !canPrintSalesReturn.value) return;
  printLoading.value = true;
  printError.value = "";
  try {
    const result = await getSalesReturnPrintForms(savedDocNo.value);
    const forms = result?.forms || [];
    let selectedForms = forms.filter((form) => form.available && form.is_default).map((form) => form.formcode);
    if (!selectedForms.length) {
      selectedForms = forms
        .filter((form) => form.available)
        .slice(0, 1)
        .map((form) => form.formcode);
    }
    if (!forms.length) {
      printError.value = "เอกสารนี้ยังไม่ได้กำหนด form_code สำหรับพิมพ์";
      return;
    }
    if (!selectedForms.length) {
      printError.value = "ไม่พบฟอร์มที่พร้อมใช้งานใน formdesign";
      return;
    }
    const url = getSalesReturnPrintUrl(savedDocNo.value, selectedForms, authStore.employee?.user_code || "");
    window.open(url, "_blank", "noopener");
  } catch (ex) {
    printError.value = ex.message || "เปิดพิมพ์เอกสารรับคืนไม่สำเร็จ";
  } finally {
    printLoading.value = false;
  }
}

function resetPaymentInputs() {
  cashReturnAmount.value = 0;
  couponReturnAmount.value = 0;
  transferReturnAmount.value = 0;
  selectedTransferPassBook.value = null;
  transferDate.value = docDate.value || todayISO();
  activeRefundTab.value = "cash";
}

function setActiveRefundTab(tab) {
  activeRefundTab.value = tab;
  if (tab === "transfer" && !passBooks.value.length && !passBooksLoading.value) {
    loadPassBooks();
  }
}

function fillPaymentAmount(type) {
  const current = type === "cash" ? toNumber(cashReturnAmount.value) : type === "coupon" ? toNumber(couponReturnAmount.value) : toNumber(transferReturnAmount.value);
  const amount = Math.max(0, rnd(totals.value.total_amount - paymentTotal.value + current));
  if (type === "cash") cashReturnAmount.value = amount;
  if (type === "coupon") couponReturnAmount.value = amount;
  if (type === "transfer") transferReturnAmount.value = amount;
}

function buildPaymentDetail() {
  if (!isCashReturn.value) return [];
  const detail = [];
  const transferAmount = toNumber(transferReturnAmount.value);
  if (transferAmount > 0 && selectedTransferPassBook.value) {
    detail.push({
      pay_type: "0",
      doc_type: "1",
      pay_amount: transferAmount,
      amount: transferAmount,
      trans_number: selectedTransferPassBook.value.code || "",
      pass_book_code: selectedTransferPassBook.value.code || "",
      bank_code: selectedTransferPassBook.value.bank_code || "",
      bank_branch: selectedTransferPassBook.value.bank_branch || "",
      transfer_date: transferDate.value || docDate.value,
    });
  }
  const couponAmount = toNumber(couponReturnAmount.value);
  if (couponAmount > 0) {
    detail.push({
      pay_type: "9",
      doc_type: "9",
      pay_amount: couponAmount,
      amount: couponAmount,
      trans_number: "",
      ref1: "Coupon from CN",
    });
  }
  return detail;
}

function buildPreviewPayload() {
  return {
    doc_date: docDate.value,
    doc_time: new Date().toTimeString().slice(0, 5),
    doc_format_code: selectedDocFormat.value?.code || "",
    cust_code: selectedCustomer.value?.code || "",
    creator_code: authStore.employee?.user_code || "",
    emp_code: authStore.employee?.user_code || "",
    sale_code: authStore.employee?.user_code || "",
    inquiry_type: selectedSaleKind.value === "credit" ? 0 : 1,
    vat_type: selectedRows.value[0]?.sale_vat_type ?? 1,
    vat_rate: selectedRows.value[0]?.vat_rate ?? 7,
    cash_amount: isCashReturn.value ? toNumber(cashReturnAmount.value) : 0,
    coupon_amount: isCashReturn.value ? toNumber(couponReturnAmount.value) : 0,
    tranfer_amount: isCashReturn.value ? toNumber(transferReturnAmount.value) : 0,
    payment_detail: buildPaymentDetail(),
    ...totals.value,
    items: selectedRows.value.map((row, index) => {
      const line = calcReturnLine(row);
      return {
        line_number: index,
        item_code: row.item_code,
        item_name: row.item_name,
        unit_code: row.unit_code,
        barcode: row.barcode || "",
        qty: toNumber(row.return_qty),
        price: toNumber(row.return_unit_price, row.price),
        sum_amount: line.sum_amount,
        tax_type: Number(row.tax_type ?? 0),
        sum_amount_exclude_vat: line.before_vat,
        total_vat_value: line.vat_value,
        price_exclude_vat: line.price_exclude_vat,
        wh_code: row.wh_code || "",
        shelf_code: row.shelf_code || "",
        stand_value: toNumber(row.stand_value, 1),
        divide_value: toNumber(row.divide_value, 1),
        discount: row.discount || "",
        discount_amount: toNumber(row.discount_amount),
        ref_doc_no: row.sale_doc_no,
        ref_doc_date: row.sale_doc_date,
        ref_row: row.sale_line_number,
        doc_ref_type: 1,
      };
    }),
  };
}

async function previewNext() {
  if (!canGoNext.value) return;
  confirmSaveDialogVisible.value = false;
  saving.value = true;
  errorMsg.value = "";
  savedDocDialogVisible.value = false;
  savedDocNo.value = "";
  savedDocDetail.value = null;
  printError.value = "";
  try {
    const result = await createSalesReturnDoc(buildPreviewPayload());
    if (!result.success) {
      errorMsg.value = result.msg || "บันทึกเอกสารไม่สำเร็จ";
      return;
    }
    savedDocNo.value = result.doc_no;
    await loadSavedReturnDetail(result.doc_no);
    savedDocDialogVisible.value = true;
    clearSelectedCustomer();
    await loadNextDoc(selectedDocFormat.value?.code || "");
  } catch (ex) {
    errorMsg.value = ex.message || "บันทึกเอกสารไม่สำเร็จ";
  } finally {
    saving.value = false;
  }
}

function openSaveConfirm() {
  if (!canGoNext.value) return;
  confirmSaveDialogVisible.value = true;
}

async function loadNextDoc(docFormatCode = "") {
  try {
    nextDoc.value = await getNextSalesReturnDocNo({
      doc_format_code: docFormatCode,
      doc_date: docDate.value,
    });
  } catch {
    nextDoc.value = null;
  }
}

onMounted(async () => {
  try {
    const [ready, formats] = await Promise.all([getSalesReturnReadiness(), getSalesReturnDocFormatList()]);
    readiness.value = ready;
    docFormats.value = formats;
    selectedDocFormat.value = docFormatOptions.value[0] || null;
    await loadNextDoc(selectedDocFormat.value?.code || "");
  } catch (ex) {
    errorMsg.value = ex.message || "โหลดข้อมูลตั้งต้นไม่สำเร็จ";
  }
});
</script>

<template>
  <div class="return-page">
    <header class="return-header">
      <div>
        <h1>รับคืนสินค้า/ลดหนี้</h1>
      </div>
      <div class="doc-strip">
        <Select v-model="selectedDocFormat" :options="docFormatOptions" option-label="label" placeholder="รูปแบบเอกสาร" class="doc-format" />
        <div class="next-doc">
          <span>เลขที่ถัดไป</span>
          <strong>{{ nextDoc?.doc_no || "-" }}</strong>
        </div>
      </div>
    </header>

    <Message v-if="readiness && !readiness.has_st_doc_format" severity="error" :closable="false"> ยังไม่พบรูปแบบเอกสาร ST ใน erp_doc_format </Message>

    <main class="return-workspace">
      <section class="workflow-column">
        <section class="lookup-panel">
          <div class="panel-head">
            <i class="pi pi-user" />
            <span>ลูกค้า</span>
          </div>
          <InputText v-model="customerSearch" class="full-input" placeholder="ค้นหารหัสหรือชื่อลูกค้า" />
          <div v-if="customers.length || customerLoading" class="customer-results">
            <button v-for="customer in customers" :key="customer.code" class="customer-result" @click="selectCustomer(customer)">
              <strong>{{ customer.name || customer.name_1 || customer.code }}</strong>
              <span>{{ customer.code }}</span>
            </button>
            <div v-if="customerLoading" class="muted-row">กำลังค้นหา...</div>
          </div>
          <div v-if="selectedCustomer" class="selected-customer">
            <div class="selected-customer-main">
              <strong>{{ selectedCustomer.name }}</strong>
              <span>{{ selectedCustomer.code }}</span>
            </div>
            <Button icon="pi pi-times" text rounded severity="secondary" size="small" @click="clearSelectedCustomer" aria-label="ล้างลูกค้าที่เลือก" />
          </div>

          <div class="panel-head product-head">
            <i class="pi pi-barcode" />
            <span>สินค้า</span>
          </div>
          <div class="scan-row">
            <InputText v-model="productInput" class="full-input" placeholder="สแกนบาร์โค้ด / ค้นหาสินค้า" @keyup.enter="searchReturnableItems" />
            <Button icon="pi pi-search" :loading="returnableLoading" :disabled="!canSearchItems" @click="searchReturnableItems" aria-label="ค้นหา" />
          </div>
        </section>

        <section class="return-items-panel">
          <div class="panel-head">
            <i class="pi pi-list" />
            <span>รายการรับคืน</span>
            <small v-if="selectedRows.length">{{ selectedRows.length }} รายการ</small>
          </div>
          <div v-if="!selectedRows.length" class="empty-state return-empty">เลือกรายการจากเอกสารขายที่ยังคืนได้</div>
          <div v-else class="return-list">
            <div v-for="row in selectedRows" :key="row.key" class="return-row">
              <div class="return-row-main">
                <strong>{{ row.item_name || row.item_code }}</strong>
                <span>{{ row.sale_doc_no }}</span>
                <span><strong style="color:red">คืนได้ {{ formatNumber(row.returnable_qty) }} {{ row.unit_code }}</strong> </span>
              </div>
              <div class="return-row-controls">
                <InputNumber v-model="row.return_qty" :min="0" :max="Number(row.returnable_qty)" :max-fraction-digits="2" input-class="qty-input" @blur="clampQty(row)" />
                <div class="line-amount">{{ formatCurrency(calcReturnLine(row).total_amount) }}</div>
                <Button icon="pi pi-trash" text rounded severity="danger" size="small" @click="removeReturnRow(row.key)" aria-label="ลบ" />
              </div>
            </div>
          </div>
        </section>
      </section>

      <aside class="summary-panel">
        <div class="summary-sticky">
          <div class="panel-head summary-head">
            <i class="pi pi-wallet" />
            <span>สรุปและยืนยัน</span>
          </div>

          <div class="totals-box">
            <div>
              <span>มูลค่าสินค้า</span><strong>{{ formatCurrency(totals.total_value) }}</strong>
            </div>
            <div>
              <span>ก่อน VAT</span><strong>{{ formatCurrency(totals.total_before_vat) }}</strong>
            </div>
            <div>
              <span>VAT</span><strong>{{ formatCurrency(totals.total_vat_value) }}</strong>
            </div>
            <div class="grand-total">
              <span>สุทธิ</span><strong>{{ formatCurrency(totals.total_amount) }}</strong>
            </div>
          </div>

          <div v-if="isCashReturn" class="payment-box">
            <div class="payment-head">
              <span>รูปแบบการคืนเงิน</span>
              <strong>{{ formatCurrency(paymentTotal) }}</strong>
            </div>

            <div class="payment-tabs" role="tablist" aria-label="รูปแบบการคืนเงิน">
              <button
                v-for="tab in refundMethodTabs"
                :key="tab.key"
                type="button"
                class="payment-tab"
                :class="{ active: activeRefundTab === tab.key }"
                @click="setActiveRefundTab(tab.key)"
              >
                <i :class="tab.icon" />
                <span>{{ tab.label }}</span>
                <small>{{ formatCurrency(tab.amount) }}</small>
              </button>
            </div>

            <div class="payment-tab-panel">
              <template v-if="activeRefundTab === 'cash'">
                <div class="payment-row">
                  <label>คืนเป็นเงินสด</label>
                  <div class="payment-input-line">
                    <InputNumber v-model="cashReturnAmount" :min="0" :max-fraction-digits="2" input-class="money-input" />
                    <Button label="เติมให้พอดี" size="small" outlined class="fill-amount-btn" @click="fillPaymentAmount('cash')" aria-label="เติมยอดเงินสด" />
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="payment-row">
                  <label>บัญชีรับโอน</label>
                  <Select v-model="selectedTransferPassBook" :options="passBookOptions" option-label="label" placeholder="เลือกบัญชีรับโอน" :loading="passBooksLoading" class="full-input" />
                </div>
                <div class="payment-row">
                  <label>วันที่โอน</label>
                  <InputText v-model="transferDate" type="date" class="full-input" />
                </div>
                <div class="payment-row">
                  <label>ยอดคืนแบบโอน</label>
                  <div class="payment-input-line">
                    <InputNumber v-model="transferReturnAmount" :min="0" :max-fraction-digits="2" input-class="money-input" />
                    <Button label="เติมให้พอดี" size="small" outlined class="fill-amount-btn" @click="fillPaymentAmount('transfer')" aria-label="เติมยอดโอน" />
                  </div>
                </div>
              </template>
            </div>

            <div class="payment-snapshot">
              <div v-for="tab in refundMethodTabs" :key="`snapshot-${tab.key}`" class="payment-snapshot-item" :class="{ active: tab.amount > 0 }">
                <span>{{ tab.label }}</span>
                <strong>{{ formatCurrency(tab.amount) }}</strong>
              </div>
            </div>

            <div class="payment-balance" :class="{ over: paymentRemaining < 0, done: Math.abs(paymentRemaining) <= 0.01 }">
              <span>{{ paymentRemaining < 0 ? "เกิน" : "คงเหลือ" }}</span>
              <strong>{{ formatCurrency(Math.abs(paymentRemaining)) }}</strong>
            </div>
          </div>

          <div v-else-if="selectedSaleKind === 'credit'" class="credit-note-box">
            <span>รูปแบบการคืน</span>
            <strong>ลดหนี้ลูกหนี้</strong>
          </div>
          <div v-else class="credit-note-box pending">
            <span>รูปแบบการคืน</span>
            <strong>เลือกรายการรับคืนก่อน</strong>
          </div>

          <Message v-if="validationErrors.length" severity="warn" :closable="false">
            {{ validationErrors[0] }}
          </Message>

          <Button :label="nextButtonLabel" icon="pi pi-arrow-right" icon-pos="right" class="next-btn" :disabled="!canGoNext" :loading="saving" @click="openSaveConfirm" />
        </div>
      </aside>
    </main>

    <Dialog
      :visible="confirmSaveDialogVisible"
      @update:visible="confirmSaveDialogVisible = $event"
      modal
      header="ยืนยันการบันทึกรับคืน"
      :draggable="false"
      class="confirm-save-dialog"
      :style="confirmSaveDialogStyle"
    >
      <div class="confirm-save-body">
        <p class="confirm-save-intro">ตรวจสอบข้อมูลก่อนบันทึกเอกสารรับคืน</p>

        <div class="confirm-save-grid">
          <div class="confirm-save-stat">
            <span>ลูกค้า</span>
            <strong>{{ selectedCustomer?.name || '-' }}</strong>
            <small>{{ selectedCustomer?.code || '-' }}</small>
          </div>
          <div class="confirm-save-stat">
            <span>ประเภทเอกสาร</span>
            <strong>{{ selectedSaleKindLabel }}</strong>
            <small>{{ selectedDocFormat?.label || '-' }}</small>
          </div>
          <div class="confirm-save-stat wide">
            <span>อ้างอิงบิลขาย</span>
            <strong>{{ confirmSaleDocNo }}</strong>
          </div>
          <div class="confirm-save-stat">
            <span>จำนวนรายการ</span>
            <strong>{{ selectedRows.length }} รายการ</strong>
          </div>
          <div class="confirm-save-stat amount">
            <span>ยอดสุทธิ</span>
            <strong>{{ formatCurrency(totals.total_amount) }}</strong>
          </div>
        </div>

        <div v-if="confirmPaymentRows.length" class="confirm-save-payments">
          <div v-for="row in confirmPaymentRows" :key="row.key">
            <span>{{ row.label }}</span>
            <strong>{{ formatCurrency(row.amount) }}</strong>
          </div>
        </div>

        <Message v-if="validationErrors.length" severity="warn" :closable="false">
          {{ validationErrors[0] }}
        </Message>
      </div>

      <template #footer>
        <div class="confirm-save-actions">
          <Button label="กลับไปแก้ไข" severity="secondary" text @click="confirmSaveDialogVisible = false" />
          <Button label="ยืนยันบันทึก" icon="pi pi-check" :loading="saving" @click="previewNext" />
        </div>
      </template>
    </Dialog>

    <Dialog
      :visible="savedDocDialogVisible"
      @update:visible="savedDocDialogVisible = $event"
      modal
      header="บันทึกรับคืนสำเร็จ"
      :draggable="false"
      class="saved-doc-dialog"
      :style="savedDocDialogStyle"
    >
      <div class="save-success">
        <div class="save-success-icon">
          <i class="pi pi-check" />
        </div>
        <div class="save-success-title">
          <span>เลขที่เอกสาร</span>
          <strong>{{ savedDocNo }}</strong>
        </div>
      </div>

      <div v-if="savedDocDetail" class="saved-doc-summary">
        <div class="saved-stat">
          <span>ลูกค้า</span>
          <strong>{{ savedDocDetail.name_1 || savedDocDetail.cust_code }}</strong>
        </div>
        <div class="saved-stat">
          <span>วันที่</span>
          <strong>{{ formatDate(savedDocDetail.doc_date) }}</strong>
        </div>
        <div class="saved-stat wide">
          <span>อ้างอิงบิลขาย</span>
          <strong>{{ savedDocDetail.sale_doc_list || "-" }}</strong>
        </div>
        <div class="saved-stat amount">
          <span>ยอดสุทธิ</span>
          <strong>{{ formatCurrency(savedDocDetail.total_amount) }}</strong>
        </div>
      </div>
      <div v-else class="muted-row">
        {{ savedDocLoading ? "กำลังโหลดรายละเอียดเอกสาร..." : "ยังไม่ได้โหลดรายละเอียดเอกสาร" }}
      </div>

      <div v-if="savedPaymentRows.length" class="saved-payments">
        <div v-for="row in savedPaymentRows" :key="row.label">
          <span>{{ row.label }}</span>
          <strong>{{ formatCurrency(row.amount) }}</strong>
        </div>
      </div>

      <template #footer>
        <div class="saved-dialog-actions">
          <Button label="ปิด" severity="secondary" text @click="savedDocDialogVisible = false" />
    
          <Button icon="pi pi-print" label="พิมพ์เอกสาร" :disabled="!canPrintSalesReturn" :loading="printLoading" @click="openSavedReturnPrint" />
        </div>
      </template>
    </Dialog>

    <Dialog
      :visible="docSearchDialogVisible"
      @update:visible="docSearchDialogVisible = $event"
      modal
      header="เอกสารที่มีสินค้านี้และยังคืนได้"
      :draggable="false"
      class="doc-search-dialog"
      content-class="doc-search-dialog-content"
      :style="docSearchDialogStyle"
      :content-style="docSearchDialogContentStyle"
    >
      <div class="dialog-search-bar">
        <InputText v-model="docSearchInput" class="full-input" placeholder="เลขที่เอกสารขาย" autofocus @keyup.enter="searchReturnableByDocNo" />
        <Button icon="pi pi-search" label="ค้นหา" :loading="docSearchLoading" :disabled="!canSearchDocNo" @click="searchReturnableByDocNo" />
      </div>
      <div v-if="docSearchInput" class="selected-doc-filter">
        <span>เอกสาร {{ docSearchInput }}</span>
        <Button icon="pi pi-times" text rounded size="small" @click="clearDocSearchSelection" aria-label="ล้างเอกสารที่เลือก" />
      </div>

      <DataTable :value="filteredReturnableRows" data-key="sale_doc_no" size="small" scrollable scroll-height="flex" :table-style="{ tableLayout: 'fixed', width: '100%' }" class="return-table">
        <Column header="บิลขาย" :style="{ width: '210px' }">
          <template #body="{ data }">
            <div class="doc-cell">
              <strong>{{ data.sale_doc_no }}</strong>
              <span>{{ formatDate(data.sale_doc_date) }} · {{ saleKindText(data) }}</span>
            </div>
          </template>
        </Column>
        <Column header="สินค้า">
          <template #body="{ data }">
            <div class="item-cell">
              <strong>{{ data.item_name || data.item_code }}</strong>
              <span>{{ data.item_code }} · {{ data.unit_code }}</span>
            </div>
          </template>
        </Column>
        <Column header="คืนได้" class="number-col" :style="{ width: '110px' }">
          <template #body="{ data }">{{ formatNumber(data.returnable_qty) }}</template>
        </Column>
        <Column header="ราคา" class="number-col" :style="{ width: '140px' }">
          <template #body="{ data }">{{ formatCurrency(data.return_unit_price || data.price) }}</template>
        </Column>
        <Column header="" :style="{ width: '56px' }">
          <template #body="{ data }">
            <Button icon="pi pi-plus" rounded text size="small" @click="addReturnRow(data)" aria-label="เพิ่ม" />
          </template>
        </Column>
      </DataTable>
    </Dialog>
  </div>
</template>

<style scoped>
.return-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.return-overview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.overview-card {
  border: 1px solid var(--p-surface-border);
  border-radius: 12px;
  padding: 0.85rem 0.95rem;
  background: linear-gradient(180deg, var(--p-surface-0), var(--p-surface-ground));
  min-width: 0;
}

.overview-card.accent {
  border-color: color-mix(in srgb, var(--p-primary-500) 28%, var(--p-surface-border));
  background: linear-gradient(180deg, color-mix(in srgb, var(--p-primary-50) 35%, var(--p-surface-0)), var(--p-surface-ground));
}

.overview-label {
  display: block;
  color: var(--p-text-color-secondary);
  font-size: 0.78rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.overview-card strong {
  display: block;
  font-size: 0.98rem;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.overview-card small {
  display: block;
  margin-top: 0.25rem;
  color: var(--p-text-color-secondary);
  font-size: 0.82rem;
  line-height: 1.3;
}

.return-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.return-header h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
}

.return-header p {
  margin: 0.25rem 0 0;
  color: var(--p-text-color-secondary);
}

.doc-strip {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.doc-format {
  min-width: 220px;
}

.next-doc {
  min-width: 150px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  background: var(--p-surface-0);
}

.next-doc span,
.selected-customer span,
.customer-result span,
.doc-cell span,
.item-cell span,
.return-row-main span {
  display: block;
  color: var(--p-text-color-secondary);
  font-size: 0.78rem;
}

.next-doc strong {
  display: block;
  font-size: 0.95rem;
}

.return-workspace {
  display: grid;
  grid-template-columns: minmax(360px, 1fr) minmax(320px, 380px);
  gap: 1rem;
  align-items: start;
}

.workflow-column {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.saved-doc-panel {
  background: var(--p-surface-0);
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  padding: 1rem;
}

.saved-doc-head,
.saved-doc-body,
.saved-payments {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.saved-doc-head {
  justify-content: space-between;
}

.saved-doc-head span,
.saved-stat span,
.saved-payments span {
  display: block;
  color: var(--p-text-color-secondary);
  font-size: 0.78rem;
}

.saved-doc-head strong {
  display: block;
  font-size: 1.05rem;
}

.saved-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.saved-doc-body {
  margin-top: 0.85rem;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.saved-stat {
  min-width: 0;
}

.saved-stat strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.saved-payments {
  margin-top: 0.75rem;
  flex-wrap: wrap;
}

.saved-payments div {
  min-width: 120px;
  padding: 0.5rem 0.65rem;
  border-radius: 8px;
  background: var(--p-surface-ground);
}

.save-success {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  margin-bottom: 1rem;
}

.save-success-icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--p-green-100);
  color: var(--p-green-700);
  flex: 0 0 auto;
}

.save-success-title {
  min-width: 0;
}

.save-success-title span {
  display: block;
  color: var(--p-text-color-secondary);
  font-size: 0.82rem;
}

.save-success-title strong {
  display: block;
  font-size: 1.35rem;
  line-height: 1.2;
}

.saved-doc-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
  margin-top: 0.75rem;
}

.saved-doc-summary .saved-stat {
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  padding: 0.65rem 0.75rem;
  background: var(--p-surface-0);
}

.saved-doc-summary .saved-stat.wide,
.saved-doc-summary .saved-stat.amount {
  grid-column: 1 / -1;
}

.saved-doc-summary .saved-stat.amount {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  background: var(--p-surface-ground);
}

.saved-doc-summary .saved-stat.amount strong {
  font-size: 1.2rem;
}

.saved-dialog-actions {
  width: 100%;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.lookup-panel,
.return-items-panel,
.summary-panel {
  background: var(--p-surface-0);
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  padding: 1rem;
  min-width: 0;
}

.summary-panel {
  position: sticky;
  top: 72px;
  align-self: start;
}

.summary-sticky {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.panel-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
}

.panel-head small {
  margin-left: auto;
  color: var(--p-text-color-secondary);
  font-size: 0.78rem;
  font-weight: 600;
}

.summary-head {
  margin-bottom: 0;
}

.product-head {
  margin-top: 1.25rem;
}

.full-input {
  width: 100%;
}

.customer-results {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: 240px;
  overflow-y: auto;
}

.customer-result {
  width: 100%;
  border: 1px solid var(--p-surface-border);
  background: var(--p-surface-ground);
  border-radius: 8px;
  padding: 0.55rem 0.65rem;
  text-align: left;
  cursor: pointer;
}

.customer-result:hover {
  background: var(--p-surface-hover);
}

.muted-row,
.empty-state {
  color: var(--p-text-color-secondary);
  font-size: 0.9rem;
  padding: 1rem 0;
  text-align: center;
}

.selected-customer {
  margin-top: 0.75rem;
  padding: 0.65rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--p-surface-border);
  border-left: 4px solid var(--p-primary-500);
  background: var(--p-surface-ground);
  color: var(--p-text-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.selected-customer-main {
  min-width: 0;
}

.scan-row {
  display: flex;
  gap: 0.5rem;
}

.open-results-btn {
  width: 100%;
  margin-top: 0.75rem;
}

.selected-doc-filter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  padding: 0.45rem 0.55rem;
  background: var(--p-surface-ground);
  color: var(--p-text-color-secondary);
  font-size: 0.85rem;
}

:deep(.doc-search-dialog) {
  width: min(980px, 96vw);
  height: min(720px, 90dvh);
  display: flex;
  flex-direction: column;
}

:deep(.doc-search-dialog .p-dialog-header) {
  flex: 0 0 auto;
}

:deep(.doc-search-dialog .p-dialog-content) {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dialog-search-bar {
  display: flex;
  flex: 0 0 auto;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

:deep(.doc-search-dialog .return-table) {
  flex: 1 1 auto;
  min-height: 0;
}

.doc-cell,
.item-cell {
  min-width: 0;
}

.doc-cell strong,
.item-cell strong,
.return-row-main strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.return-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  max-height: 460px;
  overflow-y: auto;
}

.return-row {
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  padding: 0.75rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.85rem;
  align-items: center;
}

.return-row-main {
  min-width: 0;
}

.return-row-controls {
  display: grid;
  grid-template-columns: 110px 96px 32px;
  align-items: center;
  gap: 0.4rem;
}

:deep(.qty-input) {
  width: 100%;
}

.line-amount {
  font-weight: 700;
  text-align: right;
  white-space: nowrap;
}

.totals-box {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  padding: 0.85rem;
  background: var(--p-surface-ground);
}

.totals-box div {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
}

.grand-total {
  border-top: 1px solid var(--p-surface-border);
  padding-top: 0.6rem;
  margin-top: 0.15rem;
  font-size: 1.18rem;
}

.payment-box {
  border: 1px solid var(--p-surface-border);
  border-radius: 12px;
  padding: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  background: linear-gradient(180deg, var(--p-surface-0), var(--p-surface-ground));
}

.payment-head,
.payment-balance {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.payment-head {
  font-weight: 700;
}

.payment-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}

.payment-tab {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 10px;
  padding: 0.75rem 0.8rem;
  background: var(--p-surface-0);
  color: var(--p-text-color);
  cursor: pointer;
  text-align: left;
  font: inherit;
  transition: border-color 0.15s ease, background-color 0.15s ease, transform 0.15s ease;
}

.payment-tab:hover {
  border-color: var(--p-primary-300);
  transform: translateY(-1px);
}

.payment-tab.active {
  border-color: var(--p-primary-500);
  background: color-mix(in srgb, var(--p-primary-50) 45%, var(--p-surface-0));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--p-primary-500) 18%, transparent);
}

.payment-tab i {
  font-size: 0.9rem;
  color: var(--p-primary-500);
}

.payment-tab span {
  font-size: 0.85rem;
  font-weight: 700;
}

.payment-tab small {
  color: var(--p-text-color-secondary);
  font-size: 0.78rem;
}

.payment-tab-panel {
  border: 1px solid var(--p-surface-border);
  border-radius: 10px;
  background: var(--p-surface-0);
  padding: 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.payment-row {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.payment-row label {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--p-text-color-secondary);
}

.payment-input-line {
  display: flex;
  align-items: stretch;
  gap: 0.5rem;
}

:deep(.money-input) {
  width: 100%;
}

.fill-amount-btn {
  flex: 0 0 auto;
  white-space: nowrap;
}

.payment-snapshot {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
}

.payment-snapshot-item {
  border-radius: 9px;
  padding: 0.55rem 0.65rem;
  background: var(--p-surface-0);
  border: 1px solid var(--p-surface-border);
}

.payment-snapshot-item.active {
  border-color: color-mix(in srgb, var(--p-primary-500) 38%, var(--p-surface-border));
}

.payment-snapshot-item span {
  display: block;
  color: var(--p-text-color-secondary);
  font-size: 0.76rem;
}

.payment-snapshot-item strong {
  display: block;
  margin-top: 0.15rem;
  font-size: 0.9rem;
}

.payment-balance {
  border-top: 1px solid var(--p-surface-border);
  padding-top: 0.65rem;
  color: var(--p-text-color-secondary);
  font-weight: 700;
}

.payment-balance.done {
  color: var(--p-green-600);
}

.payment-balance.over {
  color: var(--p-red-600);
}

.credit-note-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  padding: 0.8rem 0.85rem;
  background: var(--p-surface-ground);
}

.credit-note-box span {
  color: var(--p-text-color-secondary);
  font-size: 0.85rem;
}

.credit-note-box.pending strong {
  color: var(--p-text-color-secondary);
  font-weight: 600;
}

.next-btn {
  width: 100%;
}

.confirm-save-body {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.confirm-save-intro {
  margin: 0;
  color: var(--p-text-color-secondary);
}

.confirm-save-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
}

.confirm-save-stat {
  border: 1px solid var(--p-surface-border);
  border-radius: 10px;
  padding: 0.75rem 0.8rem;
  background: var(--p-surface-0);
  min-width: 0;
}

.confirm-save-stat.wide,
.confirm-save-stat.amount {
  grid-column: 1 / -1;
}

.confirm-save-stat span,
.confirm-save-payments span {
  display: block;
  color: var(--p-text-color-secondary);
  font-size: 0.78rem;
}

.confirm-save-stat strong,
.confirm-save-payments strong {
  display: block;
  margin-top: 0.2rem;
}

.confirm-save-stat small {
  display: block;
  margin-top: 0.15rem;
  color: var(--p-text-color-secondary);
  font-size: 0.78rem;
}

.confirm-save-stat.amount {
  background: var(--p-surface-ground);
}

.confirm-save-stat.amount strong {
  font-size: 1.15rem;
}

.confirm-save-payments {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.confirm-save-payments div {
  min-width: 120px;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  padding: 0.55rem 0.65rem;
  background: var(--p-surface-ground);
}

.confirm-save-actions {
  width: 100%;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  flex-wrap: wrap;
}

@media (max-width: 720px) {
  .return-workspace {
    grid-template-columns: 1fr;
  }

  .summary-panel {
    position: static;
  }

  .return-header,
  .doc-strip {
    flex-direction: column;
    align-items: stretch;
  }

  .saved-doc-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .saved-doc-body {
    grid-template-columns: 1fr 1fr;
  }

  .doc-format,
  .next-doc {
    width: 100%;
  }

  .return-row {
    grid-template-columns: 1fr;
  }

  .return-row-controls {
    grid-template-columns: minmax(100px, 1fr) auto 32px;
  }

  .payment-tabs,
  .payment-snapshot {
    grid-template-columns: 1fr;
  }

  .payment-input-line {
    flex-direction: column;
  }

  .fill-amount-btn {
    width: 100%;
  }

  .confirm-save-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 1180px) {
  .return-workspace {
    grid-template-columns: 1fr;
  }

  .summary-panel {
    position: static;
  }

  .return-row-controls {
    grid-template-columns: minmax(110px, 140px) minmax(96px, 1fr) 32px;
  }
}

@media (min-width: 1181px) and (max-width: 1400px) {
  .return-workspace {
    grid-template-columns: 1fr;
  }

  .summary-panel {
    position: static;
  }
}
</style>

<style>
.doc-search-dialog {
  width: min(980px, calc(100vw - 2rem)) !important;
  min-width: min(980px, calc(100vw - 2rem)) !important;
  max-width: min(980px, calc(100vw - 2rem)) !important;
  height: min(720px, calc(100dvh - 2rem)) !important;
  min-height: min(720px, calc(100dvh - 2rem)) !important;
  max-height: min(720px, calc(100dvh - 2rem)) !important;
  display: flex !important;
  flex-direction: column;
}

.doc-search-dialog .p-dialog-header {
  flex: 0 0 auto;
}

.doc-search-dialog .p-dialog-content,
.doc-search-dialog-content {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.doc-search-dialog .dialog-search-bar,
.doc-search-dialog .selected-doc-filter,
.doc-search-dialog .p-message {
  flex: 0 0 auto;
}

.doc-search-dialog .return-table {
  flex: 1 1 auto;
  min-height: 0;
  max-width: 100%;
  overflow: hidden;
}

.doc-search-dialog .p-datatable-table-container {
  min-height: 0;
}

.doc-search-dialog .doc-cell,
.doc-search-dialog .item-cell {
  max-width: 100%;
  overflow: hidden;
}

.saved-doc-dialog {
  width: min(620px, calc(100vw - 2rem)) !important;
  min-width: min(620px, calc(100vw - 2rem)) !important;
  max-width: min(620px, calc(100vw - 2rem)) !important;
}
</style>
