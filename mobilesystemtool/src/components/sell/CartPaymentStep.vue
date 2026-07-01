<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Dialog from 'primevue/dialog'
import { useToast } from 'primevue/usetoast'
import { useCartStore } from '@/stores/cart'
import { usePosStore } from '@/stores/pos'
import { formatCurrency } from '@/utils/formatters'
import { getPassBookList, getCreditTypeList, getSaleAdvanceDepositBalance, saveTrans } from '@/services/sellService'
import { calcDiscountAmount } from '@/utils/discount'
import { createTigerOrder, inquireTigerOrder, cancelTigerOrder, getTigerConfig, TIGER_MOCK } from '@/services/tigerService'
import { generateUUID } from '@/utils/uuid'

const props = defineProps({
  basket: { type: Object, required: true },
  orderData: { type: Object, required: true },
})
const emit = defineEmits(['back', 'complete'])

const cartStore = useCartStore()
const posStore = usePosStore()
const toast = useToast()

function isSetItem(item) {
  return cartStore.isSetItem(item)
}

function setSubItems(item) {
  return item.sub_item || cartStore.setItemsCache[item.item_code] || []
}

function rnd(value, point) {
  const f = Math.pow(10, point)
  return Math.round(value * f) / f
}

function stockIssueSummary(issues = []) {
  if (!Array.isArray(issues) || issues.length === 0) return ''
  return issues
    .slice(0, 3)
    .map(issue => issue.item_name || issue.item_code)
    .filter(Boolean)
    .join(', ')
}

// ─── Sale type ───────────────────────────────────────────────────────────────

const isCreditSale = computed(() => [0, 2].includes(Number(props.orderData.inquiry_type)))

const saleTypeLabel = computed(() => {
  const t = Number(props.orderData.inquiry_type)
  if (t === 0) return 'ขายเชื่อ'
  if (t === 1) return 'ขายสด'
  if (t === 2) return 'เชื่อ (บริการ)'
  if (t === 3) return 'สด (บริการ)'
  return ''
})

// ─── Payment entries ─────────────────────────────────────────────────────────

function formatCreditDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const paymentEntries = ref([])
const customerCode = computed(() => props.orderData.cust_code || '')

// ปัดเศษ: ทำหน้าที่เหมือนการจ่ายเงินชนิดหนึ่ง (เงินที่จ่าย + ปัดเศษ = ยอดสุทธิ)
const roundedAmount = ref(null)

const totalPaid = computed(() => rnd(paymentEntries.value.reduce((s, e) => s + e.amount, 0), 2))
const totalDue = computed(() => rnd(Number(props.orderData.total_amount) || 0, 2))
const remaining = computed(() => Math.max(0, rnd(totalDue.value - totalPaid.value - (roundedAmount.value || 0), 2)))
const change = computed(() => Math.max(0, rnd(totalPaid.value + (roundedAmount.value || 0) - totalDue.value, 2)))

function paymentEntryIcon(type) {
  if (type === 'cash') return 'pi pi-money-bill'
  if (type === 'transfer') return 'pi pi-send'
  if (type === 'credit') return 'pi pi-credit-card'
  if (type === 'deposit') return 'pi pi-wallet'
  if (type === 'tiger') return 'pi pi-desktop'
  return 'pi pi-receipt'
}

// ─── UI state ────────────────────────────────────────────────────────────────

const activeType = ref('cash')
const saving = ref(false)
const saveError = ref('')

// ─── Reference data ──────────────────────────────────────────────────────────

const passBooks = ref([])
const creditTypes = ref([])
const tigerEnabled = ref(false)

const paymentTabs = computed(() => {
  const tabs = [
    { key: 'cash', label: 'เงินสด', icon: 'pi pi-money-bill' },
    { key: 'transfer', label: 'โอน', icon: 'pi pi-send' },
    { key: 'credit', label: 'บัตรเครดิต', icon: 'pi pi-credit-card' },
    { key: 'deposit', label: 'ล่วงหน้า/มัดจำ', icon: 'pi pi-wallet' },
  ]
  if (tigerEnabled.value) {
    tabs.push({ key: 'tiger', label: 'Tiger', icon: 'pi pi-desktop' })
  }
  return tabs
})

onMounted(async () => {
  const tasks = [getTigerConfig().then(c => { tigerEnabled.value = !!c.enabled })]
  if (!isCreditSale.value) {
    tasks.push(
      Promise.all([getPassBookList(), getCreditTypeList()]).then(([pb, ct]) => {
        passBooks.value = pb
        creditTypes.value = ct
      }),
    )
  }
  await Promise.all(tasks)
})

// ─── Denomination helpers ────────────────────────────────────────────────────

const DENOMS = [20, 50, 100, 500, 1000]

function addDenom(val) {
  cashAmount.value = rnd((cashAmount.value || 0) + val, 2)
}

// ─── Cash form ───────────────────────────────────────────────────────────────

const cashAmount = ref(null)

function addCash() {
  if (!cashAmount.value || cashAmount.value <= 0) return
  paymentEntries.value.push({
    id: Date.now(),
    type: 'cash',
    label: 'เงินสด',
    amount: cashAmount.value,
    details: {},
  })
  cashAmount.value = null
}

// ─── Transfer form ───────────────────────────────────────────────────────────

const today = new Date().toISOString().slice(0, 10)
const transferDate = ref(today)
const transferPassBook = ref(null)
const transferAmount = ref(null)

function addTransfer() {
  if (!transferPassBook.value || !transferAmount.value || transferAmount.value <= 0) return
  const book = transferPassBook.value
  paymentEntries.value.push({
    id: Date.now(),
    type: 'transfer',
    label: `${book.book_name} (${book.bank_name || book.bank_code})`,
    amount: transferAmount.value,
    details: {
      pass_book_code: book.code,
      bank_code: book.bank_code,
      bank_branch: book.bank_branch,
      transfer_date: transferDate.value,
    },
  })
  transferAmount.value = null
  transferPassBook.value = null
}

// ─── Credit card form ────────────────────────────────────────────────────────

const selectedCreditType = ref(null)
const creditCardNumber = ref('')
const creditApprovalNo = ref('')
const creditAmount = ref(null)

const creditChargeRate = computed(() => parseFloat(selectedCreditType.value?.charge_rate) || 0)
const creditCharge = computed(() => rnd((creditAmount.value || 0) * creditChargeRate.value / 100, 2))
const creditSumAmount = computed(() => rnd((creditAmount.value || 0) + creditCharge.value, 2))

function addCredit() {
  if (!selectedCreditType.value || !creditAmount.value || creditAmount.value <= 0) return
  const ct = selectedCreditType.value
  paymentEntries.value.push({
    id: Date.now(),
    type: 'credit',
    label: ct.name_1,
    amount: creditAmount.value,
    details: {
      credit_card_type: ct.code,
      card_number: creditCardNumber.value,
      no_approved: creditApprovalNo.value,
      charge: creditCharge.value,
      sum_amount: creditSumAmount.value,
    },
  })
  creditAmount.value = null
  creditCardNumber.value = ''
  creditApprovalNo.value = ''
  selectedCreditType.value = null
}

// Advance/deposit documents from SML ERP use cb_trans_detail doc_type 5/6.
const advanceDepositRows = ref([])
const advanceDepositLoading = ref(false)
const advanceDepositError = ref('')
const selectedAdvanceDeposit = ref(null)
const advanceDepositAmount = ref(null)

function getEntryDocNo(entry) {
  return entry?.details?.trans_number || entry?.details?.doc_no || ''
}

function usedAdvanceDepositAmount(row) {
  const docNo = row?.doc_no || ''
  const docType = Number(row?.doc_type || 0)
  if (!docNo || !docType) return 0
  return rnd(paymentEntries.value
    .filter(e => e.type === 'deposit' && getEntryDocNo(e) === docNo && Number(e.details?.doc_type || 0) === docType)
    .reduce((sum, e) => sum + e.amount, 0), 2)
}

function advanceDepositAvailable(row) {
  return Math.max(0, rnd(Number(row?.balance_amount || 0) - usedAdvanceDepositAmount(row), 2))
}

const advanceDepositOptions = computed(() =>
  advanceDepositRows.value.filter(row => advanceDepositAvailable(row) > 0)
)

const selectedAdvanceDepositBalance = computed(() => advanceDepositAvailable(selectedAdvanceDeposit.value))

function advanceDepositLabel(row) {
  if (!row) return ''
  const label = row.type_label || (Number(row.doc_type) === 6 ? 'เงินมัดจำ' : 'เงินล่วงหน้า')
  return `${label} ${row.doc_no}`
}

async function loadAdvanceDepositBalance(force = false) {
  if (!customerCode.value) {
    advanceDepositRows.value = []
    selectedAdvanceDeposit.value = null
    advanceDepositAmount.value = null
    return
  }
  if (!force && advanceDepositRows.value.length > 0) return
  advanceDepositLoading.value = true
  advanceDepositError.value = ''
  try {
    const data = await getSaleAdvanceDepositBalance(customerCode.value)
    advanceDepositRows.value = (data.rows || []).map(row => ({
      ...row,
      display_label: advanceDepositLabel(row),
    }))
    if (selectedAdvanceDeposit.value) {
      selectedAdvanceDeposit.value = advanceDepositRows.value.find(row =>
        row.doc_no === selectedAdvanceDeposit.value.doc_no
        && Number(row.doc_type) === Number(selectedAdvanceDeposit.value.doc_type)
      ) || null
    }
  } catch (ex) {
    advanceDepositError.value = ex.message || 'โหลดเงินล่วงหน้า/มัดจำไม่สำเร็จ'
  } finally {
    advanceDepositLoading.value = false
  }
}

function fillAdvanceDepositAmount(row = selectedAdvanceDeposit.value) {
  if (!row) return
  selectedAdvanceDeposit.value = row
  const usable = advanceDepositAvailable(row)
  advanceDepositAmount.value = rnd(Math.min(usable, remaining.value > 0 ? remaining.value : usable), 2)
}

function addAdvanceDeposit(row = selectedAdvanceDeposit.value) {
  if (!row) return
  const usable = advanceDepositAvailable(row)
  const amount = rnd(Math.min(Number(advanceDepositAmount.value || 0), usable), 2)
  if (amount <= 0) return
  paymentEntries.value.push({
    id: Date.now(),
    type: 'deposit',
    label: advanceDepositLabel(row),
    amount,
    details: {
      trans_number: row.doc_no,
      doc_no: row.doc_no,
      doc_date: row.doc_date,
      doc_type: Number(row.doc_type),
      trans_flag: Number(row.trans_flag),
      balance_amount: Number(row.balance_amount || 0),
      type_label: row.type_label || '',
    },
  })
  advanceDepositAmount.value = null
  if (advanceDepositAvailable(row) <= 0) selectedAdvanceDeposit.value = null
}

function removeEntry(id) {
  paymentEntries.value = paymentEntries.value.filter(e => e.id !== id)
}

watch(activeType, (type) => {
  if (type === 'deposit') loadAdvanceDepositBalance()
})

watch(customerCode, () => {
  advanceDepositRows.value = []
  selectedAdvanceDeposit.value = null
  advanceDepositAmount.value = null
  paymentEntries.value = paymentEntries.value.filter(e => e.type !== 'deposit')
  if (activeType.value === 'deposit') loadAdvanceDepositBalance(true)
})

// ─── Tiger ────────────────────────────────────────────────────────────────────
// status: idle | requesting | waiting | processing | success | cancel | failed
// ตรงกับ status ที่ Tiger API ส่งกลับมา: new, processing, success, cancel, failed

const tigerStatus = ref('idle')
const tigerId = ref(null)        // Tiger order id (string) จาก /orders response
const tigerError = ref('')
const tigerPollInterval = ref(null)
const tigerCancel = ref(false)   // true เมื่อ status=new, false เมื่อ processing

function genRef() {
  return `${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`
}

const tigerRef1 = ref('')
const tigerRef2 = ref('')
const tigerPayAmount = computed(() => rnd(remaining.value > 0 ? remaining.value : totalDue.value - (roundedAmount.value || 0), 2))

async function startTigerPayment() {
  tigerStatus.value = 'requesting'
  tigerError.value = ''
  tigerCancel.value = false
  const amount = tigerPayAmount.value
  const orderId = generateUUID()
  tigerRef1.value = genRef()
  tigerRef2.value = genRef()
  try {
    const res = await createTigerOrder({
      orderId,
      custName: props.orderData.cust_name || '',
      posId: posStore.posId,
      amount,
      ref1: tigerRef1.value,
      ref2: tigerRef2.value,
    })
    // สร้างสำเร็จเมื่อ status === "new" (ตรงกับ case 401 ใน Flutter)
    if (res.status === 'new') {
      tigerId.value = String(res.id)
      tigerStatus.value = 'waiting'
      tigerCancel.value = true
      tigerPollInterval.value = setInterval(pollTiger, 3000)
    } else {
      throw new Error('ไม่สามารถสร้างรายการชำระเงินได้')
    }
  } catch (e) {
    tigerStatus.value = 'failed'
    tigerError.value = e.message
  }
}

async function pollTiger() {
  if (!tigerId.value) return
  try {
    const res = await inquireTigerOrder(tigerId.value)
    // ตรงกับ polling logic qrType == 401 ใน Flutter
    if (res.status === 'success') {
      clearInterval(tigerPollInterval.value)
      tigerStatus.value = 'success'
      paymentEntries.value.push({
        id: Date.now(),
        type: 'tiger',
        label: 'เครื่องชำระเงิน Tiger',
        amount: tigerPayAmount.value,
        details: { tiger_order_id: tigerId.value },
      })
      await save()
    } else if (res.status === 'cancel') {
      clearInterval(tigerPollInterval.value)
      tigerStatus.value = 'cancel'
    } else if (res.status === 'failed') {
      clearInterval(tigerPollInterval.value)
      tigerStatus.value = 'failed'
      tigerError.value = 'Tiger: การชำระเงินล้มเหลว'
    } else if (res.status === 'new') {
      tigerCancel.value = true
    } else if (res.status === 'processing') {
      tigerCancel.value = false
    }
  } catch (_) {
    // network error — poll ต่อ
  }
}

async function cancelTiger() {
  clearInterval(tigerPollInterval.value)
  try { await cancelTigerOrder(tigerId.value) } catch (_) {}
  tigerStatus.value = 'idle'
  tigerId.value = null
  tigerCancel.value = false
}

onUnmounted(() => clearInterval(tigerPollInterval.value))

// ─── Save ─────────────────────────────────────────────────────────────────────

const canSave = computed(() =>
  !saving.value && (isCreditSale.value || totalPaid.value + (roundedAmount.value || 0) >= totalDue.value)
)

function buildSaveBody({ tigerPending = false } = {}) {
  const pos = posStore.selectedPos
  const now = new Date()
  // Tiger คือเงินสดที่รับผ่านเครื่อง — รวมเข้ากับ cash เพื่อให้ backend คิดเป็นเงินสด
  const cashEntries = paymentEntries.value.filter(e => e.type === 'cash' || e.type === 'tiger')
  const transfers = paymentEntries.value.filter(e => e.type === 'transfer')
  const credits = paymentEntries.value.filter(e => e.type === 'credit')
  const deposits = paymentEntries.value.filter(e => e.type === 'deposit')

  return {
    pos_id: posStore.posId,
    basket_id: props.basket.basket_id,
    doc_date: now.toISOString().slice(0, 10),
    doc_time: now.toTimeString().slice(0, 5),
    doc_format_code: props.orderData.doc_format_code || props.basket.doc_format_code || pos?.doc_format_code || '',
    form_code: props.orderData.form_code || props.basket.form_code || '',
    branch_code: pos?.branch_code || '',
    cust_code: props.orderData.cust_code || 'AR0269',
    emp_code: props.orderData.sale_code,
    shelf_code: pos?.pos_ic_shelf || '',
    remark: props.orderData.order_remark || '',
    inquiry_type: props.orderData.inquiry_type,
    credit_day: props.orderData.credit_day ?? null,
    credit_date: props.orderData.credit_date || '',
    vat_type: props.orderData.vat_type,
    vat_rate: props.orderData.vat_rate,
    discount_type: posStore.erpOption?.discout_type ?? 0,
    discount_word: props.orderData.discount_word,
    total_value: props.orderData.total_value,
    total_discount: props.orderData.total_discount,
    total_before_vat: props.orderData.total_before_vat ?? null,
    total_vat_value: props.orderData.vat_value ?? null,
    total_after_vat: props.orderData.total_after_vat ?? null,
    total_except_vat: props.orderData.total_except_vat ?? 0,
    total_amount: props.orderData.total_amount ?? null,
    total_net_amount: props.orderData.total_amount,
    cash_amount: cashEntries.reduce((s, e) => s + e.amount, 0),
    rounded_amount: roundedAmount.value || 0,
    total_income_amount: roundedAmount.value || 0,
    tranfer_amount: transfers.reduce((s, e) => s + e.amount, 0),
    card_amount: credits.reduce((s, e) => s + e.amount, 0),
    deposit_amount: deposits.reduce((s, e) => s + e.amount, 0),
    total_credit_charge: credits.reduce((s, e) => s + e.details.charge, 0),
    tiger_pending: tigerPending,
    tiger_order_id: tigerPending ? tigerId.value : '',
    tiger_ref1: tigerPending ? tigerRef1.value : '',
    tiger_ref2: tigerPending ? tigerRef2.value : '',
    tiger_amount: tigerPending ? tigerPayAmount.value : paymentEntries.value.filter(e => e.type === 'tiger').reduce((s, e) => s + e.amount, 0),
    wallet_amount: 0,
    payment_detail: [
      ...transfers.map(e => ({
        pay_type: '0',
        pay_amount: e.amount,
        trans_number: e.details.pass_book_code,
        bank_code: e.details.bank_code,
        bank_branch: e.details.bank_branch,
        transfer_date: e.details.transfer_date,
        charge: 0,
      })),
      ...credits.map(e => ({
        pay_type: '21',
        pay_amount: e.amount,
        trans_number: e.details.card_number,
        no_approved: e.details.no_approved,
        credit_card_type: e.details.credit_card_type,
        charge: e.details.charge,
      })),
      ...deposits.map(e => ({
        pay_type: String(e.details.doc_type),
        doc_type: Number(e.details.doc_type),
        pay_amount: e.amount,
        trans_number: e.details.trans_number,
        remark: e.details.type_label || '',
        charge: 0,
      })),
    ],
    items: cartStore.items.map(item => {
      const fresh = props.orderData.fresh_prices[item.guid_code] || {}
      const unitPrice = Number(fresh.price ?? 0)
      const discWord = fresh.default_discount || ''
      const { discount_amount, sum_amount } = calcDiscountAmount(unitPrice, item.qty, discWord)
      return {
        item_code: item.item_code,
        item_name: item.item_name,
        unit_code: item.unit_code,
        qty: item.qty,
        price: unitPrice,
        sum_amount,
        discount: discWord,
        discount_amount,
        tax_type: Number(item.tax_type ?? 0),
        wh_code: item.wh_code || pos?.pos_ic_wht || '',
        shelf_code: item.shelf_code || pos?.pos_ic_shelf || '',
        stand_value: item.stand_value ?? 1,
        divide_value: item.divide_value ?? 1,
        ratio: item.ratio ?? 1,
        barcode: item.barcode || '',
        item_type: String(item.item_type ?? '0'),
        sub_item: isSetItem(item) ? setSubItems(item) : [],
      }
    }),
  }
}

async function save(options = {}) {
  saving.value = true
  saveError.value = ''
  try {
    await cartStore.hydrateSetItems(cartStore.items)
    const result = await saveTrans(buildSaveBody(options))
    if (result.success) {
      emit('complete', result.doc_no)
    } else {
      saveError.value = result.msg || 'บันทึกไม่สำเร็จ'
    }
  } catch (ex) {
    const data = ex?.response?.data
    if (Array.isArray(data?.stock_issues) && data.stock_issues.length > 0) {
      const detail = stockIssueSummary(data.stock_issues)
      saveError.value = detail
        ? `สินค้าในตะกร้าสต๊อกไม่พอ: ${detail}`
        : 'สินค้าในตะกร้าสต๊อกไม่พอ'
      toast.add({
        severity: 'warn',
        summary: 'บันทึกไม่ได้',
        detail: 'สินค้าในตะกร้าสต๊อกไม่พอ กรุณากลับไปปรับรายการ',
        life: 3500,
      })
    } else {
      saveError.value = ex.message || 'เกิดข้อผิดพลาด'
    }
  } finally {
    saving.value = false
  }
}

async function saveTigerPending() {
  if (!tigerId.value) return
  clearInterval(tigerPollInterval.value)
  await save({ tigerPending: true })
}
</script>

<template>
  <div class="payment-view">
    <!-- Header -->
    <div class="payment-header">
      <Button icon="pi pi-arrow-left" text rounded size="small" @click="emit('back')" aria-label="กลับ" />
      <span class="header-title">รับชำระเงิน</span>
    </div>

    <!-- ─── ขายเชื่อ ─────────────────────────────────────────────────────── -->
    <template v-if="isCreditSale">
      <div class="credit-body">
        <div class="credit-total-card">
          <div class="credit-total-label">ยอดที่ต้องชำระ</div>
          <div class="credit-total-value">{{ formatCurrency(totalDue) }}</div>
          <div class="credit-badge">
            <i class="pi pi-credit-card" />
            {{ saleTypeLabel }}
          </div>
        </div>
        <div class="credit-term-card">
          <div>
            <span>จำนวนวันเครดิต</span>
            <strong>{{ Number(orderData.credit_day || 0) }} วัน</strong>
          </div>
          <div>
            <span>วันที่เครดิต</span>
            <strong>{{ formatCreditDate(orderData.credit_date) }}</strong>
          </div>
        </div>
      </div>
    </template>

    <!-- ─── ขายสด ─────────────────────────────────────────────────────────── -->
    <template v-else>
      <!-- Summary bar -->
      <div class="summary-bar">
        <div class="summary-item">
          <span class="summary-label">ยอดสุทธิ</span>
          <span class="summary-total">{{ formatCurrency(totalDue) }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">ชำระแล้ว</span>
          <span class="summary-paid">{{ formatCurrency(totalPaid) }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">{{ change > 0 ? 'เงินทอน' : 'คงเหลือ' }}</span>
          <span :class="change > 0 ? 'summary-change' : 'summary-remaining'">
            {{ formatCurrency(change > 0 ? change : remaining) }}
          </span>
        </div>
      </div>

      <!-- ปัดเศษ -->
      <div class="rounding-bar">
        <label class="rounding-label">
          <i class="pi pi-percentage" />
          ปัดเศษ
        </label>
        <InputNumber
          v-model="roundedAmount"
          :min="0"
          :max-fraction-digits="2"
          :min-fraction-digits="2"
          suffix=" บาท"
          class="rounding-input"
          size="small"
        />
        <button
          v-if="remaining > 0 && remaining < 1"
          class="rounding-fill-btn"
          @click="roundedAmount = rnd((roundedAmount || 0) + remaining, 2)"
        >เติมเศษ {{ formatCurrency(remaining) }}</button>
      </div>

      <!-- Payment entries list -->
      <div class="entries-section">
        <div v-if="paymentEntries.length === 0" class="entries-empty">ยังไม่มีรายการชำระเงิน</div>
        <div v-else class="entries-list">
          <div v-for="entry in paymentEntries" :key="entry.id" class="entry-row">
            <div class="entry-icon-wrap">
              <i :class="paymentEntryIcon(entry.type)" class="entry-icon" />
            </div>
            <div class="entry-info">
              <div class="entry-label">{{ entry.label }}</div>
              <div v-if="entry.type === 'credit'" class="entry-sub">
                ค่าธรรมเนียม {{ formatCurrency(entry.details.charge) }} / รวม {{ formatCurrency(entry.details.sum_amount) }}
              </div>
              <div v-else-if="entry.type === 'deposit'" class="entry-sub">
                {{ entry.details.type_label || 'เงินล่วงหน้า/มัดจำ' }} {{ entry.details.trans_number }}
              </div>
            </div>
            <span class="entry-amount">{{ formatCurrency(entry.amount) }}</span>
            <Button icon="pi pi-times" text rounded size="small" class="entry-remove" @click="removeEntry(entry.id)" />
          </div>
        </div>
      </div>

      <!-- Add payment panel -->
      <div class="add-payment-panel">
        <!-- Type tabs -->
        <div class="type-tabs">
          <button
            v-for="tab in paymentTabs"
            :key="tab.key"
            class="type-tab"
            :class="{ 'type-tab-active': activeType === tab.key }"
            @click="activeType = tab.key"
          >
            <i :class="tab.icon" />
            {{ tab.label }}
          </button>
        </div>

        <div class="type-form">
          <!-- เงินสด -->
          <template v-if="activeType === 'cash'">
            <!-- denomination shortcuts -->
            <div class="denom-row">
              <button
                v-for="d in DENOMS"
                :key="d"
                class="denom-btn"
                @click="addDenom(d)"
              >฿{{ d >= 1000 ? (d / 1000) + 'K' : d }}</button>
              <button
                class="denom-btn denom-exact"
                :disabled="remaining <= 0"
                @click="cashAmount = remaining"
              >พอดี</button>
            </div>
            <div class="form-row">
              <label class="form-label">จำนวนรับ</label>
              <InputNumber
                v-model="cashAmount"
                :min="0"
                :max-fraction-digits="2"
                :min-fraction-digits="2"
                suffix=" บาท"
                class="form-input"
                size="small"
              />
            </div>
            <Button label="เพิ่มรายการ" icon="pi pi-plus" size="small" class="add-btn" @click="addCash" :disabled="!cashAmount || cashAmount <= 0" />
          </template>

          <!-- โอน -->
          <template v-else-if="activeType === 'transfer'">
            <div class="form-row">
              <label class="form-label">วันที่โอน</label>
              <InputText v-model="transferDate" type="date" class="form-input" size="small" />
            </div>
            <div class="form-row">
              <label class="form-label">สมุดเงินฝาก</label>
              <Select
                v-model="transferPassBook"
                :options="passBooks"
                option-label="book_name"
                placeholder="เลือกสมุดเงินฝาก"
                class="form-input"
                size="small"
              >
                <template #option="{ option }">
                  <div class="book-option">
                    <div class="book-name">{{ option.book_name }}</div>
                    <div class="book-sub">{{ option.bank_name || option.bank_code }} {{ option.branch_name ? '/ ' + option.branch_name : '' }}</div>
                  </div>
                </template>
                <template #value="{ value }">
                  <span v-if="value">{{ value.book_name }} ({{ value.bank_name || value.bank_code }})</span>
                  <span v-else class="placeholder-text">เลือกสมุดเงินฝาก</span>
                </template>
              </Select>
            </div>
            <div class="form-row">
              <label class="form-label">จำนวนเงิน</label>
              <InputNumber
                v-model="transferAmount"
                :min="0"
                :max-fraction-digits="2"
                :min-fraction-digits="2"
                suffix=" บาท"
                class="form-input"
                size="small"
              />
            </div>
            <button v-if="remaining > 0" class="fill-remaining-btn" @click="transferAmount = remaining">
              คงเหลือ {{ formatCurrency(remaining) }}
            </button>
            <Button label="เพิ่มรายการ" icon="pi pi-plus" size="small" class="add-btn" @click="addTransfer" :disabled="!transferPassBook || !transferAmount || transferAmount <= 0" />
          </template>

          <!-- บัตรเครดิต -->
          <template v-else-if="activeType === 'credit'">
            <div class="form-row">
              <label class="form-label">ประเภทบัตร</label>
              <Select
                v-model="selectedCreditType"
                :options="creditTypes"
                option-label="name_1"
                placeholder="เลือกประเภทบัตร"
                class="form-input"
                size="small"
              >
                <template #option="{ option }">
                  <div class="ct-option">
                    <span class="ct-name">{{ option.name_1 }}</span>
                    <span class="ct-rate">{{ option.charge_rate }}%</span>
                  </div>
                </template>
              </Select>
            </div>
            <div class="form-row">
              <label class="form-label">เลขที่บัตร</label>
              <InputText v-model="creditCardNumber" placeholder="เลขที่บัตรเครดิต" class="form-input" size="small" />
            </div>
            <div class="form-row">
              <label class="form-label">เลขที่อนุมัติ</label>
              <InputText v-model="creditApprovalNo" placeholder="รหัสอนุมัติ" class="form-input" size="small" />
            </div>
            <div class="form-row">
              <label class="form-label">จำนวนเงิน</label>
              <InputNumber
                v-model="creditAmount"
                :min="0"
                :max-fraction-digits="2"
                :min-fraction-digits="2"
                suffix=" บาท"
                class="form-input"
                size="small"
              />
            </div>
            <button v-if="remaining > 0" class="fill-remaining-btn" @click="creditAmount = remaining">
              คงเหลือ {{ formatCurrency(remaining) }}
            </button>
            <div v-if="selectedCreditType && creditAmount > 0" class="credit-calc">
              <div class="calc-row">
                <span class="calc-label">ค่าธรรมเนียม ({{ creditChargeRate }}%)</span>
                <span class="calc-value">{{ formatCurrency(creditCharge) }}</span>
              </div>
              <div class="calc-row calc-total">
                <span class="calc-label">รวมทั้งสิ้น</span>
                <span class="calc-value">{{ formatCurrency(creditSumAmount) }}</span>
              </div>
            </div>
            <Button label="เพิ่มรายการ" icon="pi pi-plus" size="small" class="add-btn" @click="addCredit" :disabled="!selectedCreditType || !creditAmount || creditAmount <= 0" />
          </template>

          <!-- เงินล่วงหน้า/มัดจำ -->
          <template v-else-if="activeType === 'deposit'">
            <div class="deposit-panel">
              <div v-if="!customerCode" class="deposit-empty">
                ต้องเลือกลูกค้าก่อนใช้เงินล่วงหน้า/มัดจำ
              </div>
              <template v-else>
                <div class="deposit-toolbar">
                  <div>
                    <div class="deposit-title">เงินล่วงหน้า/มัดจำคงเหลือ</div>
                    <div class="deposit-subtitle">{{ customerCode }}</div>
                  </div>
                  <Button
                    icon="pi pi-refresh"
                    text
                    rounded
                    size="small"
                    :loading="advanceDepositLoading"
                    @click="loadAdvanceDepositBalance(true)"
                  />
                </div>

                <div v-if="advanceDepositError" class="deposit-error">
                  <i class="pi pi-exclamation-circle" />
                  {{ advanceDepositError }}
                </div>
                <div v-else-if="advanceDepositLoading" class="deposit-empty">
                  กำลังโหลดเอกสาร...
                </div>
                <div v-else-if="advanceDepositRows.length === 0" class="deposit-empty">
                  ไม่มีเงินล่วงหน้า/มัดจำคงเหลือ
                </div>
                <template v-else>
                  <div class="form-row">
                    <label class="form-label">เอกสาร</label>
                    <Select
                      v-model="selectedAdvanceDeposit"
                      :options="advanceDepositOptions"
                      option-label="display_label"
                      placeholder="เลือกเอกสาร"
                      class="form-input"
                      size="small"
                    >
                      <template #option="{ option }">
                        <div class="deposit-option">
                          <span>{{ advanceDepositLabel(option) }}</span>
                          <strong>{{ formatCurrency(advanceDepositAvailable(option)) }}</strong>
                        </div>
                      </template>
                      <template #value="{ value }">
                        <span v-if="value">{{ advanceDepositLabel(value) }}</span>
                        <span v-else class="placeholder-text">เลือกเอกสาร</span>
                      </template>
                    </Select>
                  </div>
                  <div class="form-row">
                    <label class="form-label">ยอดใช้</label>
                    <InputNumber
                      v-model="advanceDepositAmount"
                      :min="0"
                      :max="selectedAdvanceDepositBalance"
                      :max-fraction-digits="2"
                      :min-fraction-digits="2"
                      suffix=" บาท"
                      class="form-input"
                      size="small"
                    />
                  </div>
                  <div class="deposit-actions">
                    <button
                      class="fill-remaining-btn"
                      :disabled="!selectedAdvanceDeposit || selectedAdvanceDepositBalance <= 0"
                      @click="fillAdvanceDepositAmount()"
                    >
                      ใช้เท่าคงค้าง {{ selectedAdvanceDeposit ? formatCurrency(Math.min(selectedAdvanceDepositBalance, remaining || selectedAdvanceDepositBalance)) : '' }}
                    </button>
                    <Button
                      label="เพิ่มรายการ"
                      icon="pi pi-plus"
                      size="small"
                      class="add-btn"
                      :disabled="!selectedAdvanceDeposit || !advanceDepositAmount || advanceDepositAmount <= 0"
                      @click="addAdvanceDeposit()"
                    />
                  </div>

                  <div class="deposit-doc-list">
                    <button
                      v-for="row in advanceDepositRows"
                      :key="`${row.doc_type}-${row.doc_no}`"
                      class="deposit-doc-card"
                      :disabled="advanceDepositAvailable(row) <= 0 || remaining <= 0"
                      @click="fillAdvanceDepositAmount(row)"
                    >
                      <span class="deposit-doc-type">{{ row.type_label }}</span>
                      <strong>{{ row.doc_no }}</strong>
                      <span>{{ formatCreditDate(row.doc_date) }}</span>
                      <em>{{ formatCurrency(advanceDepositAvailable(row)) }}</em>
                    </button>
                  </div>
                </template>
              </template>
            </div>
          </template>

          <!-- Tiger -->
          <template v-else-if="activeType === 'tiger'">
            <div class="tiger-panel">

              <!-- idle: แสดงปุ่มส่งคำสั่ง -->
              <div v-if="tigerStatus === 'idle'" class="tiger-idle">
                <div class="tiger-amount-label">ยอดชำระ</div>
                <div class="tiger-amount-value">{{ formatCurrency(tigerPayAmount) }}</div>
                <Button label="ส่งคำสั่งชำระที่เครื่อง Tiger" icon="pi pi-desktop" class="w-full" @click="startTigerPayment" />
              </div>

              <!-- requesting: กำลังสร้าง order -->
              <div v-else-if="tigerStatus === 'requesting'" class="tiger-status">
                <i class="pi pi-spin pi-spinner tiger-spinner" />
                <span>กำลังส่งคำสั่งไปเครื่อง Tiger...</span>
              </div>

              <!-- waiting / processing: แสดงในรูปแบบ Dialog กลางจอ ปิดไม่ได้ — ดูด้านล่าง -->
              <div v-else-if="tigerStatus === 'waiting' || tigerStatus === 'processing'" class="tiger-status">
                <i class="pi pi-spin pi-spinner tiger-spinner" />
                <span>กำลังรอการชำระเงินที่เครื่อง Tiger...</span>
              </div>

              <!-- success: ชำระสำเร็จ กำลัง save -->
              <div v-else-if="tigerStatus === 'success'" class="tiger-status tiger-success">
                <i class="pi pi-check-circle tiger-check" />
                <span>ชำระเงินสำเร็จ กำลังบันทึก...</span>
              </div>

              <!-- cancel: Tiger ยกเลิกจากเครื่อง -->
              <div v-else-if="tigerStatus === 'cancel'" class="tiger-status tiger-error">
                <i class="pi pi-times-circle tiger-err-icon" />
                <span>การชำระเงินถูกยกเลิกจากเครื่อง Tiger</span>
                <Button label="ลองใหม่" size="small" severity="secondary" @click="tigerStatus = 'idle'" />
              </div>

              <!-- failed: ล้มเหลว -->
              <div v-else class="tiger-status tiger-error">
                <i class="pi pi-times-circle tiger-err-icon" />
                <span>{{ tigerError || 'การชำระเงินล้มเหลว' }}</span>
                <Button label="ลองใหม่" size="small" severity="secondary" @click="tigerStatus = 'idle'" />
              </div>

            </div>
          </template>
        </div>
      </div>
    </template>

    <!-- Tiger payment dialog: กลางจอ, ปิดไม่ได้จนกว่าจะยกเลิก/สำเร็จ/ถูกยกเลิกจากเครื่อง -->
    <Dialog
      :visible="tigerStatus === 'waiting' || tigerStatus === 'processing'"
      modal
      :closable="false"
      :close-on-escape="false"
      :draggable="false"
      :header="TIGER_MOCK ? '🧪 TEST MODE — กรุณาชำระที่เครื่องรับเงิน' : 'กรุณาชำระที่เครื่องรับเงิน'"
      :style="{ width: '420px', maxWidth: '95vw' }"
    >
      <div class="tiger-dialog-body">
        <div v-if="TIGER_MOCK" class="tiger-mock-banner">
          กำลังจำลองการชำระเงิน — จะสำเร็จอัตโนมัติใน ~5 วินาที (ไม่มีการเรียก API จริง)
        </div>
        <i class="pi pi-spin pi-spinner tiger-spinner" />
        <div class="tiger-amount-value">{{ formatCurrency(tigerPayAmount) }}</div>
        <div class="tiger-info-box">
          <div class="tiger-info-row">
            <span class="tiger-info-label">Transaction ID:</span>
            <span class="tiger-info-val">{{ tigerId }}</span>
          </div>
          <div class="tiger-info-row">
            <span class="tiger-info-label">รหัส:</span>
            <span class="tiger-info-val">{{ posStore.posId }} - {{ orderData.cust_name || 'ลูกค้าทั่วไป' }}</span>
          </div>
        </div>
      </div>
      <template #footer>
        <Button
          label="ปิดเอกสารไว้ก่อน"
          severity="warning"
          icon="pi pi-clock"
          :loading="saving"
          :disabled="saving"
          @click="saveTigerPending"
        />
        <Button
          v-if="tigerCancel"
          label="ยกเลิก"
          severity="secondary"
          icon="pi pi-times"
          :disabled="saving"
          @click="cancelTiger"
        />
      </template>
    </Dialog>

    <!-- Footer -->
    <div class="payment-footer">
      <div v-if="saveError" class="save-error">
        <i class="pi pi-exclamation-circle" />
        {{ saveError }}
      </div>
      <Button
        :label="saving ? 'กำลังบันทึก...' : 'บันทึกเอกสาร'"
        icon="pi pi-check"
        icon-pos="right"
        :loading="saving"
        :disabled="!canSave"
        class="w-full"
        size="large"
        @click="save"
      />
    </div>
  </div>
</template>

<style scoped>
.payment-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
}

.payment-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--p-surface-border);
  flex-shrink: 0;
}

.header-title {
  font-size: 1.05rem;
  font-weight: 600;
}

/* ─── ขายเชื่อ ─── */
.credit-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 2rem 1rem;
}

.credit-total-card {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.credit-total-label {
  font-size: 0.95rem;
  color: var(--p-text-color-secondary);
}

.credit-total-value {
  font-size: 2.25rem;
  font-weight: 700;
  color: var(--p-primary-color);
}

.credit-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  padding: 0.3rem 0.85rem;
  font-size: 0.83rem;
  font-weight: 500;
}

/* ─── Summary bar ─── */
.credit-term-card {
  width: min(100%, 360px);
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  background: #eff6ff;
  padding: 0.75rem;
}

.credit-term-card div {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.credit-term-card span {
  color: var(--p-text-color-secondary);
  font-size: 0.75rem;
}

.credit-term-card strong {
  color: var(--p-text-color);
  font-size: 0.98rem;
}

.summary-bar {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: var(--p-surface-ground);
  border-bottom: 1px solid var(--p-surface-border);
  flex-shrink: 0;
  gap: 0.5rem;
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  flex: 1;
}

.summary-label {
  font-size: 0.72rem;
  color: var(--p-text-color-secondary);
}

.summary-total {
  font-size: 1rem;
  font-weight: 700;
  color: var(--p-primary-color);
}

.summary-paid {
  font-size: 1rem;
  font-weight: 600;
  color: #16a34a;
}

.summary-remaining {
  font-size: 1rem;
  font-weight: 600;
  color: #dc2626;
}

.summary-change {
  font-size: 1rem;
  font-weight: 600;
  color: #16a34a;
}

/* ─── ปัดเศษ ─── */
.rounding-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--p-surface-0, #fff);
  border-bottom: 1px solid var(--p-surface-border);
  flex-shrink: 0;
}

.rounding-label {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.83rem;
  color: var(--p-text-color-secondary);
  flex-shrink: 0;
}

.rounding-input {
  flex: 1;
  min-width: 0;
  max-width: 10rem;
}

.rounding-fill-btn {
  border: 1px dashed var(--p-primary-color);
  border-radius: 6px;
  background: transparent;
  color: var(--p-primary-color);
  font-size: 0.78rem;
  font-weight: 500;
  padding: 0.25rem 0.625rem;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
  transition: background 0.12s;
}

.rounding-fill-btn:hover {
  background: var(--p-primary-50, #eff6ff);
}

/* ─── Entries list ─── */
.entries-section {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding: 0.5rem 1rem;
}

.entries-empty {
  text-align: center;
  color: var(--p-text-color-secondary);
  font-size: 0.85rem;
  padding: 1.5rem 0;
}

.entries-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.entry-row {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  background: var(--p-surface-ground);
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
}

.entry-icon-wrap {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--p-surface-200, #e2e8f0);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.entry-icon { font-size: 0.85rem; color: var(--p-text-color-secondary); }

.entry-info {
  flex: 1;
  min-width: 0;
}

.entry-label {
  font-size: 0.875rem;
  font-weight: 500;
}

.entry-sub {
  font-size: 0.72rem;
  color: var(--p-text-color-secondary);
  margin-top: 1px;
}

.entry-amount {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--p-primary-color);
  flex-shrink: 0;
}

.entry-remove { flex-shrink: 0; }

/* ─── Add payment panel ─── */
.add-payment-panel {
  border-top: 1px solid var(--p-surface-border);
  flex-shrink: 0;
  background: var(--p-surface-0, #fff);
  max-height: 50vh;
  overflow-y: auto;
}

.type-tabs {
  display: flex;
  border-bottom: 1px solid var(--p-surface-border);
  overflow-x: auto;
}

.type-tab {
  flex: 1;
  min-width: 6.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.625rem 0.5rem;
  border: none;
  background: none;
  font-size: 0.83rem;
  color: var(--p-text-color-secondary);
  cursor: pointer;
  font-family: inherit;
  border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
}

.type-tab-active {
  color: var(--p-primary-color);
  border-bottom-color: var(--p-primary-color);
  font-weight: 600;
}

.type-tab .pi { font-size: 0.78rem; }

.type-form {
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.form-label {
  font-size: 0.83rem;
  color: var(--p-text-color-secondary);
  width: 6rem;
  flex-shrink: 0;
}

.form-input {
  flex: 1;
  min-width: 0;
}

.add-btn {
  align-self: flex-end;
}

/* denomination shortcuts */
.denom-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.denom-btn {
  flex: 1;
  min-width: 3rem;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 6px;
  background: var(--p-surface-ground);
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--p-text-color);
  cursor: pointer;
  font-family: inherit;
  transition: background 0.12s, border-color 0.12s;
}

.denom-btn:hover:not(:disabled) {
  background: var(--p-primary-50, #eff6ff);
  border-color: var(--p-primary-color);
  color: var(--p-primary-color);
}

.denom-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.denom-exact {
  background: var(--p-primary-color);
  border-color: var(--p-primary-color);
  color: #fff;
}

.denom-exact:hover:not(:disabled) {
  background: var(--p-primary-600, #2563eb);
  border-color: var(--p-primary-600, #2563eb);
  color: #fff;
}

/* fill remaining button */
.fill-remaining-btn {
  align-self: flex-start;
  border: 1px dashed var(--p-primary-color);
  border-radius: 6px;
  background: transparent;
  color: var(--p-primary-color);
  font-size: 0.78rem;
  font-weight: 500;
  padding: 0.25rem 0.625rem;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.12s;
}

.fill-remaining-btn:hover {
  background: var(--p-primary-50, #eff6ff);
}

/* credit calc */
.credit-calc {
  background: var(--p-surface-ground);
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.calc-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.82rem;
  color: var(--p-text-color-secondary);
}

.calc-total .calc-label,
.calc-total .calc-value {
  font-weight: 600;
  color: var(--p-text-color);
}

/* advance/deposit */
.deposit-panel {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.deposit-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  background: var(--p-surface-ground);
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  padding: 0.65rem 0.75rem;
}

.deposit-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--p-text-color);
}

.deposit-subtitle {
  margin-top: 0.1rem;
  font-size: 0.75rem;
  color: var(--p-text-color-secondary);
}

.deposit-empty,
.deposit-error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 4.25rem;
  border: 1px dashed var(--p-surface-border);
  border-radius: 8px;
  color: var(--p-text-color-secondary);
  font-size: 0.86rem;
  text-align: center;
  padding: 0.75rem;
}

.deposit-error {
  border-color: #fecaca;
  background: #fef2f2;
  color: #b91c1c;
}

.deposit-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.deposit-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  width: 100%;
}

.deposit-option strong {
  color: var(--p-primary-color);
  white-space: nowrap;
}

.deposit-doc-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

.deposit-doc-card {
  min-height: 5.75rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  background: var(--p-surface-0, #fff);
  color: var(--p-text-color);
  padding: 0.65rem;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.25rem 0.5rem;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
}

.deposit-doc-card:hover:not(:disabled) {
  border-color: var(--p-primary-color);
  background: var(--p-primary-50, #eff6ff);
}

.deposit-doc-card:disabled {
  opacity: 0.5;
  cursor: default;
}

.deposit-doc-card strong {
  font-size: 0.88rem;
  overflow: hidden;
  text-overflow: ellipsis;
}

.deposit-doc-card span {
  font-size: 0.75rem;
  color: var(--p-text-color-secondary);
}

.deposit-doc-card em {
  grid-column: 2;
  grid-row: 1 / span 3;
  align-self: center;
  color: var(--p-primary-color);
  font-style: normal;
  font-weight: 700;
  white-space: nowrap;
}

.deposit-doc-type {
  font-weight: 600;
  color: #0f766e !important;
}

@media (max-width: 640px) {
  .deposit-doc-list {
    grid-template-columns: 1fr;
  }
}

/* book / credit type option */
.book-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.book-name { font-size: 0.875rem; font-weight: 500; }
.book-sub { font-size: 0.72rem; color: var(--p-text-color-secondary); }

.ct-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  width: 100%;
}

.ct-name { font-size: 0.875rem; }
.ct-rate { font-size: 0.78rem; color: var(--p-text-color-secondary); }

.placeholder-text { color: var(--p-text-color-secondary); }

/* ─── Footer ─── */
.payment-footer {
  border-top: 2px solid var(--p-surface-border);
  padding: 0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom));
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: var(--p-surface-0, #fff);
  position: sticky;
  bottom: 0;
  z-index: 5;
}

.save-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.83rem;
  color: #dc2626;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
}

.w-full { width: 100%; }

/* ─── Tiger ─── */
.tiger-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
}

.tiger-idle {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
}

.tiger-amount-label {
  font-size: 0.83rem;
  color: var(--p-text-color-secondary);
}

.tiger-amount-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--p-primary-color);
}

.tiger-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.625rem;
  text-align: center;
  font-size: 0.9rem;
}

.tiger-spinner {
  font-size: 1.75rem;
  color: var(--p-primary-color);
}

.tiger-wait-text {
  font-size: 0.9rem;
  color: var(--p-text-color-secondary);
}

.tiger-success {
  color: #16a34a;
}

.tiger-check {
  font-size: 2rem;
  color: #16a34a;
}

.tiger-error {
  color: #dc2626;
}

.tiger-err-icon {
  font-size: 2rem;
  color: #dc2626;
}

.tiger-info-box {
  width: 100%;
  background: var(--p-surface-ground);
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  padding: 0.625rem 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.tiger-info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.82rem;
}

.tiger-info-label {
  color: var(--p-text-color-secondary);
  flex-shrink: 0;
}

.tiger-info-val {
  font-weight: 600;
  color: var(--p-text-color);
  text-align: right;
  word-break: break-all;
}

.tiger-dialog-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 0.25rem 0.25rem;
}

.tiger-dialog-body .tiger-spinner {
  font-size: 2rem;
  color: var(--p-primary-color);
}

.tiger-dialog-body .tiger-amount-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--p-text-color);
}

.tiger-dialog-body .tiger-info-box {
  width: 100%;
}

.tiger-mock-banner {
  width: 100%;
  background: #fff7e6;
  color: #ad6800;
  border: 1px dashed #ffa940;
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  font-size: 0.8rem;
  text-align: center;
}
</style>
