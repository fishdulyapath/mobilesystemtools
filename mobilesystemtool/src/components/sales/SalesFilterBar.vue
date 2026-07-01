<script setup>
import { ref, watch } from 'vue'
import { todayISO, toISO } from '@/utils/formatters'
import SelectButton from 'primevue/selectbutton'
import DatePicker from 'primevue/datepicker'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import Button from 'primevue/button'

defineProps({
  searchPlaceholder: {
    type: String,
    default: 'ค้นหา เลขที่เอกสาร / ลูกค้า / พนักงาน',
  },
})

const emit = defineEmits(['search'])

const presetOptions = [
  { label: 'วันนี้', value: 'today' },
  { label: '7 วัน', value: '7d' },
  { label: '30 วัน', value: '30d' },
  { label: 'กำหนดเอง', value: 'custom' },
]

const preset = ref('today')
const dateRange = ref(null)
const searchText = ref('')
let suppressAutoSearch = false

function buildParams() {
  const today = todayISO()
  if (searchText.value.trim()) {
    return { search: searchText.value.trim(), from_date: '', to_date: '' }
  }
  if (preset.value === 'today') {
    return { search: '', from_date: today, to_date: today }
  }
  if (preset.value === '7d') {
    const from = new Date(); from.setDate(from.getDate() - 6)
    return { search: '', from_date: toISO(from), to_date: today }
  }
  if (preset.value === '30d') {
    const from = new Date(); from.setDate(from.getDate() - 29)
    return { search: '', from_date: toISO(from), to_date: today }
  }
  if (preset.value === 'custom' && dateRange.value?.[0] && dateRange.value?.[1]) {
    return { search: '', from_date: toISO(dateRange.value[0]), to_date: toISO(dateRange.value[1]) }
  }
  return { search: '', from_date: today, to_date: today }
}

function doSearch() {
  emit('search', buildParams())
}

function resetFilters({ emitSearch = true } = {}) {
  suppressAutoSearch = true
  preset.value = 'today'
  dateRange.value = null
  searchText.value = ''
  suppressAutoSearch = false
  if (emitSearch) doSearch()
}

watch(preset, (val) => {
  if (suppressAutoSearch) return
  if (val !== 'custom') {
    dateRange.value = null
    searchText.value = ''
    doSearch()
  }
})

watch(dateRange, (val) => {
  if (suppressAutoSearch) return
  if (preset.value === 'custom' && val?.[1]) doSearch()
})

function onSearchInput(e) {
  if (!e.target.value.trim()) doSearch()
}

defineExpose({ initialSearch: doSearch, resetFilters })
</script>

<template>
  <div class="filter-bar">
    <div class="filter-top">
      <SelectButton
        v-model="preset"
        :options="presetOptions"
        option-label="label"
        option-value="value"
        :allow-empty="false"
      />
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
        <InputText
          v-model="searchText"
          :placeholder="searchPlaceholder"
          :disabled="preset !== 'today' && preset !== '7d' && preset !== '30d' && preset !== 'custom' && !searchText"
          @input="onSearchInput"
          @keyup.enter="doSearch"
        />
      </IconField>

      <Button icon="pi pi-search" label="ค้นหา" @click="doSearch" />
    </div>
  </div>
</template>

<style scoped>
.filter-bar {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--p-surface-card);
  border-radius: 8px;
  border: 1px solid var(--p-surface-border);
}

.filter-top,
.filter-bottom {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.date-picker {
  width: 220px;
}

.search-field {
  flex: 1;
  min-width: 200px;
}

.search-field :deep(input) {
  width: 100%;
}

@media (max-width: 768px) {
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
}

@media (max-width: 480px) {
  .filter-bar {
    padding: 0.5rem;
  }

  .filter-top :deep(.p-selectbutton .p-button) {
    padding: 0.3rem 0.4rem;
    font-size: 0.75rem;
  }
}
</style>
