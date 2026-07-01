<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Checkbox from 'primevue/checkbox'
import Button from 'primevue/button'
import Message from 'primevue/message'

const router = useRouter()
const authStore = useAuthStore()

const userCode = ref('')
const password = ref('')
const rememberMe = ref(false)
const loading = ref(false)
const errorMsg = ref('')

async function handleLogin() {
  if (!userCode.value.trim() || !password.value.trim()) {
    errorMsg.value = 'กรุณากรอกรหัสผู้ใช้และรหัสผ่าน'
    return
  }
  loading.value = true
  errorMsg.value = ''
  try {
    await authStore.login(userCode.value.trim(), password.value.trim(), rememberMe.value)
    router.push('/select-pos')
  } catch (err) {
    errorMsg.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Card class="login-card">
    <template #header>
      <div class="login-header">
        <i class="pi pi-chart-bar login-logo" />
        <h2 class="login-title">MobileTools</h2>
        <p class="login-subtitle">ระบบช่วยขาย</p>
      </div>
    </template>

    <template #content>
      <form class="login-form" @submit.prevent="handleLogin">
        <Message v-if="errorMsg" severity="error" :closable="false">{{ errorMsg }}</Message>

        <div class="field">
          <label for="userCode">รหัสผู้ใช้</label>
          <InputText
            id="userCode"
            v-model="userCode"
            placeholder="กรอกรหัสผู้ใช้"
            class="w-full"
            autocomplete="username"
            @input="errorMsg = ''"
          />
        </div>

        <div class="field">
          <label for="password">รหัสผ่าน</label>
          <Password
            id="password"
            v-model="password"
            placeholder="กรอกรหัสผ่าน"
            class="w-full"
            :feedback="false"
            toggle-mask
            autocomplete="current-password"
            @input="errorMsg = ''"
          />
        </div>

        <div class="field-checkbox">
          <Checkbox v-model="rememberMe" input-id="remember" binary />
          <label for="remember">จดจำการเข้าสู่ระบบ</label>
        </div>

        <Button
          type="submit"
          label="เข้าสู่ระบบ"
          class="w-full"
          :loading="loading"
        />
      </form>
    </template>
  </Card>
</template>

<style scoped>
.login-card {
  width: 100%;
  max-width: 400px;
}

.login-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 1rem 0.5rem;
  gap: 0.25rem;
}

.login-logo {
  font-size: 2.5rem;
  color: var(--p-primary-color);
}

.login-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--p-text-color);
}

.login-subtitle {
  margin: 0;
  font-size: 0.875rem;
  color: var(--p-text-color-secondary);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--p-text-color);
}

.field-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.field-checkbox label {
  font-size: 0.875rem;
  cursor: pointer;
}

.w-full {
  width: 100%;
}
</style>
