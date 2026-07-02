<script setup>
import { computed, ref, onMounted, watch } from "vue";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Textarea from "primevue/textarea";
import SelectButton from "primevue/selectbutton";
import { useAuthStore } from "@/stores/auth";
import { getCustomerCredit, getCustomerList } from "@/services/sellService";
import api from "@/services/api";

const props = defineProps({
  basket: { type: Object, required: true },
  confirmedInfo: { type: Object, default: null },
});
const emit = defineEmits(["back", "confirm"]);

const authStore = useAuthStore();

const inquiryTypeOptions = [
  { label: "ขายเชื่อ", value: 0 },
  { label: "ขายสด", value: 1 },
  { label: "เชื่อ(บริการ)", value: 2 },
  { label: "สด(บริการ)", value: 3 },
];

const vatTypeOptions = [
  { label: "แยกนอก", value: 0 },
  { label: "รวมใน", value: 1 },
  { label: "ศูนย์", value: 2 },
  { label: "ไม่กระทบ", value: 3 },
];

const initialInfo = props.confirmedInfo || props.basket;

const inquiryType = ref(initialInfo.inquiry_type ?? 1);
const isCreditSale = computed(() => [0, 2].includes(Number(inquiryType.value)));
const vatType = ref(initialInfo.vat_type ?? 2);
const vatRate = ref(initialInfo.vat_rate ?? 7.0);
const orderRemark = ref("");
const docFormatCode = ref(initialInfo.doc_format_code || "");
const docFormatName = ref(initialInfo.doc_format_name || "");
const formCode = ref(initialInfo.form_code || "");

// ลูกค้า (แก้ไขได้)
const custCode = ref(initialInfo.cust_code || "");
const custName = ref(initialInfo.cust_name || "ลูกค้าทั่วไป");
const custEditing = ref(false);
const custSearch = ref("");
const custResults = ref([]);
const custLoading = ref(false);
const showCustDropdown = ref(false);
const creditInfo = ref(
  initialInfo.credit_day !== undefined || initialInfo.credit_date
    ? { credit_day: initialInfo.credit_day, credit_date: initialInfo.credit_date }
    : null,
);
const creditLoading = ref(false);
const creditError = ref("");
const creditReady = computed(() => !isCreditSale.value || (!!custCode.value && !creditLoading.value && !creditError.value));
let custDebounce = null;

function saleDocDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatCreditDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

async function loadCustomerCredit() {
  creditError.value = "";
  if (!isCreditSale.value || !custCode.value) {
    creditInfo.value = null;
    return;
  }
  creditLoading.value = true;
  try {
    creditInfo.value = await getCustomerCredit(custCode.value, saleDocDate());
  } catch (ex) {
    creditInfo.value = null;
    creditError.value = ex.message || "โหลดข้อมูลเครดิตไม่สำเร็จ";
  } finally {
    creditLoading.value = false;
  }
}

watch([custCode, inquiryType], loadCustomerCredit, { immediate: true });

function onCustSearchInput(val) {
  clearTimeout(custDebounce);
  if (!val.trim()) {
    custResults.value = [];
    showCustDropdown.value = false;
    return;
  }
  custDebounce = setTimeout(async () => {
    custLoading.value = true;
    try {
      custResults.value = await getCustomerList(val.trim());
      showCustDropdown.value = custResults.value.length > 0;
    } finally {
      custLoading.value = false;
    }
  }, 300);
}

function selectWalkIn() {
  custCode.value = "AR0269";
  custName.value = "สด ทั่วไป";
  custSearch.value = "";
  showCustDropdown.value = false;
  custEditing.value = false;
}

function selectCustomer(c) {
  custCode.value = c.code;
  custName.value = c.name;
  custSearch.value = "";
  showCustDropdown.value = false;
  custEditing.value = false;
}

const saleCode = ref(initialInfo.sale_code || "");
const saleName = ref(initialInfo.sale_name || "");
const saleEditing = ref(false);
const saleSearch = ref("");
const saleResults = ref([]);
const saleLoading = ref(false);
const showSaleDropdown = ref(false);
let saleDebounce = null;

onMounted(() => {
  if (initialInfo.order_remark) {
    orderRemark.value = initialInfo.order_remark;
  }
  if (!saleCode.value) {
    const emp = authStore.employee;
    if (emp) {
      saleCode.value = emp.user_code ?? "";
      saleName.value = emp.user_name ?? "";
    }
  }
});

function watchSaleSearch(val) {
  clearTimeout(saleDebounce);
  if (!val.trim()) {
    saleResults.value = [];
    showSaleDropdown.value = false;
    return;
  }
  saleDebounce = setTimeout(async () => {
    saleLoading.value = true;
    try {
      const { data } = await api.get("/getEmployeeList", {
        params: { search: val.trim() },
      });
      saleResults.value = data.data || [];
      showSaleDropdown.value = saleResults.value.length > 0;
    } finally {
      saleLoading.value = false;
    }
  }, 300);
}

function selectEmployee(e) {
  saleCode.value = e.code;
  saleName.value = e.name;
  saleSearch.value = "";
  showSaleDropdown.value = false;
  saleEditing.value = false;
}

function confirm() {
  if (!creditReady.value) return;
  emit("confirm", {
    cust_code: custCode.value,
    cust_name: custName.value,
    inquiry_type: inquiryType.value,
    credit_day: isCreditSale.value ? Number(creditInfo.value?.credit_day || 0) : null,
    credit_date: isCreditSale.value ? (creditInfo.value?.credit_date || "") : "",
    vat_type: vatType.value,
    vat_rate: vatRate.value,
    sale_code: saleCode.value,
    sale_name: saleName.value,
    doc_format_code: docFormatCode.value,
    doc_format_name: docFormatName.value,
    form_code: formCode.value,
    order_remark: orderRemark.value,
  });
}
</script>

<template>
  <div class="confirm-view">
    <div class="confirm-header">
      <Button
        icon="pi pi-arrow-left"
        text
        rounded
        size="small"
        @click="emit('back')"
        aria-label="กลับ"
      />
      <span class="confirm-title">ยืนยันข้อมูล</span>
    </div>

    <div class="confirm-body">
      <!-- ลูกค้า -->
      <section class="conf-section">
        <div class="section-label">ลูกค้า</div>
        <template v-if="!custEditing">
          <div class="value-row">
            <div class="value-display">
              <i class="pi pi-user value-icon" />
              <span class="value-text">{{ custName }}</span>
              <span v-if="custCode" class="value-sub">({{ custCode }})</span>
            </div>
            <Button label="เปลี่ยน" text size="small" @click="custEditing = true" />
          </div>
        </template>
        <template v-else>
          <Button
            label="ลูกค้าทั่วไป"
            icon="pi pi-user"
            :outlined="custCode !== 'AR0269'"
            size="small"
            class="walkin-btn"
            @click="selectWalkIn"
          />
          <div class="search-wrap">
            <InputText
              v-model="custSearch"
              placeholder="ค้นหาลูกค้า (รหัส/ชื่อ)..."
              class="w-full"
              autofocus
              @update:model-value="onCustSearchInput"
            />
            <div v-if="showCustDropdown" class="dropdown-list">
              <button
                v-for="c in custResults"
                :key="c.code"
                class="dropdown-item"
                @click="selectCustomer(c)"
              >
                <span class="dropdown-code">{{ c.code }}</span>
                <span class="dropdown-name">{{ c.name }}</span>
              </button>
            </div>
          </div>
        </template>
      </section>

      <!-- รหัสเอกสาร -->
      <section class="conf-section">
        <div class="section-label">รหัสเอกสาร</div>
        <div class="readonly-badge">
          <i class="pi pi-file" />
          <span>{{ docFormatCode || '-' }}</span>
          <span v-if="docFormatName" class="meta-code">{{ docFormatName }}</span>
        </div>
      </section>

      <!-- ประเภทการขาย -->
      <section class="conf-section">
        <div class="section-label">ประเภทการขาย</div>
        <SelectButton
          v-model="inquiryType"
          :options="inquiryTypeOptions"
          option-label="label"
          option-value="value"
          class="wrap-select"
        />
        <div v-if="isCreditSale" class="credit-panel">
          <div class="credit-panel-head">
            <i class="pi pi-calendar-clock" />
            <span>ข้อมูลเครดิตลูกค้า</span>
          </div>
          <div v-if="!custCode" class="credit-panel-note">เลือกลูกค้าเพื่อดึงจำนวนวันเครดิต</div>
          <div v-else-if="creditLoading" class="credit-panel-note">กำลังโหลดข้อมูลเครดิต...</div>
          <div v-else-if="creditError" class="credit-panel-note warning">{{ creditError }}</div>
          <div v-else class="credit-grid">
            <div>
              <span>จำนวนวันเครดิต</span>
              <strong>{{ Number(creditInfo?.credit_day || 0) }} วัน</strong>
            </div>
            <div>
              <span>วันที่เครดิต</span>
              <strong>{{ formatCreditDate(creditInfo?.credit_date) }}</strong>
            </div>
          </div>
        </div>
      </section>

      <!-- ประเภทภาษี -->
      <section class="conf-section">
        <div class="section-label">ประเภทภาษี</div>
        <SelectButton
          v-model="vatType"
          :options="vatTypeOptions"
          option-label="label"
          option-value="value"
          class="wrap-select"
        />
      </section>

      <!-- พนักงานขาย -->
      <section class="conf-section">
        <div class="section-label">พนักงานขาย</div>
        <template v-if="!saleEditing">
          <div class="value-row">
            <div class="value-display">
              <i class="pi pi-id-card value-icon" />
              <span class="value-text">{{ saleName || "(ไม่ระบุ)" }}</span>
              <span v-if="saleCode" class="value-sub">({{ saleCode }})</span>
            </div>
            <Button label="เปลี่ยน" text size="small" @click="saleEditing = true" />
          </div>
        </template>
        <template v-else>
          <div class="search-wrap">
            <InputText
              v-model="saleSearch"
              placeholder="ค้นหาพนักงาน..."
              class="w-full"
              autofocus
              @update:model-value="watchSaleSearch"
            />
            <div v-if="showSaleDropdown" class="dropdown-list">
              <button
                v-for="e in saleResults"
                :key="e.code"
                class="dropdown-item"
                @click="selectEmployee(e)"
              >
                <span class="dropdown-code">{{ e.code }}</span>
                <span class="dropdown-name">{{ e.name }}</span>
              </button>
            </div>
          </div>
        </template>
      </section>

      <!-- หมายเหตุ -->
      <section class="conf-section">
        <div class="section-label">หมายเหตุ</div>
        <Textarea
          v-model="orderRemark"
          rows="3"
          placeholder="หมายเหตุรายการขาย..."
          class="w-full"
          auto-resize
        />
      </section>
    </div>

    <div class="confirm-footer">
      <Button
        label="ถัดไป"
        icon="pi pi-arrow-right"
        icon-pos="right"
        class="w-full confirm-btn"
        size="large"
        :disabled="!creditReady"
        @click="confirm"
      />
    </div>
  </div>
</template>

<style scoped>
/* ─── Footer ─── */
.confirm-footer {
  border-top: 1px solid var(--app-blue-line, #c7e7fa);
  padding: 0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom));
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.94);
  position: sticky;
  bottom: 0;
  z-index: 5;
  box-shadow: 0 -10px 24px rgba(2, 132, 199, 0.08);
}

.confirm-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
  background: linear-gradient(180deg, #fbfdff 0%, #f3faff 100%);
}

.confirm-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--app-blue-line, #c7e7fa);
  flex-shrink: 0;
  background:
    radial-gradient(circle at 8% 0%, rgba(14, 165, 233, 0.12), transparent 22rem),
    linear-gradient(180deg, #ffffff 0%, #f5fbff 100%);
}

.confirm-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--app-blue-ink, #075985);
}

.confirm-body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 560px;
  width: 100%;
  margin: 0 auto;
}

.conf-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.section-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--p-text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.readonly-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  padding: 0.5rem 0.75rem;
  background: #ffffff;
  border: 1px solid var(--app-blue-line, #c7e7fa);
  border-radius: 8px;
  color: var(--p-text-color);
}

.meta-code {
  color: var(--p-text-color-secondary);
  font-size: 0.8rem;
}

.value-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #ffffff;
  border: 1px solid var(--app-blue-line, #c7e7fa);
  border-radius: 8px;
}

.value-display {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.value-icon {
  color: var(--p-text-color-secondary);
  font-size: 0.9rem;
  flex-shrink: 0;
}

.value-text {
  font-size: 0.9rem;
  font-weight: 500;
}

.value-sub {
  font-size: 0.8rem;
  color: var(--p-text-color-secondary);
  flex-shrink: 0;
}

.walkin-btn {
  align-self: flex-start;
}

.wrap-select :deep(.p-selectbutton) {
  flex-wrap: wrap;
}

.credit-panel {
  border: 1px solid var(--app-blue-line, #c7e7fa);
  border-radius: 8px;
  background: linear-gradient(180deg, #eaf7ff 0%, #ffffff 100%);
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.credit-panel-head {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--p-primary-color);
  font-size: 0.9rem;
  font-weight: 700;
}

.credit-panel-note {
  color: var(--p-text-color-secondary);
  font-size: 0.85rem;
}

.credit-panel-note.warning {
  color: #b45309;
}

.credit-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.credit-grid div {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.credit-grid span {
  color: var(--p-text-color-secondary);
  font-size: 0.75rem;
}

.credit-grid strong {
  color: var(--p-text-color);
  font-size: 1rem;
}

.search-wrap {
  position: relative;
}

.w-full {
  width: 100%;
}

.dropdown-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 100;
  background: #ffffff;
  border: 1px solid var(--app-blue-line, #c7e7fa);
  border-radius: 8px;
  box-shadow: var(--app-shadow-card, 0 14px 34px rgba(2, 132, 199, 0.13));
  max-height: 200px;
  overflow-y: auto;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: none;
  background: none;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  font-size: 0.875rem;
}

.dropdown-item:hover {
  background: var(--app-blue-soft, #eaf7ff);
}

.dropdown-code {
  font-weight: 600;
  min-width: 5rem;
  color: var(--p-text-color-secondary);
  font-size: 0.8rem;
}

.dropdown-name {
  flex: 1;
}

.selected-badge {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.875rem;
}

.confirm-btn {
  width: 100%;
}
</style>
