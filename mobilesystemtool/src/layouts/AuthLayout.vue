<template>
  <div class="auth-wrapper">
    <slot />
  </div>
</template>

<style scoped>
.auth-wrapper {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--p-surface-ground);
  padding: 1rem;
}
</style>
