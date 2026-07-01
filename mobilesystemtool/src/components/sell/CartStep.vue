<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Checkbox from 'primevue/checkbox'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import { useToast } from 'primevue/usetoast'
import CartItemsStep from './CartItemsStep.vue'
import CartConfirmStep from './CartConfirmStep.vue'
import CartPriceCheckStep from './CartPriceCheckStep.vue'
import CartPaymentStep from './CartPaymentStep.vue'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { setBasketInfo } from '@/services/basketService'
import { deleteDocImage, getDocImageUrl, getDocImagesList, saveDocImage } from '@/services/docImageService'
import { getSalePrintForms, getSalePrintUrl } from '@/services/salesService'
import { getEnabledSaleDocumentTypes, getSaleDocumentType } from '@/utils/saleDocumentTypes'

const props = defineProps({
  basket: { type: Object, required: true },
})
const emit = defineEmits(['back', 'done'])

const cartStore = useCartStore()
const authStore = useAuthStore()
const toast = useToast()
const subStep = ref('items')
const currentBasket = ref({ ...props.basket })
const documentTypes = getEnabledSaleDocumentTypes()
const selectedDocumentTypeKey = ref(documentTypes[0]?.key || 'sale')
const selectedDocumentType = computed(() => getSaleDocumentType(selectedDocumentTypeKey.value))

const confirmedInfo = ref(null)
const orderData = ref(null)
const completedDocNo = ref('')
const docImages = ref([])
const imageUploading = ref(false)
const imageError = ref('')
const printDialogVisible = ref(false)
const printLoading = ref(false)
const printError = ref('')
const printForms = ref([])
const selectedPrintForms = ref([])
const basketInfoSaving = ref(false)

const DONE_KEY = 'cart_done_state'

watch(
  () => props.basket,
  (basket) => {
    currentBasket.value = { ...basket }
  },
  { deep: true },
)

onMounted(async () => {
  const saved = sessionStorage.getItem(DONE_KEY)
  if (saved) {
    try {
      const state = JSON.parse(saved)
      completedDocNo.value = state.docNo || ''
      subStep.value = 'done'
      await loadDocImages()
    } catch {}
  }
})

function onItemsNext() {
  subStep.value = 'confirm'
}

function onConfirmBack() {
  subStep.value = 'items'
}

async function onConfirmDone(info) {
  if (basketInfoSaving.value) return

  const mergedBasket = {
    ...currentBasket.value,
    ...info,
  }

  basketInfoSaving.value = true
  try {
    await setBasketInfo({
      basket_id: currentBasket.value.basket_id,
      ...info,
    })
    currentBasket.value = mergedBasket
    confirmedInfo.value = info
    subStep.value = 'price-check'
  } catch (ex) {
    toast.add({
      severity: 'error',
      summary: 'บันทึกข้อมูลตะกร้าไม่สำเร็จ',
      detail: ex?.message || 'กรุณาลองอีกครั้ง',
      life: 3500,
    })
  } finally {
    basketInfoSaving.value = false
  }
}

function onPriceCheckBack() {
  subStep.value = 'confirm'
}

function onPriceCheckConfirm(data) {
  orderData.value = data
  subStep.value = 'payment'
}

async function onPaymentComplete(docNo) {
  cartStore.clearLocalCart()
  completedDocNo.value = docNo
  subStep.value = 'done'
  sessionStorage.setItem(DONE_KEY, JSON.stringify({ docNo }))
  await loadDocImages()
}

async function openPrintDialog() {
  if (!completedDocNo.value || printLoading.value) return
  printDialogVisible.value = true
  printLoading.value = true
  printError.value = ''
  printForms.value = []
  selectedPrintForms.value = []
  try {
    const result = await getSalePrintForms(completedDocNo.value)
    const forms = result?.forms || []
    printForms.value = forms
    selectedPrintForms.value = forms.filter((form) => form.available && form.is_default).map((form) => form.formcode)
    if (!selectedPrintForms.value.length) {
      selectedPrintForms.value = forms.filter((form) => form.available).slice(0, 1).map((form) => form.formcode)
    }
    if (!forms.length) {
      printError.value = 'เอกสารนี้ยังไม่ได้กำหนด form_code สำหรับพิมพ์'
    } else if (!selectedPrintForms.value.length) {
      printError.value = 'ไม่พบฟอร์มที่พร้อมใช้งานใน formdesign'
    }
  } catch (ex) {
    printError.value = ex.message || 'โหลดฟอร์มพิมพ์ไม่สำเร็จ'
  } finally {
    printLoading.value = false
  }
}

function confirmPrintForms() {
  if (!completedDocNo.value || !selectedPrintForms.value.length) return
  const url = getSalePrintUrl(completedDocNo.value, selectedPrintForms.value, authStore.employee?.user_code || '')
  window.open(url, '_blank', 'noopener')
  printDialogVisible.value = false
}

function onDone() {
  sessionStorage.removeItem(DONE_KEY)
  emit('done')
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

async function loadDocImages() {
  if (!completedDocNo.value) {
    docImages.value = []
    return
  }
  docImages.value = await getDocImagesList(completedDocNo.value)
}

async function onDocImageSelected(event) {
  const files = Array.from(event.target.files || [])
  if (!files.length || !completedDocNo.value) return

  imageUploading.value = true
  imageError.value = ''
  try {
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        throw new Error('กรุณาเลือกไฟล์รูปภาพเท่านั้น')
      }
      const imageFile = await fileToDataUrl(file)
      const result = await saveDocImage(completedDocNo.value, imageFile)
      if (!result.success) throw new Error(result.msg || 'บันทึกรูปไม่สำเร็จ')
    }
    await loadDocImages()
    event.target.value = ''
  } catch (ex) {
    imageError.value = ex.message || 'บันทึกรูปไม่สำเร็จ'
  } finally {
    imageUploading.value = false
  }
}

async function removeDocImage(guidCode) {
  if (!guidCode) return
  imageError.value = ''
  try {
    await deleteDocImage(guidCode)
    await loadDocImages()
  } catch (ex) {
    imageError.value = ex.message || 'ลบรูปไม่สำเร็จ'
  }
}
</script>

<template>
  <CartItemsStep
    v-if="subStep === 'items'"
    :basket="currentBasket"
    :document-types="documentTypes"
    :selected-document-type="selectedDocumentType"
    @update:selected-document-type="selectedDocumentTypeKey = $event"
    @back="emit('back')"
    @next="onItemsNext"
  />
  <CartConfirmStep
    v-else-if="subStep === 'confirm'"
    :basket="currentBasket"
    :confirmed-info="confirmedInfo"
    @back="onConfirmBack"
    @confirm="onConfirmDone"
  />
  <CartPriceCheckStep
    v-else-if="subStep === 'price-check'"
    :basket="currentBasket"
    :confirmed-info="confirmedInfo"
    :document-type="selectedDocumentType"
    @back="onPriceCheckBack"
    @confirm="onPriceCheckConfirm"
  />
  <CartPaymentStep
    v-else-if="subStep === 'payment'"
    :basket="currentBasket"
    :order-data="orderData"
    :document-type="selectedDocumentType"
    @back="subStep = 'price-check'"
    @complete="onPaymentComplete"
  />
  <div v-else-if="subStep === 'done'" class="done-view">
    <div class="done-card">
      <i class="pi pi-check-circle done-icon" />
      <div class="done-title">บันทึกเอกสารสำเร็จ</div>
      <div class="done-docno">{{ completedDocNo }}</div>
    </div>
    <div class="proof-section">
      <div class="proof-head">
        <div>
          <div class="proof-title">หลักฐานการโอน</div>
          <div class="proof-subtitle">บันทึกได้หลายรูปต่อบิล</div>
        </div>
        <label class="proof-upload-btn" :class="{ disabled: imageUploading }">
          <i class="pi pi-upload" />
          <span>{{ imageUploading ? 'กำลังบันทึก...' : 'เพิ่มรูป' }}</span>
          <input type="file" accept="image/*" multiple :disabled="imageUploading" @change="onDocImageSelected" />
        </label>
      </div>
      <div v-if="imageError" class="proof-error">
        <i class="pi pi-exclamation-circle" />
        {{ imageError }}
      </div>
      <div v-if="docImages.length" class="proof-grid">
        <div v-for="image in docImages" :key="image.guid_code" class="proof-item">
          <a :href="getDocImageUrl(image.guid_code)" target="_blank" rel="noopener">
            <img :src="getDocImageUrl(image.guid_code)" alt="หลักฐานการโอน" />
          </a>
          <button type="button" class="proof-remove" @click="removeDocImage(image.guid_code)" aria-label="ลบรูป">
            <i class="pi pi-times" />
          </button>
        </div>
      </div>
      <div v-else class="proof-empty">ยังไม่มีรูปหลักฐาน</div>
    </div>
    <div class="done-actions">
      <Button label="พิมพ์ฟอร์ม" icon="pi pi-print" outlined class="done-btn" @click="openPrintDialog" />
      <Button label="เสร็จสิ้น" icon="pi pi-home" class="done-btn" @click="onDone" />
    </div>
  </div>

  <Dialog
    :visible="printDialogVisible"
    header="เลือกฟอร์มสำหรับพิมพ์"
    modal
    :draggable="false"
    :style="{ width: 'min(460px, 95vw)' }"
    @update:visible="printDialogVisible = $event"
  >
    <div class="print-dialog-body">
      <div class="print-doc-no">{{ completedDocNo }}</div>
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
            :input-id="`done-print-form-${form.formcode}`"
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
      <Button
        label="พิมพ์"
        icon="pi pi-print"
        :disabled="printLoading || !selectedPrintForms.length"
        @click="confirmPrintForms"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.done-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 1.25rem;
  padding: 2rem 1.5rem;
  height: 100%;
  overflow-y: auto;
}

.done-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  text-align: center;
}

.done-icon {
  font-size: 3.5rem;
  color: #16a34a;
}

.done-title {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--p-text-color);
}

.done-docno {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--p-primary-color);
  letter-spacing: 0.05em;
}

.done-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  max-width: 18rem;
}

.done-btn {
  width: 100%;
}

.proof-section {
  width: 100%;
  max-width: 28rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  padding: 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: var(--p-surface-0, #fff);
}

.proof-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.proof-title {
  font-weight: 700;
  color: var(--p-text-color);
}

.proof-subtitle {
  font-size: 0.78rem;
  color: var(--p-text-color-secondary);
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
  font-weight: 600;
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
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: #dc2626;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  padding: 0.5rem 0.625rem;
  font-size: 0.83rem;
}

.proof-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
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
  width: 1.7rem;
  height: 1.7rem;
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

@media (max-width: 480px) {
  .proof-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .proof-upload-btn {
    width: 100%;
  }
}
</style>
