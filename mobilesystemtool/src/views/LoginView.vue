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
        <div class="login-logo-wrap">
          <img src="/fishsoft-icons/fishsoft-icon-192x192.png" alt="" class="login-logo" />
        </div>
        <h2 class="login-title">MobileTools</h2>
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
  overflow: hidden;
  border-color: rgba(2, 120, 184, 0.22);
  box-shadow: var(--app-shadow-float);
}

.login-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 1rem 0.75rem;
  gap: 0.375rem;
  background: linear-gradient(180deg, #eff8ff, #ffffff);
}

.login-logo-wrap {
  width: 5rem;
  height: 5rem;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #ffffff;
  border: 1px solid var(--app-blue-line);
  box-shadow: 0 10px 24px rgba(2, 120, 184, 0.14);
}

.login-logo {
  width: 4.35rem;
  height: 4.35rem;
  object-fit: contain;
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

@media (max-width: 767px) {
  .login-card {
    max-width: none;
    align-self: center;
  }

  .login-header {
    padding-top: 1.5rem;
  }

  .login-logo-wrap {
    width: 4.5rem;
    height: 4.5rem;
  }

  .login-logo {
    width: 3.85rem;
    height: 3.85rem;
  }
}
</style>
