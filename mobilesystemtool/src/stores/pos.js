import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getPOSList, getErpOption } from '@/services/posService'
import { savePos, loadPos, saveErpOption, loadErpOption } from '@/utils/session'

export const usePosStore = defineStore('pos', () => {
  const selectedPos = ref(null)
  const erpOption = ref(null)
  const posList = ref([])

  const hasPos = computed(() => selectedPos.value !== null)
  const posId = computed(() => selectedPos.value?.pos_id ?? '')

  function restorePos() {
    const pos = loadPos()
    if (pos) selectedPos.value = pos
    const erp = loadErpOption()
    if (erp) erpOption.value = erp
  }

  async function loadPosList() {
    posList.value = await getPOSList()
  }

  function selectPos(posData) {
    selectedPos.value = posData
    savePos(posData)
  }

  async function refreshErpOption() {
    const erp = await getErpOption()
    erpOption.value = erp
    saveErpOption(erp)
  }

  function clearPos() {
    selectedPos.value = null
    erpOption.value = null
    posList.value = []
  }

  return { selectedPos, erpOption, posList, hasPos, posId, restorePos, loadPosList, selectPos, refreshErpOption, clearPos }
})
