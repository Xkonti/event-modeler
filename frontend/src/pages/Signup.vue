<script setup>
// Signup page. name+email+password → authRepository.register. Client validation
// runs FIRST (blocks the call): non-empty name, valid-looking email, password
// length >= 8 (mirrors better-auth's minPasswordLength default). Server errors
// (e.g. email already registered) render as a form-level message.
// Testids per notes/auth-build-plan.md §5-StageF3:
//   signup-name, signup-email, signup-password, signup-submit.
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { register } from '@/repositories/authRepository'
import { useSessionStore } from '@/stores/session'
import FormField from '@/components/ui/FormField.vue'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'

const name = ref('')
const email = ref('')
const password = ref('')

const nameErr = ref('')
const emailErr = ref('')
const passwordErr = ref('')
const error = ref('')
const busy = ref(false)

const router = useRouter()
const sessionStore = useSessionStore()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate() {
  nameErr.value = name.value.trim() ? '' : 'Name is required'
  emailErr.value = EMAIL_RE.test(email.value) ? '' : 'Enter a valid email'
  passwordErr.value = password.value.length >= 8 ? '' : 'Password must be at least 8 characters'
  return !nameErr.value && !emailErr.value && !passwordErr.value
}

async function submit() {
  error.value = ''
  if (!validate()) return
  busy.value = true
  const r = await register({
    name: name.value.trim(),
    email: email.value,
    password: password.value,
  })
  busy.value = false
  if (!r.ok) {
    error.value = r.error || 'Sign up failed'
    return
  }
  // Refresh the reactive session (cookie is now set) so the guard sees authed.
  await sessionStore.refresh()
  router.replace('/')
}
</script>

<template>
  <form data-testid="signup-form" class="space-y-4" @submit.prevent="submit">
    <h2 class="text-lg font-semibold text-gray-900">Create account</h2>

    <FormField label="Name" :error="nameErr" v-slot="{ id }">
      <Input :id="id" data-testid="signup-name" type="text" v-model="name" />
    </FormField>

    <FormField label="Email" :error="emailErr" v-slot="{ id }">
      <Input :id="id" data-testid="signup-email" type="email" v-model="email" />
    </FormField>

    <FormField label="Password" :error="passwordErr" v-slot="{ id }">
      <Input :id="id" data-testid="signup-password" type="password" v-model="password" />
    </FormField>

    <p v-if="error" data-testid="signup-error" class="text-sm text-red-600">{{ error }}</p>

    <Button data-testid="signup-submit" type="submit" :disabled="busy" class="w-full">
      {{ busy ? 'Creating…' : 'Create account' }}
    </Button>

    <p class="text-center text-sm text-gray-600">
      Already have an account?
      <RouterLink to="/login" class="text-brand hover:underline">Sign in</RouterLink>
    </p>
  </form>
</template>
