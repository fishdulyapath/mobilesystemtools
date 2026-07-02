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
  background:
    radial-gradient(circle at 18% 18%, rgba(45, 179, 244, 0.20), transparent 18rem),
    radial-gradient(circle at 82% 12%, rgba(2, 120, 184, 0.16), transparent 22rem),
    linear-gradient(180deg, #f6fbff 0%, #eaf6ff 100%);
  padding: 1rem;
}

@media (max-width: 767px) {
  .auth-wrapper {
    align-items: stretch;
    padding: 0.875rem;
  }
}
</style>
