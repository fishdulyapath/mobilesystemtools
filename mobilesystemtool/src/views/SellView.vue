<script setup>
import { ref, onMounted } from 'vue'
import { setBasketInfo, getBasketList, clearBasket } from '@/services/basketService'
import { useCartStore } from '@/stores/cart'
import BasketGrid from '@/components/sell/BasketGrid.vue'
import BasketSetupStep from '@/components/sell/BasketSetupStep.vue'
import ProductCatalogStep from '@/components/sell/ProductCatalogStep.vue'
import CartStep from '@/components/sell/CartStep.vue'

const cartStore = useCartStore()

const currentStep = ref('basket-grid')
const selectedBasket = ref(null)

const SESSION_KEY = 'sell_nav'

function saveSession(step, basket) {
  if (!basket || step === 'basket-grid') {
    sessionStorage.removeItem(SESSION_KEY)
  } else {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ step, basket_id: basket.basket_id }))
  }
}

onMounted(async () => {
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (!raw) return
  try {
    const { step, basket_id } = JSON.parse(raw)
    if (!basket_id || !['catalog', 'cart'].includes(step)) return

    const baskets = await getBasketList()
    const basket = baskets.find(b => b.basket_id === basket_id)
    if (!basket || basket.status !== 'active') {
      sessionStorage.removeItem(SESSION_KEY)
      return
    }

    selectedBasket.value = basket
    currentStep.value = step
    await cartStore.fetchCart(`BASKET-${basket_id}`)
  } catch {
    sessionStorage.removeItem(SESSION_KEY)
  }
})

function onBasketSelected(basket) {
  selectedBasket.value = basket
  if (basket.status === 'active') {
    currentStep.value = 'catalog'
    saveSession('catalog', basket)
  } else {
    currentStep.value = 'basket-setup'
  }
}

async function onBasketSetupDone(setupData) {
  await setBasketInfo({ basket_id: selectedBasket.value.basket_id, ...setupData })
  selectedBasket.value = { ...selectedBasket.value, ...setupData, status: 'active' }
  currentStep.value = 'catalog'
  saveSession('catalog', selectedBasket.value)
}

function onBackToGrid() {
  currentStep.value = 'basket-grid'
  selectedBasket.value = null
  saveSession('basket-grid', null)
}

function onGoToSetup() {
  currentStep.value = 'basket-setup'
}

function onBackFromSetup() {
  if (selectedBasket.value?.status === 'active') {
    currentStep.value = 'catalog'
  } else {
    currentStep.value = 'basket-grid'
    selectedBasket.value = null
  }
}

async function onClearBasket() {
  await clearBasket(selectedBasket.value.basket_id)
  cartStore.clearLocalCart()
  selectedBasket.value = null
  currentStep.value = 'basket-grid'
  sessionStorage.removeItem(SESSION_KEY)
}

function onGoToCart() {
  currentStep.value = 'cart'
  saveSession('cart', selectedBasket.value)
}

function onBackFromCart() {
  currentStep.value = 'catalog'
  saveSession('catalog', selectedBasket.value)
}

function onCartDone() {
  selectedBasket.value = null
  currentStep.value = 'basket-grid'
  saveSession('basket-grid', null)
}
</script>

<template>
  <div class="sell-view">
    <BasketGrid
      v-if="currentStep === 'basket-grid'"
      @select="onBasketSelected"
    />
    <BasketSetupStep
      v-else-if="currentStep === 'basket-setup'"
      :basket="selectedBasket"
      @done="onBasketSetupDone"
      @back="onBackFromSetup"
      @clear="onClearBasket"
    />
    <ProductCatalogStep
      v-else-if="currentStep === 'catalog'"
      :basket="selectedBasket"
      @back="onBackToGrid"
      @go-setup="onGoToSetup"
      @go-cart="onGoToCart"
    />
    <CartStep
      v-else-if="currentStep === 'cart'"
      :basket="selectedBasket"
      @back="onBackFromCart"
      @done="onCartDone"
    />
  </div>
</template>

<style scoped>
.sell-view {
  flex: 1;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin: -1.5rem;
}

@media (max-width: 767px) {
  .sell-view {
    margin: -1rem;
  }
}
</style>
