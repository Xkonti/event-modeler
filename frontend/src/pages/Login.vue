<script setup>
// Login page. email+password → authRepository.login. On ok → push to
// route.query.redirect || '/'. On error → form-level message. Submit disabled
// while busy. Testids per notes/auth-build-plan.md §5-StageF3:
//   login-form, login-email, login-password, login-submit.
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { login } from '@/repositories/authRepository'
import FormField from '@/components/ui/FormField.vue'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'

const email = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

const router = useRouter()
const route = useRoute()

async function submit() {
  error.value = ''
  busy.value = true
  const r = await login({ email: email.value, password: password.value })
  busy.value = false
  if (!r.ok) {
    error.value = r.error || 'Login failed'
    return
  }
  // Only honor an INTERNAL redirect path ('/x', not '//evil.com' or absolute
  // URLs) — the value comes straight from the URL query and is attacker-set.
  const redirect = route.query.redirect
  const dest =
    typeof redirect === 'string' &&
    redirect.startsWith('/') &&
    !redirect.startsWith('//')
      ? redirect
      : '/'
  router.replace(dest)
}
</script>

<template>
  <form data-testid="login-form" class="space-y-4" @submit.prevent="submit">
    <h2 class="text-lg font-semibold text-gray-900">Sign in</h2>

    <FormField label="Email" v-slot="{ id }">
      <Input :id="id" data-testid="login-email" type="email" v-model="email" />
    </FormField>

    <FormField label="Password" v-slot="{ id }">
      <Input :id="id" data-testid="login-password" type="password" v-model="password" />
    </FormField>

    <p v-if="error" data-testid="login-error" class="text-sm text-red-600">{{ error }}</p>

    <Button data-testid="login-submit" type="submit" :disabled="busy" class="w-full">
      {{ busy ? 'Signing in…' : 'Sign in' }}
    </Button>

    <p class="text-center text-sm text-gray-600">
      Need an account?
      <RouterLink to="/signup" class="text-brand hover:underline">Sign up</RouterLink>
    </p>
  </form>
</template>
